class OllamaService {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'mistral';
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Test connection by listing models
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }
      
      this.isInitialized = true;
      console.log(`✅ Ollama connected with model: ${this.model}`);
      return true;
    } catch (error) {
      console.error(`❌ Ollama connection failed: ${error.message}`);
      return false;
    }
  }

  async generateResponse(messages, systemPrompt = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Format messages for Ollama API
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      if (systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          stream: false,
          options: {
            temperature: 0.7
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.message.content,
        model: this.model
      };
    } catch (error) {
      console.error('Ollama generation error:', error);
      return {
        success: false,
        error: error.message,
        model: this.model
      };
    }
  }

  async streamResponse(messages, systemPrompt = null, onChunk) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Format messages for Ollama API
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      if (systemPrompt) {
        formattedMessages.unshift({
          role: 'system',
          content: systemPrompt
        });
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: formattedMessages,
          stream: true,
          options: {
            temperature: 0.7
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            try {
              const data = JSON.parse(line);
              if (data.message && data.message.content && onChunk) {
                onChunk(data.message.content);
              }
            } catch (parseError) {
              console.error('Error parsing Ollama stream:', parseError);
            }
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Ollama streaming error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }
      
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const ollamaService = new OllamaService(); 