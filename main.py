# main.py

import webview
import os
import subprocess
import sys
import time
import threading
import json
import urllib.request
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')

class Api:
    def __init__(self):
        # 在用户的个人主目录下定义一个专门的应用数据文件夹
        app_data_dir = os.path.join(os.path.expanduser("~"), ".OllamaModelHelper")
        # 确保这个文件夹存在，如果不存在则创建它
        os.makedirs(app_data_dir, exist_ok=True)
        # 将所有需要读写的文件路径指向这个新目录
        self.custom_templates_file = os.path.join(app_data_dir, "custom_templates.json")
        self.temp_log_path = os.path.join(app_data_dir, "ollama_create.log")
        # 为了能在其他方法中使用这个路径，将其保存为实例变量
        self.app_data_dir = app_data_dir

    def toggle_devtools(self):
        """
        这个函数暴露给前端，用于打开或关闭开发者工具。
        """
        if webview.windows:
            webview.windows[0].toggle_devtools()

    def select_gguf_file(self):
        file_types = ('GGUF 模型 (*.gguf)',)
        result = webview.windows[0].create_file_dialog(webview.OPEN_DIALOG, allow_multiple=False, file_types=file_types)
        return result[0] if result else None

    def load_custom_templates(self):
        if os.path.exists(self.custom_templates_file):
            try:
                with open(self.custom_templates_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def save_custom_templates(self, templates):
        try:
            with open(self.custom_templates_file, 'w', encoding='utf-8') as f:
                json.dump(templates, f, indent=4)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def format_size(self, size_in_bytes):
        if size_in_bytes is None: return "N/A"
        power = 1024; n = 0; power_labels = {0: '', 1: 'KB', 2: 'MB', 3: 'GB', 4: 'TB'}
        while size_in_bytes >= power and n < len(power_labels):
            size_in_bytes /= power
            n += 1
        return f"{size_in_bytes:.2f} {power_labels[n]}"

    def format_datetime_ago(self, iso_timestamp):
        if iso_timestamp is None: return "N/A"
        try:
            dt_object = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00")); now = datetime.now(timezone.utc); diff = now - dt_object
            seconds = diff.total_seconds()
            if seconds < 60: return "just now"
            elif seconds < 3600: return f"{int(seconds / 60)} minutes ago"
            elif seconds < 86400: return f"{int(seconds / 3600)} hours ago"
            elif seconds < 2592000: return f"{int(seconds / 86400)} days ago"
            elif seconds < 31536000: return f"{int(seconds / 2592000)} months ago"
            else: return f"{int(seconds / 31536000)} years ago"
        except: return iso_timestamp

    def list_models(self):
        try:
            with urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=5) as response:
                if response.status == 200:
                    api_data = json.loads(response.read().decode('utf-8'))
                    models_raw = api_data.get("models", [])
                    models_formatted = []
                    for model in models_raw:
                        models_formatted.append({
                            "name": model.get("name", "N/A"),
                            "id": model.get("digest", "N/A")[:12],
                            "size": self.format_size(model.get("size")),
                            "modified": self.format_datetime_ago(model.get("modified_at")),
                            "selected": False
                        })
                    return {"data": models_formatted}
                else:
                    return {"error": f"API请求失败, 状态码: {response.status}"}
        except Exception as e:
            return {"error": f"无法连接到Ollama服务: {e}"}
            
    def get_ps(self):
        try:
            creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            result = subprocess.run(['ollama', 'ps'], capture_output=True, text=True, check=True, encoding='utf-8', creationflags=creation_flags)
            return result.stdout or "Ollama 服务正在运行，但当前没有模型在活动。"
        except Exception:
            return "Ollama 服务未运行或当前无模型加载。"

    def remove_models(self, model_names):
        try:
            command = ['ollama', 'rm'] + model_names
            creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            subprocess.run(command, check=True, capture_output=True, text=True, creationflags=creation_flags)
            return {"success": True, "error": None}
        except subprocess.CalledProcessError as e:
            error_message = e.stderr.strip()
            return {"success": False, "error": error_message}
        except FileNotFoundError:
            return {"success": False, "error": "执行失败：找不到 'ollama' 命令。请确保Ollama已正确安装并添加到系统PATH。"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def create_model(self, options):
        model_path = options.get('modelPath')
        modelfile_content = options.get('modelfileContent')
        if not model_path:
            return {"success": False, "error": "模型路径不能为空"}
        normalized_name = (
            os.path.splitext(os.path.basename(model_path))[0]
            .lower()
            .replace('_', '-')
        )
        # 清空旧日志
        with open(self.temp_log_path, 'w', encoding='utf-8') as f:
            f.write('')
        
        # 将临时Modelfile也创建在用户数据目录中
        temp_modelfile_path = os.path.join(self.app_data_dir, "Modelfile.temp")

        with open(temp_modelfile_path, "w", encoding="utf-8") as f:
            f.write(modelfile_content)
        thread = threading.Thread(target=self._run_create_process, args=(normalized_name, temp_modelfile_path))
        thread.start()
        return {"success": True, "normalizedName": normalized_name}

    def _run_create_process(self, model_name, modelfile_path):
        try:
            command = ["ollama", "create", model_name, "-f", modelfile_path]
            creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                bufsize=1,
                creationflags=creation_flags
            )
            
            with open(self.temp_log_path, 'a', encoding='utf-8') as log_file:
                for line in iter(process.stdout.readline, ''):
                    # 已移除此处的 print 语句以解决 Windows 上的 gbk 编码错误
                    log_file.write(line)
                    log_file.flush()
            process.wait()
            with open(self.temp_log_path, 'a', encoding='utf-8') as log_file:
                if process.returncode == 0:
                    log_file.write(f"\n✅ 成功! 模型 '{model_name}' 已成功加载。\n")
                    log_file.write(f"---SUCCESS---\n进程结束，退出码: {process.returncode}")
                else:
                    log_file.write(f"\n❌ 失败! 模型创建失败。\n")
                    log_file.write(f"---ERROR---\n进程结束，退出码: {process.returncode}")

        except FileNotFoundError:
            error_message = (
                "\n❌ 致命错误: 找不到 'ollama' 命令。\n\n"
                "这通常意味着 Ollama 没有被添加到系统的 PATH 环境变量中。\n"
                "请确保您的用户在安装 Ollama 时，勾选了 'Add to PATH' 或等效选项。\n"
                "---ERROR---"
            )
            with open(self.temp_log_path, 'a', encoding='utf-8') as log_file:
                log_file.write(error_message)
        except Exception as e:
            error_message = f"\n❌ 发生未知错误: {e}\n---ERROR---"
            with open(self.temp_log_path, 'a', encoding='utf-8') as log_file:
                log_file.write(error_message)
        finally:
            if os.path.exists(modelfile_path):
                os.remove(modelfile_path)

    def read_log(self):
        if os.path.exists(self.temp_log_path):
            with open(self.temp_log_path, 'r', encoding='utf-8') as f:
                return f.read()
        return ''

if __name__ == '__main__':
    api = Api()
    entry_point = 'file://' + os.path.join(FRONTEND_DIR, 'index.html')

    # --- 智能重试逻辑 ---
    MAX_ATTEMPTS = 5  # 最多重试5次
    for attempt in range(MAX_ATTEMPTS):
        try:
            print(f"--- 正在进行第 {attempt + 1} 次启动尝试 ---", file=sys.stderr)
            # 每次尝试都创建一个新的窗口实例
            window = webview.create_window(
                'Ollama-helper',
                entry_point,
                js_api=api,
                width=950,
                height=900,
                resizable=True
            )
            webview.start()
            # 如果代码能执行到这里，说明窗口被正常关闭，任务完成
            print("--- 程序已正常关闭 ---", file=sys.stderr)
            break  # 成功启动并关闭后，跳出重试循环

        except BaseException as e:
            # 捕获到任何异常（比如端口占用）
            if isinstance(e, KeyboardInterrupt):
                print("检测到用户中断操作...", file=sys.stderr)
            else:
                print(f"启动失败: {e}", file=sys.stderr)
            if attempt < MAX_ATTEMPTS - 1:
                print(f"将在 3 秒后进行下一次重试...", file=sys.stderr)
                time.sleep(3)  # 等待3秒
            else:
                print("--- 已达到最大重试次数，程序退出。---", file=sys.stderr)
                print("--- 请手动等待一分钟或重启电脑后再试。---", file=sys.stderr)
                # 在Windows上暂停，让用户能看到最终信息
                if os.name == 'nt':
                    os.system("pause")
