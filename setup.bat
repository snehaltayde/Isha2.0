@echo off
setlocal enabledelayedexpansion

echo 🚀 Setting up Local AI Chatbot...

REM Check if Node.js is installed
echo [INFO] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ first.
    echo [INFO] Visit: https://nodejs.org/
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [SUCCESS] Node.js is installed: !NODE_VERSION!
)

REM Check if npm is installed
echo [INFO] Checking npm installation...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm first.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo [SUCCESS] npm is installed: !NPM_VERSION!
)

REM Check if Docker is installed
echo [INFO] Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker is not installed. You'll need to install ChromaDB manually.
    echo [INFO] Visit: https://docs.docker.com/get-docker/
    set DOCKER_AVAILABLE=false
) else (
    for /f "tokens=*" %%i in ('docker --version') do set DOCKER_VERSION=%%i
    echo [SUCCESS] Docker is installed: !DOCKER_VERSION!
    set DOCKER_AVAILABLE=true
)

REM Install dependencies
echo [INFO] Installing npm dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
) else (
    echo [SUCCESS] Dependencies installed successfully
)

REM Set up environment file
echo [INFO] Setting up environment configuration...
if not exist .env.local (
    if exist env.example (
        copy env.example .env.local >nul
        echo [SUCCESS] Created .env.local from template
    ) else (
        echo [ERROR] env.example not found. Creating basic .env.local...
        (
            echo # Ollama Configuration
            echo OLLAMA_BASE_URL=http://localhost:11434
            echo OLLAMA_MODEL=mistral
            echo.
            echo # ChromaDB Configuration
            echo CHROMADB_URL=http://localhost:8000
            echo CHROMADB_COLLECTION_NAME=documents
            echo.
            echo # Embedding Configuration
            echo EMBEDDING_MODEL=all-MiniLM-L6-v2
            echo.
            echo # n8n and Flowise Webhook URLs ^(optional^)
            echo N8N_WEBHOOK_URL=http://localhost:5678/webhook/trigger-task
            echo FLOWISE_WEBHOOK_URL=http://localhost:3000/webhook/task-complete
            echo.
            echo # Application Configuration
            echo NEXT_PUBLIC_APP_URL=http://localhost:3000
            echo MAX_FILE_SIZE=10485760
            echo SUPPORTED_FILE_TYPES=pdf,md,txt
            echo.
            echo # Task Processing
            echo TASK_TIMEOUT=300000
        ) > .env.local
        echo [SUCCESS] Created basic .env.local
    )
) else (
    echo [WARNING] .env.local already exists. Skipping...
)

REM Start ChromaDB with Docker
if "%DOCKER_AVAILABLE%"=="true" (
    echo [INFO] Starting ChromaDB with Docker...
    
    REM Check if ChromaDB container is already running
    docker ps | findstr chromadb >nul 2>&1
    if %errorlevel% equ 0 (
        echo [SUCCESS] ChromaDB is already running
    ) else (
        REM Stop any existing ChromaDB containers
        docker stop chromadb >nul 2>&1
        docker rm chromadb >nul 2>&1
        
        REM Start new ChromaDB container
        docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
        if %errorlevel% equ 0 (
            echo [SUCCESS] ChromaDB started on http://localhost:8000
        ) else (
            echo [ERROR] Failed to start ChromaDB
        )
    )
) else (
    echo [WARNING] Docker not available. Please start ChromaDB manually:
    echo [INFO] pip install chromadb ^&^& chroma run --host 0.0.0.0 --port 8000
)

REM Check Ollama installation
echo [INFO] Checking Ollama installation...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Ollama is not installed. Please install it:
    echo [INFO] Visit: https://ollama.ai/
    echo [INFO] Or run: curl -fsSL https://ollama.ai/install.sh ^| sh
) else (
    for /f "tokens=*" %%i in ('ollama --version') do set OLLAMA_VERSION=%%i
    echo [SUCCESS] Ollama is installed: !OLLAMA_VERSION!
    
    REM Check if Mistral model is available
    ollama list | findstr mistral >nul 2>&1
    if %errorlevel% equ 0 (
        echo [SUCCESS] Mistral model is available
    ) else (
        echo [WARNING] Mistral model not found. You'll need to download it:
        echo [INFO] ollama pull mistral
    )
)

REM Test connections
echo [INFO] Testing service connections...

REM Test ChromaDB
curl -s http://localhost:8000/api/v1/heartbeat >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] ChromaDB is responding
) else (
    echo [WARNING] ChromaDB is not responding. Make sure it's running on port 8000
)

REM Test Ollama
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Ollama is responding
) else (
    echo [WARNING] Ollama is not responding. Make sure it's running on port 11434
)

REM Show next steps
echo.
echo 🎉 Setup completed!
echo.
echo Next steps:
echo 1. Start Ollama: ollama serve
echo 2. Download Mistral model: ollama pull mistral
echo 3. Start the development server: npm run dev
echo 4. Open http://localhost:3000 in your browser
echo.
echo Optional:
echo - Install n8n: npm install -g n8n
echo - Install Flowise: npm install -g flowise
echo.
echo For more information, see README.md
echo.
pause 