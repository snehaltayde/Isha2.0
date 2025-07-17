'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, Bot, User, Loader2, AlertCircle, CheckCircle, X, MessageSquare, Trash2 } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    ollama: false,
    chromadb: false,
    embeddings: false
  });
  const [showUpload, setShowUpload] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const savedConversations = localStorage.getItem('isha-conversations');
    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          setCurrentConversationId(parsed[0].id);
          setMessages(parsed[0].messages || []);
        } else {
          // Create initial conversation if none exists
          createNewConversation();
        }
      } catch (error) {
        console.error('Error parsing saved conversations:', error);
        createNewConversation();
      }
    } else {
      // Create initial conversation if no saved data
      createNewConversation();
    }
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('isha-conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check system status on mount
  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/ingest');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSystemStatus({
            ollama: true,
            chromadb: true,
            embeddings: true
          });
        }
      }
    } catch (error) {
      console.error('Failed to check system status:', error);
    }
  };

  const createNewConversation = () => {
    const newConversation = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString()
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    setMessages([]);
    setShowHistory(false);
  };

  const loadConversation = (conversationId) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setCurrentConversationId(conversationId);
      setMessages(conversation.messages || []);
      setShowHistory(false);
    }
  };

  const deleteConversation = (conversationId) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== conversationId);
      if (filtered.length === 0) {
        // Create a new conversation if all are deleted
        const newConversation = {
          id: Date.now().toString(),
          title: 'New Conversation',
          messages: [],
          createdAt: new Date().toISOString()
        };
        setCurrentConversationId(newConversation.id);
        setMessages([]);
        return [newConversation];
      }
      return filtered;
    });
    
    if (currentConversationId === conversationId) {
      const remainingConversations = conversations.filter(c => c.id !== conversationId);
      if (remainingConversations.length > 0) {
        loadConversation(remainingConversations[0].id);
      }
    }
  };

  const saveMessagesToConversation = (newMessages) => {
    if (!currentConversationId) {
      createNewConversation();
      return;
    }

    setConversations(prev => prev.map(c => {
      if (c.id === currentConversationId) {
        // Handle both array and function parameters
        const messagesToSave = typeof newMessages === 'function' ? newMessages(c.messages || []) : newMessages;
        const updatedConversation = { ...c, messages: messagesToSave };
        // Update title based on first user message
        if (messagesToSave.length > 0 && messagesToSave[0].type === 'user') {
          const title = messagesToSave[0].content.slice(0, 50) + (messagesToSave[0].content.length > 50 ? '...' : '');
          updatedConversation.title = title;
        }
        return updatedConversation;
      }
      return c;
    }));
  };

  const handleSendMessage = async (message, taskType = 'immediate') => {
    if (!message.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    saveMessagesToConversation(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      if (taskType === 'long-running') {
        await handleLongRunningTask(message);
      } else {
        await handleStreamingChat(message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addErrorMessage('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStreamingChat = async (message) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        sources: []
      };

      setMessages(prev => [...prev, assistantMessage]);
      saveMessagesToConversation(prev => [...prev, assistantMessage]);
      setIsStreaming(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                assistantMessage.content += data.chunk;
                setMessages(prev => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1] = { ...assistantMessage };
                  }
                  return updated;
                });
                saveMessagesToConversation(prev => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1] = { ...assistantMessage };
                  }
                  return updated;
                });
              } else if (data.type === 'complete') {
                assistantMessage.sources = data.sources || [];
                assistantMessage.metadata = data.metadata;
                setMessages(prev => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1] = { ...assistantMessage };
                  }
                  return updated;
                });
                saveMessagesToConversation(prev => {
                  const updated = [...prev];
                  if (updated.length > 0) {
                    updated[updated.length - 1] = { ...assistantMessage };
                  }
                  return updated;
                });
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming chat error:', error);
      addErrorMessage('Failed to get streaming response. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleLongRunningTask = async (message) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          taskType: 'long-running'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start task');
      }

      const data = await response.json();
      
      if (data.success) {
        const assistantMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString(),
          taskId: data.taskId,
          status: data.status
        };

        setMessages(prev => [...prev, assistantMessage]);
        saveMessagesToConversation(prev => [...prev, assistantMessage]);
        
        // In a real implementation, you would poll for task completion
        // or use WebSockets to get real-time updates
        setTimeout(() => {
          updateTaskStatus(data.taskId, 'completed', 'Task completed successfully!');
        }, 5000);
      }
    } catch (error) {
      console.error('Long running task error:', error);
      addErrorMessage('Failed to start long-running task. Please try again.');
    }
  };

  const updateTaskStatus = (taskId, status, message) => {
    setMessages(prev => prev.map(msg => 
      msg.taskId === taskId 
        ? { ...msg, status, content: message }
        : msg
    ));
    saveMessagesToConversation(prev => prev.map(msg => 
      msg.taskId === taskId 
        ? { ...msg, status, content: message }
        : msg
    ));
  };

  const addErrorMessage = (errorMessage) => {
    const errorMsg = {
      id: Date.now(),
      type: 'error',
      content: errorMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, errorMsg]);
    saveMessagesToConversation(prev => [...prev, errorMsg]);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileUploading(true);
    setUploadStatus({ type: 'uploading', message: 'Uploading file...' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadStatus({
          type: 'success',
          message: `File uploaded successfully! Processed ${data.chunksProcessed} chunks.`
        });
        setTimeout(() => setUploadStatus(null), 5000);
      } else {
        setUploadStatus({
          type: 'error',
          message: data.error || 'Upload failed'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: 'Upload failed. Please try again.'
      });
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  const clearChat = () => {
    setMessages([]);
    if (currentConversationId) {
      setConversations(prev => prev.map(c => 
        c.id === currentConversationId ? { ...c, messages: [] } : c
      ));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image src="/image.png" alt="Isha" width={60} height={60} className="rounded-lg" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Isha</h1>
              <p className="text-sm text-gray-500">A Mediastic Creation</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* System Status - Hidden on mobile */}
            <div className="hidden md:flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${systemStatus.ollama ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">Ollama</span>
              <div className={`w-2 h-2 rounded-full ${systemStatus.chromadb ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">ChromaDB</span>
              <div className={`w-2 h-2 rounded-full ${systemStatus.embeddings ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">Embeddings</span>
            </div>
            
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </button>
            
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </button>
            
            <button
              onClick={clearChat}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Conversation History Sidebar */}
      {showHistory && (
        <div className="bg-white border-b px-4 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Conversation History</h3>
              <button
                onClick={createNewConversation}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                New Chat
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentConversationId === conversation.id
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => loadConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {conversation.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(conversation.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {conversation.messages?.length || 0} messages
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conversation.id);
                      }}
                      className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* File Upload Section */}
      {showUpload && (
        <div className="bg-white border-b px-4 py-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.md,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={fileUploading}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {fileUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                <span>{fileUploading ? 'Uploading...' : 'Choose File'}</span>
              </button>
              
              {uploadStatus && (
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                  uploadStatus.type === 'success' ? 'bg-green-100 text-green-700' :
                  uploadStatus.type === 'error' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {uploadStatus.type === 'success' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : uploadStatus.type === 'error' ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <span className="text-sm">{uploadStatus.message}</span>
                  <button
                    onClick={() => setUploadStatus(null)}
                    className="ml-2 hover:opacity-70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Local AI Chatbot</h3>
              <p className="text-gray-500 mb-4">
                Upload documents and ask questions. I&apos;ll use RAG to provide accurate answers.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 text-sm text-gray-400">
                <span>• Powered by Ollama (Mistral)</span>
                <span>• Vector search with ChromaDB</span>
                <span>• Local embeddings</span>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85vw] sm:max-w-3xl px-4 py-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.type === 'error'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-white text-gray-900 border'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.type === 'user' ? (
                      <User className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    ) : message.type === 'assistant' ? (
                      <Bot className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Sources:</p>
                          <div className="space-y-1">
                            {message.sources.map((source, index) => (
                              <div key={index} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                Document {index + 1}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {message.taskId && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">Task ID: {message.taskId}</span>
                            {message.status === 'processing' && (
                              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                            )}
                            {message.status === 'completed' && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && !isStreaming && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-900 border px-4 py-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-end space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question or type a message..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                rows="1"
                disabled={isLoading || isStreaming}
                style={{ color: '#111827' }}
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => handleSendMessage(inputMessage, 'long-running')}
                disabled={!inputMessage.trim() || isLoading || isStreaming}
                className="px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send as long-running task"
              >
                <Loader2 className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => handleSendMessage(inputMessage)}
                disabled={!inputMessage.trim() || isLoading || isStreaming}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            Press Enter to send, Shift+Enter for new line. Use the yellow button for long-running tasks.
          </div>
        </div>
      </div>
    </div>
  );
}
