# Local AI Chatbot with RAG

A fully local AI chatbot application built with Next.js 14, featuring Retrieval-Augmented Generation (RAG) using Ollama, ChromaDB, and local embeddings. The app supports document uploads, streaming responses, and integration with n8n and Flowise for long-running tasks.

## 🚀 Features

- **Local LLM Inference**: Powered by Ollama with Mistral model
- **Vector Database**: ChromaDB for document storage and retrieval
- **Local Embeddings**: Using @xenova/transformers (no cloud services)
- **Document Support**: PDF, Markdown, and TXT file uploads
- **Streaming Responses**: Real-time chat with Server-Sent Events
- **Long-running Tasks**: Integration with n8n and Flowise via webhooks
- **Modern UI**: Clean, responsive interface with Tailwind CSS
- **RAG Pipeline**: Complete document ingestion and retrieval system

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Next.js API   │    │   External      │
│   (React)       │◄──►│   Routes        │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Utilities     │    │   RAG Service   │    │   Vector Store  │
│   • Ollama      │◄──►│   • Query       │◄──►│   • ChromaDB    │
│   • Embeddings  │    │   • Document    │    │   • REST API    │
│   • Parsers     │    │   • Streaming   │    │   • Local       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
isha/
├── app/
│   ├── api/
│   │   ├── chat/route.js          # Chat API with streaming
│   │   ├── upload/route.js        # File upload handling
│   │   ├── ingest/route.js        # Document ingestion
│   │   ├── trigger-task/route.js  # n8n webhook trigger
│   │   └── task-complete/route.js # Flowise webhook callback
│   ├── page.js                    # Main chat interface
│   ├── layout.js                  # App layout
│   └── globals.css                # Global styles
├── lib/
│   ├── ollama.js                  # Ollama LLM integration
│   ├── embeddings.js              # Local embedding service
│   ├── vectorstore.js             # ChromaDB integration
│   ├── rag.js                     # RAG pipeline service
│   ├── webhooks.js                # n8n/Flowise integration
│   ├── parse-pdf.js               # PDF parsing utilities
│   └── parse-documents.js         # Document parsing service
├── public/                        # Static assets
├── env.example                    # Environment variables template
├── package.json                   # Dependencies
└── README.md                      # This file
```

## 🛠️ Prerequisites

Before running this application, you need to install and configure:

### 1. Ollama
```bash
# Install Ollama (https://ollama.ai)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull Mistral model
ollama pull mistral

# Start Ollama service
ollama serve
```

### 2. ChromaDB
```bash
# Using Docker (recommended)
docker run -p 8000:8000 chromadb/chroma:latest

# Or using pip
pip install chromadb
chroma run --host 0.0.0.0 --port 8000
```

### 3. Node.js
```bash
# Install Node.js 18+ and npm
node --version  # Should be 18+
npm --version   # Should be 9+
```

## 🚀 Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd isha
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp env.example .env.local
```

Edit `.env.local` with your configuration:
```env
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
```

4. **Start the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## 📚 Usage

### Basic Chat
1. Open the application in your browser
2. Type your question in the input field
3. Press Enter or click the Send button
4. The chatbot will respond using RAG with your uploaded documents

### Document Upload
1. Click the "Upload" button in the header
2. Select a PDF, Markdown, or TXT file
3. The document will be processed and added to the knowledge base
4. You can now ask questions about the uploaded content

### Long-running Tasks
1. Type your message
2. Click the yellow button (with loader icon) instead of the blue send button
3. The system will immediately respond with "Processing started..."
4. The task will be processed in the background via n8n/Flowise
5. You'll be notified when the task completes

### Streaming Responses
- Regular chat messages use streaming responses for real-time interaction
- You'll see the response being generated word by word

## 🔧 API Endpoints

### Chat API
- `POST /api/chat` - Send a message and get a response
- Supports streaming and long-running tasks

### Upload API
- `POST /api/upload` - Upload and process documents
- `GET /api/upload` - Get upload configuration

### Ingest API
- `POST /api/ingest` - Bulk document operations
- `GET /api/ingest` - Get knowledge base statistics

### Webhook APIs
- `POST /api/trigger-task` - Trigger n8n workflows
- `POST /api/task-complete` - Receive Flowise callbacks

## 🔌 Integration with n8n and Flowise

### n8n Setup
1. Install n8n: `npm install -g n8n`
2. Start n8n: `n8n start`
3. Create a webhook trigger node
4. Configure the webhook URL in your `.env.local`

### Flowise Setup
1. Install Flowise: `npm install -g flowise`
2. Start Flowise: `flowise start`
3. Create a webhook node
4. Configure the webhook URL in your `.env.local`

## 🧪 Testing

### Test Ollama Connection
```bash
curl http://localhost:11434/api/tags
```

### Test ChromaDB Connection
```bash
curl http://localhost:8000/api/v1/heartbeat
```

### Test the Application
1. Upload a test document
2. Ask questions about the document content
3. Verify that responses are relevant and accurate

## 🔍 Troubleshooting

### Common Issues

**Ollama not responding**
- Check if Ollama is running: `ollama list`
- Verify the model is downloaded: `ollama pull mistral`
- Check the base URL in `.env.local`

**ChromaDB connection failed**
- Ensure ChromaDB is running on port 8000
- Check Docker container status: `docker ps`
- Verify the URL in `.env.local`

**Embedding model not loading**
- The first run will download the model (~90MB)
- Check your internet connection
- Verify the model name in `.env.local`

**File upload issues**
- Check file size limits in `.env.local`
- Verify supported file types
- Check browser console for errors

### Logs and Debugging
- Check browser console for frontend errors
- Monitor terminal output for backend errors
- Use browser dev tools to inspect network requests

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables for Production
- Set all environment variables in your hosting platform
- Ensure Ollama and ChromaDB are accessible
- Configure proper CORS settings if needed

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai) for local LLM inference
- [ChromaDB](https://www.trychroma.com/) for vector database
- [LangChain.js](https://js.langchain.com/) for RAG pipeline
- [@xenova/transformers](https://github.com/xenova/transformers.js) for local embeddings
- [Next.js](https://nextjs.org/) for the framework
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section
2. Review the logs and error messages
3. Open an issue on GitHub
4. Check the documentation for each component

---

**Happy chatting with your local AI! 🤖✨**
