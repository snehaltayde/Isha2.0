import { NextResponse } from 'next/server';
import { webhookService } from '../../../lib/webhooks.js';

export async function POST(request) {
  try {
    const taskResult = await request.json();

    if (!taskResult || !taskResult.taskId) {
      return NextResponse.json(
        { error: 'Task result with taskId is required' },
        { status: 400 }
      );
    }

    // Log the task completion
    console.log(`📥 Received task completion for: ${taskResult.taskId}`, taskResult);

    // Store task result (in a real implementation, you might store this in a database)
    // For now, we'll just log it and return success
    
    // You could also trigger notifications, update UI, etc.
    // For example, you might want to send a WebSocket message to the client
    // or update a task status in your database

    return NextResponse.json({
      success: true,
      message: 'Task completion received successfully',
      taskId: taskResult.taskId
    });

  } catch (error) {
    console.error('Task complete API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return task completion endpoint information
    return NextResponse.json({
      success: true,
      endpoint: '/api/task-complete',
      description: 'Webhook endpoint for receiving task completion notifications from Flowise',
      expectedPayload: {
        taskId: 'string',
        status: 'string (completed|failed|processing)',
        data: 'object',
        metadata: 'object (optional)',
        timestamp: 'string (ISO date)'
      }
    });
  } catch (error) {
    console.error('Task complete config error:', error);
    return NextResponse.json(
      { error: 'Failed to get task completion configuration' },
      { status: 500 }
    );
  }
} 