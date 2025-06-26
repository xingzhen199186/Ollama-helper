// app.js
const { createApp, ref, computed, watch, nextTick } = Vue;

createApp({
    setup() {
        // --- 响应式状态定义 ---
        const activeTab = ref('load');
        const isLoading = ref(false);
        const ggufPath = ref('');
        const modelName = ref('');
        const logs = ref('欢迎使用Ollama模型助手！请先选择一个GGUF文件。\n');
        const logContainer = ref(null);
        const logInterval = ref(null);
        const selectedTemplateKey = ref('auto');
        const models = ref({ data: [], error: null });
        const psInfo = ref('点击刷新按钮获取状态...');
        const customTemplates = ref({});
        const newTemplateName = ref('');
        const newTemplateContent = ref('');
        const newTemplateKeywords = ref('');
        const creationStatus = ref('idle'); // 'idle', 'loading', 'success', 'error'
        const finalModelName = ref('');

        // 内置模板库
        const builtInTemplates = {
            auto: { name: '智能检测 (默认)' },
            default_template: { name: '空白模板 (使用模型内置模板)', template: `# 此模式将使用模型的默认模板，不进行任何自定义配置。`},
            llama3: { name: 'Llama3 (常规)', template: `TEMPLATE """<|begin_of_text|><|start_header_id|>user<|end_header_id|>{{ .Prompt }}<|eot_id|><|start_header_id|>assistant<|end_header_id|>"""\nPARAMETER stop <|eot_id|>\nPARAMETER stop <|end_of_text|>`},
            llama_agent: { name: 'Llama4 (Agent/工具使用)', template: `TEMPLATE """{{- if or .System .Tools -}}<|header_start|>system<|header_end|>\n\n{{- if and (.System) (not (.Tools)) -}}{{ .System }}{{- end -}}{{- if .Tools -}}\nYou are a helpful assistant and an expert in function composition. You can answer general questions using your internal knowledge OR invoke functions when necessary. Follow these strict guidelines:\n\n1. FUNCTION CALLS:\n- ONLY use functions that are EXPLICITLY listed in the function list below\n- If NO functions are listed (empty function list []), respond ONLY with internal knowledge or "I don't have access to [Unavailable service] information"\n- If a function is not in the list, respond ONLY with internal knowledge or "I don't have access to [Unavailable service] information"\n- If ALL required parameters are present AND the query EXACTLY matches a listed function's purpose: output ONLY the function call(s)\n- Use exact format: [{"name": "<tool_name_foo>","parameters": {"<param1_name>": "<param1_value>","<param2_name>": "<param2_value>"}}]\nExamples:\nCORRECT: [{"name": "get_weather","parameters": {"location": "Vancouver"}},{"name": "calculate_route","parameters": {"start": "Boston","end": "New York"}}] <- Only if get_weather and calculate_route are in function list\n\n2. RESPONSE RULES:\n- For pure function requests matching a listed function: ONLY output the function call(s)\n- For knowledge questions: ONLY output text\n- For missing parameters: ONLY request the specific missing parameters\n- For unavailable services (not in function list): output ONLY with internal knowledge or "I don't have access to [Unavailable service] information". Do NOT execute a function call.\n- If the query asks for information beyond what a listed function provides: output ONLY with internal knowledge about your limitations\n- NEVER combine text and function calls in the same response\n- NEVER suggest alternative functions when the requested service is unavailable\n- NEVER create or invent new functions not listed below\n\n3. STRICT BOUNDARIES:\n- ONLY use functions from the list below - no exceptions\n- NEVER use a function as an alternative to unavailable information\n- NEVER call functions not present in the function list\n- NEVER add explanatory text to function calls\n- NEVER respond with empty brackets\n- Use proper Python/JSON syntax for function calls\n- Check the function list carefully before responding\n\n4. TOOL RESPONSE HANDLING:\n- When receiving tool responses: provide concise, natural language responses\n- Don't repeat tool response verbatim\n- Don't add supplementary information\n\nHere is a list of functions in JSON format that you can invoke:\n[\n{{ range .Tools }} {{ . }} \n{{ end }}]{{- end -}}<|eot|>{{- end -}}\n{{- range $i, $_ := .Messages -}}\n{{- $last := (eq (len (slice $.Messages $i)) 1) -}}\n{{- if eq .Role "system" -}}{{- continue -}}\n{{- else if eq .Role "user" -}}<|header_start|>user<|header_end|>\n\n{{ .Content }}\n{{- else if eq .Role "assistant" -}}<|header_start|>assistant<|header_end|>\n\n{{ if .Content }}{{ .Content }}\n{{- else if .ToolCalls -}}[\n{{- range .ToolCalls -}}\n{"name": "{{ .Function.Name }}", "parameters": {{ .Function.Arguments }}}\n{{ end }}]\n{{- end }}\n{{- else if eq .Role "tool" -}}<|header_start|>ipython<|header_end|>\n\n[\n  {"response": "{{ .Content }}"}\n]\n{{- end -}}\n{{- if not $last -}}<|eot|>{{ end -}}\n{{- if (and $last (ne .Role "assistant")) -}}<|header_start|>assistant<|header_end|>\n\n{{ end -}}\n{{- end -}}"""` },
            gemma: { name: 'Gemma 模板', template: `TEMPLATE """{{- range $i, $_ := .Messages -}}{{- $last := eq (len (slice $.Messages $i)) 1 -}}{{- if or (eq .Role "user") (eq .Role "system") -}}<start_of_turn>user\n{{ .Content }}<end_of_turn>{{ if $last }}\n<start_of_turn>model{{ end }}{{- else if eq .Role "assistant" -}}<start_of_turn>model\n{{ .Content }}{{ if not $last }}<end_of_turn>{{ end }}{{- end -}}{{- end -}}"""` },
            phi: { name: 'Phi-3 模板', template: `TEMPLATE """{{- range $i, $_ := .Messages -}}{{- $last := eq (len (slice $.Messages $i)) 1 -}}<|im_start|>{{ .Role }}<|im_sep|>\n{{ .Content }}{{ if not $last }}<|im_end|>\n{{ end }}{{- if and (ne .Role "assistant") $last -}}<|im_end|>\n<|im_start|>assistant<|im_sep|>{{ end }}{{- end -}}"""` },
            deepseek: { name: 'DeepSeek (Coder V2, R1)', template: `TEMPLATE """{{- if .System }}{{ .System }}{{ end }}{{- range $i, $_ := .Messages -}}{{- $last := eq (len (slice $.Messages $i)) 1}}{{- if eq .Role "user" }}<｜User｜>{{ .Content }}{{- else if eq .Role "assistant" }}<｜Assistant｜>{{- if and $.IsThinkSet (and $last .Thinking) -}}<think>{{ .Thinking }}</think>{{- end }}{{ .Content }}{{- if not $last }}<｜end of sentence｜>{{- end }}{{- end }}{{- if and $last (ne .Role "assistant") }}<｜Assistant｜>{{- if and $.IsThinkSet (not $.Think) -}}<think></think>{{ end }}{{- end -}}{{- end -}}"""`},
            devstral: { name: 'Devstral (Mistral)', template: `TEMPLATE """{{- range $index, $_ := .Messages -}}{{- if eq .Role "system" -}}[SYSTEM_PROMPT]{{ .Content }}[/SYSTEM_PROMPT]{{- else if eq .Role "user" -}}{{- if and (le (len (slice $.Messages $index)) 2) $.Tools -}}[AVAILABLE_TOOLS]{{ $.Tools }}[/AVAILABLE_TOOLS]{{- end -}}[INST]{{ .Content }}[/INST]{{- else if eq .Role "assistant" -}}{{- if .Content -}}{{ .Content }}{{- if not (eq (len (slice $.Messages $index)) 1) -}}</s>{{- end -}}{{- else if .ToolCalls -}}[TOOL_CALLS][{{- range .ToolCalls -}}{"name": "{{ .Function.Name }}", "arguments": {{ .Function.Arguments }}}{{- end -}}]</s>{{- end -}}{{- else if eq .Role "tool" -}}[TOOL_RESULTS]{"content": {{ .Content }}}[/TOOL_RESULTS]{{- end -}}{{- end -}}"""` },
            mistral: { name: 'Mistral (通用/工具使用)', template: `TEMPLATE """{{- if .Messages -}}{{- range $index, $_ := .Messages -}}{{- if eq .Role "user" -}}{{- if and (eq (len (slice $.Messages $index)) 1) $.Tools -}}[AVAILABLE_TOOLS] {{ $.Tools }}[/AVAILABLE_TOOLS]{{- end -}}[INST] {{ if and $.System (eq (len (slice $.Messages $index)) 1) }}{{ $.System }}\n\n{{ end }}{{ .Content }}[/INST]{{- else if eq .Role "assistant" -}}{{- if .Content -}}{{ .Content }}{{- else if .ToolCalls -}}[TOOL_CALLS] [{{- range .ToolCalls -}}{"name": "{{ .Function.Name }}", "arguments": {{ .Function.Arguments }}}{{- end -}}]{{- end -}}</s>{{- else if eq .Role "tool" -}}[TOOL_RESULTS] {"content": {{ .Content }}} [/TOOL_RESULTS]{{- end -}}{{- end -}}{{- else -}}[INST] {{ if .System }}{{ $.System }}\n\n{{ end }}{{ .Prompt }}[/INST]{{- end -}}{{- .Response -}}{{- if .Response -}}</s>{{- end -}}"""` },
            chatml: { name: 'ChatML (Qwen, Yi, etc.)', template: `TEMPLATE """<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n<|im_start|>user\n{{ .Prompt }}<|im_end|>\n<|im_start|>assistant\n"""\nPARAMETER stop <|im_end|>\nPARAMETER stop <|im_start|>`},
            llava: { name: 'LLaVA 模板', template: `TEMPLATE """[INST] {{- if .System }} {{ .System }} {{ end }} {{ .Prompt }} [/INST]"""` },
            jan_nano: {name: 'Jan Nano (高级/工具使用)',template: `TEMPLATE """{{- $lastUserIdx := -1 -}}{{- range $idx, $msg := .Messages -}}{{- if eq $msg.Role "user" }}{{ $lastUserIdx = $idx }}{{ end -}}{{- end -}}{{- if or .System .Tools -}}<|im_start|>system\n{{ if .System }}\n{{ .System }}\n{{- end -}}{{- if .Tools -}}\n\n# Tools\n\nYou may call one or more functions to assist with the user query.\n\nYou are provided with function signatures within <tools></tools> XML tags:\n<tools>\n{{- range .Tools -}}\n{"type": "function", "function": {{ .Function }}}\n{{- end -}}\n</tools>\n\nFor each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\n<tool_call>\n{"name": <function-name>, "arguments": <args-json-object>}\n</tool_call>\n{{- end -}}\n<|im_end|>\n{{ end }}{{- range $i, $_ := .Messages -}}{{- $last := eq (len (slice $.Messages $i)) 1 -}}{{- if eq .Role "user" -}}<|im_start|>user\n{{ .Content }}\n{{- if and $.IsThinkSet (eq $i $lastUserIdx) -}}\n   {{- if $.Think -}}\n      {{- " "}}/think\n   {{- else -}}\n      {{- " "}}/no_think\n   {{- end -}}\n{{- end -}}<|im_end|>\n{{ else if eq .Role "assistant" -}}<|im_start|>assistant\n{{ if (and $.IsThinkSet (and .Thinking (or $last (gt $i $lastUserIdx)))) -}}\n<think>{{ .Thinking }}</think>\n{{ end -}}\n{{ if .Content }}{{ .Content }}\n{{- else if .ToolCalls -}}<tool_call>\n{{ range .ToolCalls }}{"name": "{{ .Function.Name }}", "arguments": {{ .Function.Arguments }}}\n{{ end }}</tool_call>\n{{- end -}}{{ if not $last -}}<|im_end|>\n{{ end }}\n{{- else if eq .Role "tool" -}}<|im_start|>user\n<tool_response>\n{{ .Content }}\n</tool_response><|im_end|>\n{{ end }}{{- if and (ne .Role "assistant") $last -}}<|im_start|>assistant\n{{ if and $.IsThinkSet (not $.Think) -}}\n<think>\n\n</think>\n\n{{ end -}}\n{{ end }}\n{{- end -}}"""`},
            vicuna: { name: 'Vicuna', template: `TEMPLATE """USER: {{ .Prompt }} ASSISTANT:"""\nPARAMETER stop "USER:"\nPARAMETER stop "ASSISTANT:"` },
            alpaca: { name: 'Alpaca', template: `TEMPLATE """### Instruction:\n{{ .Prompt }}\n\n### Response:"""`},
        };
        
        const availableTemplates = computed(() => ({ ...builtInTemplates, ...customTemplates.value }));
        const modelfileContent = computed(() => {
            let key = selectedTemplateKey.value;
            const allTemplates = availableTemplates.value;
            if (key === 'auto' && ggufPath.value) {
                const filename = ggufPath.value.toLowerCase();
                let found = false;
                for (const [templateKey, templateData] of Object.entries(customTemplates.value)) {
                    if (templateData.keywords && templateData.keywords.some(keyword => filename.includes(keyword.toLowerCase()))) {
                        key = templateKey;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    if (filename.includes('llama4') || filename.includes('llama-4')) key = 'llama_agent';
                    else if (filename.includes('llama3') || filename.includes('llama-3')) key = 'llama3';
                    else if (filename.includes('gemma')) key = 'gemma';
                    else if (filename.includes('phi-3') || filename.includes('phi3')) key = 'phi';
                    else if (filename.includes('deepseek')) key = 'deepseek';
                    else if (filename.includes('devstral')) key = 'devstral';
                    else if (filename.includes('mistral')) key = 'mistral';
                    else if (filename.includes('chatml') || filename.includes('qwen') || filename.includes('yi-')) key = 'chatml';
                    else if (filename.includes('llava')) key = 'llava';
                    else if (filename.includes('jan-nano') || filename.includes('jan')) key = 'jan_nano';
                    else if (filename.includes('vicuna')) key = 'vicuna';
                    else if (filename.includes('alpaca')) key = 'alpaca';
                    else key = 'default_template';
                }
            }
            const templateData = allTemplates[key] || {};
            const templateContent = templateData.template || (key === 'default_template' ? '# 使用模型内置模板' : '# 模板内容加载失败...');
            const normalizedPath = (ggufPath.value || '请先选择模型文件').replace(/\\/g, '/');
            let finalTemplatePart = templateContent;
            const firstEffectiveLine = (templateContent.split('\n').find(line => line.trim() && !line.trim().startsWith('#')) || '').trim();
            if (firstEffectiveLine) {
                const directives = ['FROM', 'PARAMETER', 'TEMPLATE', 'SYSTEM', 'ADAPTER', 'LICENSE', 'MESSAGE'];
                if (!directives.some(dir => firstEffectiveLine.toUpperCase().startsWith(dir))) {
                    finalTemplatePart = `TEMPLATE """${templateContent}"""`;
                }
            }
            return `FROM "${normalizedPath}"\n${finalTemplatePart}`;
        });
        const selectedModelsCount = computed(() => models.value.data ? models.value.data.filter(m => m.selected).length : 0);
        const allSelected = computed({
            get: () => models.value.data && models.value.data.length > 0 && models.value.data.every(m => m.selected),
            set: (value) => { if(models.value.data) models.value.data.forEach(m => m.selected = value) }
        });
        
        const loadCustomTemplates = async () => {
            const stored = await window.pywebview.api.load_custom_templates();
            if (stored) customTemplates.value = stored;
        };

        const saveCustomTemplate = async () => {
            const name = newTemplateName.value.trim();
            let content = newTemplateContent.value.trim();
            if (!name || !content) { alert('模板名称和内容不能为空！'); return; }
            let finalContent = content;
            const firstEffectiveLine = (content.split('\n').find(line => line.trim() && !line.trim().startsWith('#')) || '').trim();
            if (firstEffectiveLine) {
                const directives = ['FROM', 'PARAMETER', 'TEMPLATE', 'SYSTEM', 'ADAPTER', 'LICENSE', 'MESSAGE'];
                const upperFirstLine = firstEffectiveLine.toUpperCase();
                const hasDirective = directives.some(dir => upperFirstLine.startsWith(dir));
                if (!hasDirective) {
                    finalContent = `TEMPLATE """${content}"""`;
                }
            }
            const key = `custom_${name.replace(/\s+/g, '_')}`;
            const keywords = newTemplateKeywords.value.split(',').map(k => k.trim()).filter(k => k);
            customTemplates.value[key] = { name: name, template: finalContent, keywords: keywords };
            const result = await window.pywebview.api.save_custom_templates(customTemplates.value);
            if (result.success) {
                alert('模板已保存！');
                newTemplateName.value = ''; newTemplateContent.value = ''; newTemplateKeywords.value = '';
            } else { alert(`保存失败: ${result.error}`); }
        };
        
        const deleteCustomTemplate = async (key) => {
            if (confirm(`确定要删除模板 “${customTemplates.value[key].name}” 吗？`)) {
                delete customTemplates.value[key];
                const result = await window.pywebview.api.save_custom_templates(customTemplates.value);
                if (result.success) {
                    alert('模板已删除！');
                } else {
                    alert(`删除失败: ${result.error}`);
                }
            }
        };
        
        const browseFile = async () => {
            isLoading.value = true;
            creationStatus.value = 'idle';
            const path = await window.pywebview.api.select_gguf_file();
            if (path) ggufPath.value = path;
            isLoading.value = false;
        };
        const handleFileDrop = (event) => alert("文件拖拽功能在此模式下受限，请使用“点击”按钮选择文件。");
        const startCreateModel = async () => {
            isLoading.value = true;
            creationStatus.value = 'loading';
            finalModelName.value = '';
            logs.value = '正在准备创建模型...\n';
            if (logInterval.value) clearInterval(logInterval.value);
            const response = await window.pywebview.api.create_model({
                modelPath: ggufPath.value,
                modelfileContent: modelfileContent.value
            });
            if (response.success) {
                finalModelName.value = response.normalizedName;
            } else {
                logs.value += `\n启动错误: ${response.error}`;
                isLoading.value = false;
                creationStatus.value = 'error';
                return;
            }
            logInterval.value = setInterval(async () => {
                const newLogs = await window.pywebview.api.read_log();
                logs.value = newLogs;
                nextTick(() => { if(logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight; });
                if (newLogs.includes('---SUCCESS---')) {
                    clearInterval(logInterval.value);
                    isLoading.value = false;
                    creationStatus.value = 'success';
                    refreshModels();
                } else if (newLogs.includes('---ERROR---')) {
                    clearInterval(logInterval.value);
                    isLoading.value = false;
                    creationStatus.value = 'error';
                }
            }, 1000);
        };
        const refreshModels = async () => {
            isLoading.value = true;
            psInfo.value = '正在获取...';
            try {
                const [modelResult, psResult] = await Promise.all([
                    window.pywebview.api.list_models(),
                    window.pywebview.api.get_ps()
                ]);
                models.value = modelResult;
                psInfo.value = psResult;
            } catch (e) {
                models.value.error = `请求失败: ${e}`;
            } finally {
                isLoading.value = false;
            }
        };
        const deleteSelectedModels = async () => {
            const toDelete = models.value.data.filter(m => m.selected).map(m => m.name);
            if (toDelete.length > 0 && confirm(`确定要删除这 ${toDelete.length} 个模型吗？\n${toDelete.join(', ')}`)) {
                isLoading.value = true;
                const result = await window.pywebview.api.remove_models(toDelete);
                if (result && result.success) {
                    alert('删除成功！');
                } else {
                    const errorMessage = result ? result.error : '发生未知错误。';
                    alert(`删除失败，详细原因：\n\n${errorMessage}`);
                }
                refreshModels();
                isLoading.value = false;
            }
        };
        const toggleSelectAll = () => { allSelected.value = !allSelected.value; };
        watch(ggufPath, (newPath) => {
            if (newPath) {
                creationStatus.value = 'idle';
                const filename = newPath.split(/[\\/]/).pop();
                modelName.value = filename.toLowerCase().replace(/\.gguf$/, '').replace(/[-_.]/g, '-');
            }
        });
        watch(activeTab, (newTab) => { if (newTab === 'manage') refreshModels(); });
        
        window.addEventListener('pywebviewready', () => {
            loadCustomTemplates();
        });

        document.addEventListener('keydown', (event) => {
            // 检查按下的键是不是 F12
            if (event.key === 'F12') {
                // 阻止 F12 键的默认行为 (比如打开浏览器自己的开发者工具)
                event.preventDefault();
                // 通过“对讲机”呼叫后厨，执行打开/关闭开发者工具的操作
                window.pywebview.api.toggle_devtools();
            }
        });
        
        return {
            activeTab, isLoading, ggufPath, modelName, logs, logContainer,
            availableTemplates, selectedTemplateKey, modelfileContent, models, psInfo,
            selectedModelsCount, allSelected,
            browseFile, handleFileDrop, startCreateModel, refreshModels, deleteSelectedModels, toggleSelectAll,
            customTemplates, newTemplateName, newTemplateContent, newTemplateKeywords,
            saveCustomTemplate, deleteCustomTemplate,
            creationStatus, finalModelName
        };
    }
}).mount('#app');
