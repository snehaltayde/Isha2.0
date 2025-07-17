# Quick Start Guide

Get your local AI chatbot running in 5 minutes! 🚀

## Prerequisites

- **Node.js 18+** and **npm** - [Download here](https://nodejs.org/)
- **Docker** (for ChromaDB) - [Download here](https://docs.docker.com/get-docker/)
- **Ollama** - [Download here](https://ollama.ai/)

## 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd isha

# Run the setup script (Windows)
setup.bat

# Or run the setup script (Linux/Mac)
chmod +x setup.sh
./setup.sh
```

## 2. Start Services

### Start Ollama
```bash
# Start Ollama service
ollama serve

# In a new terminal, download Mistral model
ollama pull mistral
```

### Start ChromaDB (if not started by setup script)
```bash
# Using Docker (recommended)
docker run -p 8000:8000 chromadb/chroma:latest

# Or using pip
pip install chromadb
chroma run --host 0.0.0.0 --port 8000
```

## 3. Start the Application

```bash
# Start the development server
npm run dev
```

## 4. Open Your Browser

Navigate to [http://localhost:3000](http://localhost:3000)

## 5. Test the Chatbot

1. **Upload a document** (PDF, MD, or TXT)
2. **Ask questions** about the document content
3. **Try long-running tasks** using the yellow button

## Quick Test

1. Upload a simple text file with some content
2. Ask: "What is this document about?"
3. The chatbot should respond with relevant information from your document

## Troubleshooting

### Common Issues

**"Ollama not responding"**
- Make sure Ollama is running: `ollama serve`
- Check if Mistral is downloaded: `ollama list`

**"ChromaDB not responding"**
- Ensure Docker is running
- Check if ChromaDB container is up: `docker ps`

**"Embedding model not loading"**
- First run downloads ~90MB model
- Check your internet connection

### Get Help

- Check the full [README.md](README.md) for detailed documentation
- Review the troubleshooting section
- Check browser console for errors

## Next Steps

- Install [n8n](https://n8n.io/) for workflow automation
- Install [Flowise](https://flowiseai.com/) for visual AI flows
- Customize the system prompts in `lib/rag.js`
- Add your own documents to the knowledge base

---

**That's it! You now have a fully functional local AI chatbot with RAG capabilities! 🤖✨** 