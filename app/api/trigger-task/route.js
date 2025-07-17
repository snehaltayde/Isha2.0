import { NextResponse } from 'next/server';
import { webhookService } from '../../../lib/webhooks.js';

export async function POST(request) {
  try {
    const taskData = await request.json();

    if (!taskData || !taskData.message) {
      return NextResponse.json(
        { error: 'Task data with message is required' },
        { status: 400 }
      );
    }

    const result = await webhookService.triggerN8nTask(taskData);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to trigger task', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Task triggered successfully',
      taskId: result.taskId,
      response: result.response
    });

  } catch (error) {
    console.error('Trigger task API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return webhook configuration and health status
    const config = webhookService.getWebhookConfig();
    const health = await webhookService.checkWebhookHealth();

    return NextResponse.json({
      success: true,
      config,
      health
    });
  } catch (error) {
    console.error('Trigger task config error:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook configuration' },
      { status: 500 }
    );
  }
} 