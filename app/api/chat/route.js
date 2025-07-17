import { NextResponse } from 'next/server';
import { ragService } from '../../../lib/rag.js';
import { webhookService } from '../../../lib/webhooks.js';

export async function POST(request) {
  try {
    const { message, taskType, stream = false } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Check if this is a long-running task
    if (taskType === 'long-running') {
      return await handleLongRunningTask(message);
    }

    // Handle immediate chat response
    if (stream) {
      return await handleStreamingChat(message);
    } else {
      return await handleImmediateChat(message);
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

async function handleImmediateChat(message) {
  try {
    const result = await ragService.processQuery(message);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to process query', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      response: result.response,
      sources: result.sources,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Immediate chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process immediate chat', details: error.message },
      { status: 500 }
    );
  }
}

async function handleStreamingChat(message) {
  try {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          
          const onChunk = (chunk) => {
            fullResponse += chunk;
            const data = JSON.stringify({ chunk, type: 'chunk' });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          };

          const result = await ragService.processQueryStream(message, 5, onChunk);
          
          if (!result.success) {
            const errorData = JSON.stringify({ 
              error: result.error, 
              type: 'error' 
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          } else {
            const completeData = JSON.stringify({ 
              type: 'complete',
              sources: result.sources,
              metadata: result.metadata
            });
            controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));
          }
        } catch (error) {
          const errorData = JSON.stringify({ 
            error: error.message, 
            type: 'error' 
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Streaming chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process streaming chat', details: error.message },
      { status: 500 }
    );
  }
}

async function handleLongRunningTask(message) {
  try {
    // Immediately return "Processing started" response
    const taskData = {
      message,
      timestamp: new Date().toISOString(),
      type: 'long-running-task'
    };

    // Start the long-running task in the background
    webhookService.processLongRunningTask(taskData, (progress) => {
      console.log('Task progress:', progress);
      // In a real implementation, you might send this via WebSocket
      // or store it in a database for the client to poll
    }).catch(error => {
      console.error('Background task error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Processing started...',
      taskId: taskData.taskId || webhookService.generateTaskId(),
      status: 'processing'
    });
  } catch (error) {
    console.error('Long running task error:', error);
    return NextResponse.json(
      { error: 'Failed to start long-running task', details: error.message },
      { status: 500 }
    );
  }
} 