# Ollama Helper

A graphical management tool designed for Ollama users, aimed at simplifying the process of importing, testing, and managing non-official GGUF models.

-----

## Introduction

Ollama is an excellent tool for running large language models. However, creating models from community sources like GGUF using the command line requires manually writing a `Modelfile`, which can be a cumbersome process.

**Ollama Helper** encapsulates this process within a clean and intuitive graphical interface, simplifying the loading of `Modelfile` files and providing unified management for GGUF models already loaded into Ollama.

## Core Features

  - **One-Click Model Loading**: Simply select a GGUF file, and the tool will handle the rest, eliminating the need for command-line operations.
  - **Smart Template System**:
      - Includes built-in `Modelfile` templates for many popular models and **intelligently recommends** the best match based on the GGUF filename.
      - Supports real-time preview of the generated `Modelfile` content and allows for manual template selection.
  - **Visual Model Management**:
      - Clearly displays all local Ollama models in a list format, including details like size and modification time.
      - Supports one-click batch deletion of models.
  - **Powerful Template Customization**:
      - You can easily create, save, and manage your own `Modelfile` templates.
      - Add **recognition keywords** to your custom templates to enable the smart recommendation system for your preferred models.
      - All custom templates are persistently saved in your user directory, so you don't have to worry about losing them.

## Prerequisites

1.  **Ollama Installed**: Ensure that you have installed Ollama locally and that its service is running.
2.  **Python Environment**: Please make sure you have Python installed on your computer, preferably Python 10 or newer.

## How to Run

### Method 1:

1.  **Download the Project**

    ```bash
    git clone https://github.com/xingzhen199186/ollama-helper.git
    cd ollama-helper
    ```

    Alternatively, you can download the ZIP archive directly and extract it.

2.  **Install Dependencies**
    Open your terminal (or PowerShell), navigate to the project's root directory, and run the following command to install the required dependencies:

    ```bash
    pip install -r requirements.txt
    ```

3.  **Run the Application**
    In the same terminal, run:

    ```bash
    python main.py
    ```

      - **For Windows Users**: You can also double-click the `run.bat` file in the project directory to quickly start the application.

### Method 2:

Choose the packaged `Ollama-helper.exe`. It is very lightweight and does not require downloading any other files.

## Feature Details

#### 1\. Model Loading

This is the core feature of the tool, with the process simplified into four steps:

1.  **Load GGUF File**: Click the selection area to choose your `.gguf` model file.
2.  **Select Template**: The tool will automatically suggest a recommended template based on keywords in the filename (e.g., "chatML", "gemma"). You can also manually select any built-in or custom template from the dropdown list.
3.  **Start Creation**: Click the "Create Model" button. The log area below will display the real-time progress of the `ollama create` command, showing a success or failure message upon completion.
4.  **Model Naming**: The tool will automatically generate a standardized name based on the filename. When using platforms like OpenWebUI, please use this standardized name.

#### 2\. Model Management

In this tab, you can:

  - Click **Refresh List** to get all current models in Ollama.
  - **Check the boxes** to select one or more models you wish to delete.
  - Click the **Delete Selected** button to remove them in a batch.
  - The **Ollama Status** area below will show the output of `ollama ps`, letting you know which models are currently running.

#### 3\. Template Management

If you frequently use specific templates or the built-in ones do not meet your needs, you can customize them here:

  - **Add Template**: Fill in the template name, content, and keywords for auto-recognition (separate multiple keywords with commas). Click save.
  - **Manage Existing Templates**: In the list below, you can view all your saved custom templates and delete them at any time.

-----

Hope this tool is helpful for you\!
