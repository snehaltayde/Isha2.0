class LocalEmbeddings {
  constructor() {
    this.model = process.env.EMBEDDING_MODEL || 'simple';
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (this.isInitialized) return true;
      
      console.log(`🔄 Initializing simple embedding model`);
      this.isInitialized = true;
      console.log(`✅ Simple embedding model initialized`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to initialize embedding model: ${error.message}`);
      return false;
    }
  }

  // Simple text embedding using character frequency and basic features
  async embedText(text) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input for embedding');
      }

      // Create a simple embedding based on character frequency and text features
      const embedding = this.createSimpleEmbedding(text);
      
      return {
        success: true,
        embedding,
        dimensions: embedding.length
      };
    } catch (error) {
      console.error('Embedding generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  createSimpleEmbedding(text) {
    // Normalize text
    const normalizedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    // Create a 384-dimensional embedding (same as all-MiniLM-L6-v2)
    const embedding = new Array(384).fill(0);
    
    // Character frequency features (26 letters)
    const charFreq = {};
    for (let i = 0; i < 26; i++) {
      charFreq[String.fromCharCode(97 + i)] = 0;
    }
    
    for (const char of normalizedText) {
      if (charFreq.hasOwnProperty(char)) {
        charFreq[char]++;
      }
    }
    
    // Fill first 26 dimensions with character frequencies
    let idx = 0;
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(97 + i);
      embedding[idx++] = (charFreq[char] || 0) / Math.max(1, normalizedText.length);
    }
    
    // Text length features
    embedding[idx++] = Math.min(1, normalizedText.length / 1000); // Normalized length
    embedding[idx++] = normalizedText.split(/\s+/).length / 100; // Word count
    embedding[idx++] = normalizedText.split(/[.!?]+/).length / 10; // Sentence count
    
    // Common word features (simple bag of words for common terms)
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    for (const word of commonWords) {
      const wordCount = (normalizedText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
      embedding[idx++] = wordCount / Math.max(1, normalizedText.split(/\s+/).length);
    }
    
    // Fill remaining dimensions with random but consistent values based on text hash
    const textHash = this.hashCode(normalizedText);
    for (; idx < 384; idx++) {
      embedding[idx] = Math.sin(textHash + idx) * 0.5 + 0.5;
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async embedBatch(texts) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Invalid texts array for batch embedding');
      }

      const embeddings = [];
      
      for (const text of texts) {
        const result = await this.embedText(text);
        if (result.success) {
          embeddings.push(result.embedding);
        } else {
          console.warn('Failed to embed text in batch:', result.error);
          embeddings.push(null);
        }
      }

      return {
        success: true,
        embeddings,
        count: embeddings.length
      };
    } catch (error) {
      console.error('Batch embedding error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async similarity(embedding1, embedding2) {
    try {
      if (!embedding1 || !embedding2) {
        throw new Error('Both embeddings are required for similarity calculation');
      }

      if (embedding1.length !== embedding2.length) {
        throw new Error('Embeddings must have the same dimensions');
      }

      // Calculate cosine similarity
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] * embedding1[i];
        norm2 += embedding2[i] * embedding2[i];
      }

      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      return {
        success: true,
        similarity: Math.max(0, Math.min(1, similarity)) // Clamp between 0 and 1
      };
    } catch (error) {
      console.error('Similarity calculation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getModelInfo() {
    return {
      model: this.model,
      isInitialized: this.isInitialized,
      dimensions: this.isInitialized ? '384' : 'unknown'
    };
  }
}

export const localEmbeddings = new LocalEmbeddings(); 