import axios from 'axios';

class WebhookService {
  constructor() {
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    this.flowiseWebhookUrl = process.env.FLOWISE_WEBHOOK_URL;
    this.taskTimeout = parseInt(process.env.TASK_TIMEOUT) || 300000; // 5 minutes default
  }

  async triggerN8nTask(taskData) {
    try {
      if (!this.n8nWebhookUrl) {
        throw new Error('N8N webhook URL not configured');
      }

      const payload = {
        timestamp: new Date().toISOString(),
        taskId: taskData.taskId || this.generateTaskId(),
        type: 'task_trigger',
        data: taskData,
        source: 'chatbot'
      };

      console.log(`🔄 Triggering N8N task: ${payload.taskId}`);

      const response = await axios.post(this.n8nWebhookUrl, payload, {
        timeout: 10000, // 10 second timeout for webhook call
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ N8N task triggered successfully: ${payload.taskId}`);
        return {
          success: true,
          taskId: payload.taskId,
          response: response.data
        };
      } else {
        throw new Error(`N8N webhook returned status: ${response.status}`);
      }
    } catch (error) {
      console.error('N8N webhook error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async notifyFlowiseTaskComplete(taskResult) {
    try {
      if (!this.flowiseWebhookUrl) {
        throw new Error('Flowise webhook URL not configured');
      }

      const payload = {
        timestamp: new Date().toISOString(),
        taskId: taskResult.taskId,
        type: 'task_complete',
        status: taskResult.status || 'completed',
        data: taskResult.data,
        metadata: taskResult.metadata || {},
        source: 'chatbot'
      };

      console.log(`📤 Notifying Flowise of task completion: ${payload.taskId}`);

      const response = await axios.post(this.flowiseWebhookUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status >= 200 && response.status < 300) {
        console.log(`✅ Flowise notification sent successfully: ${payload.taskId}`);
        return {
          success: true,
          taskId: payload.taskId,
          response: response.data
        };
      } else {
        throw new Error(`Flowise webhook returned status: ${response.status}`);
      }
    } catch (error) {
      console.error('Flowise webhook error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processLongRunningTask(taskData, onProgress) {
    try {
      // Step 1: Trigger the task in N8N
      const triggerResult = await this.triggerN8nTask(taskData);
      
      if (!triggerResult.success) {
        throw new Error(`Failed to trigger task: ${triggerResult.error}`);
      }

      const taskId = triggerResult.taskId;

      // Step 2: Poll for task completion (simplified - in real implementation, 
      // you might use WebSockets or server-sent events)
      const startTime = Date.now();
      let taskCompleted = false;
      let result = null;

      while (!taskCompleted && (Date.now() - startTime) < this.taskTimeout) {
        // Simulate polling - in real implementation, you'd check task status
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        // For demo purposes, we'll simulate task completion after 5 seconds
        if (Date.now() - startTime > 5000) {
          taskCompleted = true;
          result = {
            taskId,
            status: 'completed',
            data: {
              message: 'Task completed successfully',
              processedData: taskData
            },
            metadata: {
              processingTime: Date.now() - startTime,
              completedAt: new Date().toISOString()
            }
          };
        }

        // Call progress callback if provided
        if (onProgress) {
          onProgress({
            taskId,
            status: taskCompleted ? 'completed' : 'processing',
            progress: Math.min(100, ((Date.now() - startTime) / 5000) * 100)
          });
        }
      }

      if (!taskCompleted) {
        throw new Error('Task timeout exceeded');
      }

      // Step 3: Notify Flowise of task completion
      const notifyResult = await this.notifyFlowiseTaskComplete(result);
      
      if (!notifyResult.success) {
        console.warn(`Failed to notify Flowise: ${notifyResult.error}`);
      }

      return {
        success: true,
        taskId,
        result,
        flowiseNotified: notifyResult.success
      };
    } catch (error) {
      console.error('Long running task error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async checkWebhookHealth() {
    const health = {
      n8n: false,
      flowise: false
    };

    try {
      if (this.n8nWebhookUrl) {
        const response = await axios.get(this.n8nWebhookUrl.replace('/webhook/', '/health/'), {
          timeout: 5000
        });
        health.n8n = response.status === 200;
      }
    } catch (error) {
      console.warn('N8N health check failed:', error.message);
    }

    try {
      if (this.flowiseWebhookUrl) {
        const response = await axios.get(this.flowiseWebhookUrl.replace('/webhook/', '/health/'), {
          timeout: 5000
        });
        health.flowise = response.status === 200;
      }
    } catch (error) {
      console.warn('Flowise health check failed:', error.message);
    }

    return health;
  }

  getWebhookConfig() {
    return {
      n8nUrl: this.n8nWebhookUrl,
      flowiseUrl: this.flowiseWebhookUrl,
      taskTimeout: this.taskTimeout
    };
  }
}

export const webhookService = new WebhookService(); 