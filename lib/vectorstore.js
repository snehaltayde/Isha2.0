import { ChromaClient } from 'chromadb';

class ChromaVectorStore {
  constructor() {
    this.client = null;
    this.collection = null;
    this.collectionName = process.env.CHROMADB_COLLECTION_NAME || 'documents';
    this.baseUrl = process.env.CHROMADB_URL || 'http://localhost:8000';
  }

  async initialize() {
    try {
      this.client = new ChromaClient({
        path: this.baseUrl
      });

      // Check if collection exists, create if not
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName
        });
        console.log(`✅ Connected to existing ChromaDB collection: ${this.collectionName}`);
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: {
            description: "Document embeddings for RAG chatbot"
          }
        });
        console.log(`✅ Created new ChromaDB collection: ${this.collectionName}`);
      }

      return true;
    } catch (error) {
      console.error(`❌ ChromaDB initialization failed: ${error.message}`);
      return false;
    }
  }

  async addDocuments(documents) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!Array.isArray(documents) || documents.length === 0) {
        throw new Error('Invalid documents array');
      }

      const ids = [];
      const texts = [];
      const metadatas = [];
      const embeddings = [];

      for (const doc of documents) {
        if (!doc.id || !doc.text || !doc.embedding) {
          console.warn('Skipping invalid document:', doc);
          continue;
        }

        ids.push(doc.id);
        texts.push(doc.text);
        metadatas.push(doc.metadata || {});
        embeddings.push(doc.embedding);
      }

      if (ids.length === 0) {
        throw new Error('No valid documents to add');
      }

      await this.collection.add({
        ids,
        documents: texts,
        metadatas,
        embeddings
      });

      console.log(`✅ Added ${ids.length} documents to ChromaDB`);
      return {
        success: true,
        count: ids.length
      };
    } catch (error) {
      console.error('ChromaDB add documents error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async search(query, k = 5, filter = null) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!query || !query.embedding) {
        throw new Error('Query must include embedding');
      }

      const searchParams = {
        queryEmbeddings: [query.embedding],
        nResults: k
      };

      if (filter) {
        searchParams.where = filter;
      }

      const results = await this.collection.query(searchParams);

      return {
        success: true,
        results: results.documents[0] || [],
        metadatas: results.metadatas[0] || [],
        distances: results.distances[0] || [],
        ids: results.ids[0] || []
      };
    } catch (error) {
      console.error('ChromaDB search error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteDocuments(ids) {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error('Invalid IDs array');
      }

      await this.collection.delete({
        ids
      });

      console.log(`✅ Deleted ${ids.length} documents from ChromaDB`);
      return {
        success: true,
        count: ids.length
      };
    } catch (error) {
      console.error('ChromaDB delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCollectionInfo() {
    try {
      if (!this.collection) {
        await this.initialize();
      }

      const count = await this.collection.count();
      return {
        success: true,
        name: this.collectionName,
        count,
        url: this.baseUrl
      };
    } catch (error) {
      console.error('ChromaDB info error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/heartbeat`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async resetCollection() {
    try {
      if (this.collection) {
        await this.client.deleteCollection({
          name: this.collectionName
        });
      }
      
      this.collection = null;
      await this.initialize();
      
      return {
        success: true,
        message: 'Collection reset successfully'
      };
    } catch (error) {
      console.error('ChromaDB reset error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const chromaVectorStore = new ChromaVectorStore(); 