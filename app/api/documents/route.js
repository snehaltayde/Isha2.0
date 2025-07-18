import { NextResponse } from 'next/server';
import { chromaVectorStore } from '../../../lib/vectorstore.js';

export async function GET() {
  try {
    const info = await chromaVectorStore.getCollectionInfo();
    
    if (!info.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to get collection info' 
      }, { status: 500 });
    }

    // Get all documents by searching with a dummy query
    const searchResult = await chromaVectorStore.search(
      { embedding: new Array(384).fill(0) }, // Dummy embedding
      1000 // Large number to get all documents
    );

    if (!searchResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to retrieve documents' 
      }, { status: 500 });
    }

    // Group documents by filename
    const documentsByFile = {};
    searchResult.ids.forEach((id, index) => {
      const metadata = searchResult.metadatas[index] || {};
      const filename = metadata.filename || 'Unknown';
      
      if (!documentsByFile[filename]) {
        documentsByFile[filename] = {
          filename,
          fileType: metadata.fileType || 'unknown',
          uploadDate: metadata.uploadDate || new Date().toISOString(),
          fileSize: metadata.fileSize || 0,
          chunks: []
        };
      }
      
      documentsByFile[filename].chunks.push({
        id,
        text: searchResult.results[index] || '',
        chunkIndex: metadata.chunkIndex || 0,
        metadata
      });
    });

    const documents = Object.values(documentsByFile).map(doc => ({
      ...doc,
      chunkCount: doc.chunks.length,
      totalTextLength: doc.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0)
    }));

    return NextResponse.json({
      success: true,
      collection: info,
      documents,
      total: documents.length
    });
  } catch (error) {
    console.error('Documents API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { filename } = await request.json();
    
    if (!filename) {
      return NextResponse.json({ 
        success: false, 
        error: 'Filename is required' 
      }, { status: 400 });
    }

    // First, get all documents to find the ones with matching filename
    const searchResult = await chromaVectorStore.search(
      { embedding: new Array(384).fill(0) },
      1000
    );

    if (!searchResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to retrieve documents' 
      }, { status: 500 });
    }

    // Find document IDs that match the filename
    const idsToDelete = [];
    searchResult.metadatas.forEach((metadata, index) => {
      if (metadata.filename === filename) {
        idsToDelete.push(searchResult.ids[index]);
      }
    });

    if (idsToDelete.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No documents found with that filename' 
      }, { status: 404 });
    }

    // Delete the documents
    const result = await chromaVectorStore.deleteDocuments(idsToDelete);
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} document chunks for "${filename}"`,
      deletedCount: result.count,
      filename
    });
  } catch (error) {
    console.error('Delete documents API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { filename, newText, newFilename } = await request.json();
    
    if (!filename || !newText) {
      return NextResponse.json({ 
        success: false, 
        error: 'Filename and new text are required' 
      }, { status: 400 });
    }

    // First, get all documents with the old filename
    const searchResult = await chromaVectorStore.search(
      { embedding: new Array(384).fill(0) },
      1000
    );

    if (!searchResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to retrieve documents' 
      }, { status: 500 });
    }

    // Find document IDs that match the filename
    const documentsToUpdate = [];
    searchResult.metadatas.forEach((metadata, index) => {
      if (metadata.filename === filename) {
        documentsToUpdate.push({
          id: searchResult.ids[index],
          oldText: searchResult.results[index],
          metadata: metadata
        });
      }
    });

    if (documentsToUpdate.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No documents found with that filename' 
      }, { status: 404 });
    }

    // Delete old documents
    const idsToDelete = documentsToUpdate.map(doc => doc.id);
    const deleteResult = await chromaVectorStore.deleteDocuments(idsToDelete);
    
    if (!deleteResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to delete existing documents' 
      }, { status: 500 });
    }

    // Parse the new text into chunks (similar to upload process)
    const { parseDocumentChunks } = await import('../../../lib/parse-documents.js');
    const buffer = Buffer.from(newText, 'utf-8');
    const parseResult = await parseDocumentChunks(
      buffer,
      newFilename || filename,
      'txt'
    );

    if (!parseResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to parse new text' 
      }, { status: 500 });
    }

    // Add the new document chunks
    const { ragService } = await import('../../../lib/rag.js');
    const addResult = await ragService.addDocumentToKnowledgeBase(parseResult.chunks);

    if (!addResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to add updated documents' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Document updated successfully',
      filename: newFilename || filename,
      chunksAdded: addResult.chunksAdded
    });
  } catch (error) {
    console.error('Update document API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
} 