#!/bin/bash

# Local AI Chatbot Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Setting up Local AI Chatbot..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    print_status "Checking Node.js installation..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
    else
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        print_status "Visit: https://nodejs.org/"
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    print_status "Checking npm installation..."
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm is installed: $NPM_VERSION"
    else
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
}

# Check if Docker is installed (for ChromaDB)
check_docker() {
    print_status "Checking Docker installation..."
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker is installed: $DOCKER_VERSION"
        DOCKER_AVAILABLE=true
    else
        print_warning "Docker is not installed. You'll need to install ChromaDB manually."
        print_status "Visit: https://docs.docker.com/get-docker/"
        DOCKER_AVAILABLE=false
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing npm dependencies..."
    npm install
    print_success "Dependencies installed successfully"
}

# Set up environment file
setup_env() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env.local ]; then
        if [ -f env.example ]; then
            cp env.example .env.local
            print_success "Created .env.local from template"
        else
            print_error "env.example not found. Creating basic .env.local..."
            cat > .env.local << EOF
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# ChromaDB Configuration
CHROMADB_URL=http://localhost:8000
CHROMADB_COLLECTION_NAME=documents

# Embedding Configuration
EMBEDDING_MODEL=all-MiniLM-L6-v2

# n8n and Flowise Webhook URLs (optional)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/trigger-task
FLOWISE_WEBHOOK_URL=http://localhost:3000/webhook/task-complete

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
SUPPORTED_FILE_TYPES=pdf,md,txt

# Task Processing
TASK_TIMEOUT=300000
EOF
            print_success "Created basic .env.local"
        fi
    else
        print_warning ".env.local already exists. Skipping..."
    fi
}

# Start ChromaDB with Docker
start_chromadb() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        print_status "Starting ChromaDB with Docker..."
        
        # Check if ChromaDB container is already running
        if docker ps | grep -q chromadb; then
            print_success "ChromaDB is already running"
        else
            # Stop any existing ChromaDB containers
            docker stop chromadb 2>/dev/null || true
            docker rm chromadb 2>/dev/null || true
            
            # Start new ChromaDB container
            docker run -d \
                --name chromadb \
                -p 8000:8000 \
                chromadb/chroma:latest
            
            print_success "ChromaDB started on http://localhost:8000"
        fi
    else
        print_warning "Docker not available. Please start ChromaDB manually:"
        print_status "pip install chromadb && chroma run --host 0.0.0.0 --port 8000"
    fi
}

# Check Ollama installation
check_ollama() {
    print_status "Checking Ollama installation..."
    if command -v ollama &> /dev/null; then
        OLLAMA_VERSION=$(ollama --version)
        print_success "Ollama is installed: $OLLAMA_VERSION"
        
        # Check if Mistral model is available
        if ollama list | grep -q mistral; then
            print_success "Mistral model is available"
        else
            print_warning "Mistral model not found. You'll need to download it:"
            print_status "ollama pull mistral"
        fi
    else
        print_warning "Ollama is not installed. Please install it:"
        print_status "Visit: https://ollama.ai/"
        print_status "Or run: curl -fsSL https://ollama.ai/install.sh | sh"
    fi
}

# Test connections
test_connections() {
    print_status "Testing service connections..."
    
    # Test ChromaDB
    if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
        print_success "ChromaDB is responding"
    else
        print_warning "ChromaDB is not responding. Make sure it's running on port 8000"
    fi
    
    # Test Ollama
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        print_success "Ollama is responding"
    else
        print_warning "Ollama is not responding. Make sure it's running on port 11434"
    fi
}

# Show next steps
show_next_steps() {
    echo ""
    echo "🎉 Setup completed!"
    echo ""
    echo "Next steps:"
    echo "1. Start Ollama: ollama serve"
    echo "2. Download Mistral model: ollama pull mistral"
    echo "3. Start the development server: npm run dev"
    echo "4. Open http://localhost:3000 in your browser"
    echo ""
    echo "Optional:"
    echo "- Install n8n: npm install -g n8n"
    echo "- Install Flowise: npm install -g flowise"
    echo ""
    echo "For more information, see README.md"
}

# Main setup process
main() {
    echo "🤖 Local AI Chatbot Setup"
    echo "=========================="
    echo ""
    
    check_node
    check_npm
    check_docker
    install_dependencies
    setup_env
    start_chromadb
    check_ollama
    test_connections
    show_next_steps
}

# Run main function
main "$@" 