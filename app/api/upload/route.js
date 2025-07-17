import { NextRequest, NextResponse } from 'next/server';
import { parseDocumentChunks, validateFileType, getSupportedFileTypes } from '../../../lib/parse-documents.js';
import { ragService } from '../../../lib/rag.js';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!validateFileType(fileExtension)) {
      return NextResponse.json(
        { 
          error: 'Unsupported file type',
          supportedTypes: getSupportedFileTypes(),
          receivedType: fileExtension
        },
        { status: 400 }
      );
    }

    // Validate file size
    const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { 
          error: 'File too large',
          maxSize: maxFileSize,
          fileSize: file.size
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse document into chunks
    const parseResult = await parseDocumentChunks(
      buffer,
      file.name,
      fileExtension
    );

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Failed to parse document', details: parseResult.error },
        { status: 500 }
      );
    }

    // Add document chunks to knowledge base
    const ingestResult = await ragService.addDocumentToKnowledgeBase(parseResult.chunks);

    if (!ingestResult.success) {
      return NextResponse.json(
        { error: 'Failed to ingest document', details: ingestResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document uploaded and processed successfully',
      filename: file.name,
      fileType: fileExtension,
      fileSize: file.size,
      chunksProcessed: ingestResult.chunksAdded,
      totalChunks: parseResult.totalChunks,
      metadata: parseResult.metadata
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Return supported file types and configuration
    return NextResponse.json({
      supportedTypes: getSupportedFileTypes(),
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
      maxFileSizeMB: Math.round((parseInt(process.env.MAX_FILE_SIZE) || 10485760) / 1024 / 1024)
    });
  } catch (error) {
    console.error('Upload config error:', error);
    return NextResponse.json(
      { error: 'Failed to get upload configuration' },
      { status: 500 }
    );
  }
} 