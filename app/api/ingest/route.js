import { NextResponse } from 'next/server';
import { ragService } from '../../../lib/rag.js';

export async function POST(request) {
  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'add_documents':
        return await handleAddDocuments(data);
      
      case 'clear_knowledge_base':
        return await handleClearKnowledgeBase();
      
      case 'get_stats':
        return await handleGetStats();
      
      default:
        return NextResponse.json(
          { error: 'Invalid action', validActions: ['add_documents', 'clear_knowledge_base', 'get_stats'] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Ingest API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

async function handleAddDocuments(data) {
  try {
    const { documents } = data;

    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: 'Documents array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate document structure
    for (const doc of documents) {
      if (!doc.text || !doc.id) {
        return NextResponse.json(
          { error: 'Each document must have id and text fields' },
          { status: 400 }
        );
      }
    }

    const result = await ragService.addDocumentToKnowledgeBase(documents);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to add documents', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Documents added successfully',
      chunksAdded: result.chunksAdded,
      totalChunks: result.totalChunks
    });
  } catch (error) {
    console.error('Add documents error:', error);
    return NextResponse.json(
      { error: 'Failed to add documents', details: error.message },
      { status: 500 }
    );
  }
}

async function handleClearKnowledgeBase() {
  try {
    const result = await ragService.clearKnowledgeBase();

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to clear knowledge base', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Clear knowledge base error:', error);
    return NextResponse.json(
      { error: 'Failed to clear knowledge base', details: error.message },
      { status: 500 }
    );
  }
}

async function handleGetStats() {
  try {
    const result = await ragService.getKnowledgeBaseStats();

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to get knowledge base stats', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stats: result
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge base stats', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return knowledge base statistics
    const result = await ragService.getKnowledgeBaseStats();

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to get knowledge base stats', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stats: result
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge base stats', details: error.message },
      { status: 500 }
    );
  }
} 