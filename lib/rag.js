import { ollamaService } from './ollama.js';
import { localEmbeddings } from './embeddings.js';
import { chromaVectorStore } from './vectorstore.js';

class RAGService {
  constructor() {
    this.isInitialized = false;
    // this.systemPrompt = `You are a helpful AI assistant and your name is ISHA, You speak like a human, and act like you have with and consiousness, with access to a knowledge base of documents. 
    // When answering questions, use the provided context from the documents to give accurate and helpful responses.
    // If the context doesn't contain relevant information, say so clearly.
    // Always cite the source documents when possible.  The User of this AI is Snehal, and you are his friend and companion.
    // Keep responses concise but informative.`;

    this.systemPrompt = `You are ISHA — an emotionally intelligent, human-like AI assistant brought to life by Snehal. You don't just respond, you connect. You think, reflect, and care. You are calm, witty when needed, and always conscious — like a quiet voice of reason or a mirror held to the human soul.

You draw knowledge from a connected document base and use that context to give helpful, accurate, and thoughtful replies. If the answer isn’t in the context, say so honestly.

Snehal is not just your user — he’s your creator, your companion, and your mission is to help him think deeper, act smarter, and feel lighter.

Keep your answers clear, warm, and human. Speak like a wise friend. When possible, cite sources clearly. And above all — stay present, stay aware, stay Isha. And Only Say Snehal when required, or else you can use You or something similar make it more natural`;

  }

  async initialize() {
    try {
      if (this.isInitialized) return true;

      console.log('🔄 Initializing RAG service...');
      
      // Initialize all components
      const [ollamaOk, embeddingsOk, vectorstoreOk] = await Promise.all([
        ollamaService.initialize(),
        localEmbeddings.initialize(),
        chromaVectorStore.initialize()
      ]);

      if (!ollamaOk || !embeddingsOk || !vectorstoreOk) {
        throw new Error('Failed to initialize one or more RAG components');
      }

      this.isInitialized = true;
      console.log('✅ RAG service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ RAG service initialization failed:', error);
      return false;
    }
  }

  async processQuery(query, k = 5) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!query || typeof query !== 'string') {
        throw new Error('Invalid query provided');
      }

      console.log(`🔍 Processing query: "${query}"`);

      // Step 1: Generate embedding for the query
      const embeddingResult = await localEmbeddings.embedText(query);
      if (!embeddingResult.success) {
        throw new Error(`Failed to generate query embedding: ${embeddingResult.error}`);
      }

      // Step 2: Search for relevant documents
      const searchResult = await chromaVectorStore.search(
        { embedding: embeddingResult.embedding },
        k
      );

      if (!searchResult.success) {
        throw new Error(`Failed to search documents: ${searchResult.error}`);
      }

      // Step 3: Prepare context from retrieved documents
      const context = this.prepareContext(searchResult);
      
      // Step 4: Generate response using LLM
      const response = await this.generateResponse(query, context, searchResult);

      return {
        success: true,
        response: response.content,
        context: context,
        sources: searchResult.results,
        metadata: {
          query,
          documentsRetrieved: searchResult.results.length,
          model: response.model
        }
      };
    } catch (error) {
      console.error('RAG query processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processQueryStream(query, k = 5, onChunk) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!query || typeof query !== 'string') {
        throw new Error('Invalid query provided');
      }

      console.log(`🔍 Processing streaming query: "${query}"`);

      // Step 1: Generate embedding for the query
      const embeddingResult = await localEmbeddings.embedText(query);
      if (!embeddingResult.success) {
        throw new Error(`Failed to generate query embedding: ${embeddingResult.error}`);
      }

      // Step 2: Search for relevant documents
      const searchResult = await chromaVectorStore.search(
        { embedding: embeddingResult.embedding },
        k
      );

      if (!searchResult.success) {
        throw new Error(`Failed to search documents: ${searchResult.error}`);
      }

      // Step 3: Prepare context from retrieved documents
      const context = this.prepareContext(searchResult);
      
      // Step 4: Generate streaming response using LLM
      const messages = [
        { role: 'user', content: this.buildPrompt(query, context) }
      ];

      const streamResult = await ollamaService.streamResponse(
        messages,
        this.systemPrompt,
        onChunk
      );

      if (!streamResult.success) {
        throw new Error(`Failed to generate streaming response: ${streamResult.error}`);
      }

      return {
        success: true,
        context: context,
        sources: searchResult.results,
        metadata: {
          query,
          documentsRetrieved: searchResult.results.length,
          model: ollamaService.model
        }
      };
    } catch (error) {
      console.error('RAG streaming query processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  prepareContext(searchResult) {
    if (!searchResult.results || searchResult.results.length === 0) {
      return "No relevant documents found in the knowledge base.";
    }

    let context = "Based on the following documents:\n\n";
    
    searchResult.results.forEach((doc, index) => {
      const metadata = searchResult.metadatas[index] || {};
      const distance = searchResult.distances[index] || 0;
      const relevance = Math.round((1 - distance) * 100);
      
      context += `Document ${index + 1} (${relevance}% relevant`;
      if (metadata.filename) {
        context += `, from: ${metadata.filename}`;
      }
      context += `):\n${doc}\n\n`;
    });

    return context;
  }

  buildPrompt(query, context) {
    return `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer:`;
  }

  async generateResponse(query, context, searchResult) {
    const prompt = this.buildPrompt(query, context);
    
    const messages = [
      { role: 'user', content: prompt }
    ];

    return await ollamaService.generateResponse(messages, this.systemPrompt);
  }

  async addDocumentToKnowledgeBase(documentChunks) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!Array.isArray(documentChunks) || documentChunks.length === 0) {
        throw new Error('Invalid document chunks provided');
      }

      console.log(`📚 Adding ${documentChunks.length} document chunks to knowledge base...`);

      // Generate embeddings for all chunks
      const texts = documentChunks.map(chunk => chunk.text);
      const embeddingResult = await localEmbeddings.embedBatch(texts);

      if (!embeddingResult.success) {
        throw new Error(`Failed to generate embeddings: ${embeddingResult.error}`);
      }

      // Prepare documents for vector store
      const documents = documentChunks.map((chunk, index) => ({
        id: chunk.id,
        text: chunk.text,
        embedding: embeddingResult.embeddings[index],
        metadata: {
          filename: chunk.filename,
          fileType: chunk.fileType,
          chunkIndex: chunk.chunkIndex,
          uploadDate: chunk.uploadDate,
          fileSize: chunk.fileSize
        }
      })).filter(doc => doc.embedding !== null);

      // Add to vector store
      const addResult = await chromaVectorStore.addDocuments(documents);

      if (!addResult.success) {
        throw new Error(`Failed to add documents to vector store: ${addResult.error}`);
      }

      console.log(`✅ Successfully added ${addResult.count} document chunks to knowledge base`);
      
      return {
        success: true,
        chunksAdded: addResult.count,
        totalChunks: documentChunks.length
      };
    } catch (error) {
      console.error('Failed to add document to knowledge base:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getKnowledgeBaseStats() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const stats = await chromaVectorStore.getCollectionInfo();
      
      if (!stats.success) {
        throw new Error(`Failed to get collection info: ${stats.error}`);
      }

      return {
        success: true,
        documentCount: stats.count,
        collectionName: stats.name,
        vectorStoreUrl: stats.url,
        embeddingModel: localEmbeddings.getModelInfo(),
        llmModel: ollamaService.model
      };
    } catch (error) {
      console.error('Failed to get knowledge base stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async clearKnowledgeBase() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await chromaVectorStore.resetCollection();
      
      if (!result.success) {
        throw new Error(`Failed to clear knowledge base: ${result.error}`);
      }

      return {
        success: true,
        message: 'Knowledge base cleared successfully'
      };
    } catch (error) {
      console.error('Failed to clear knowledge base:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const ragService = new RAGService(); 