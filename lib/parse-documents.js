import { parsePDF, parsePDFChunks } from './parse-pdf.js';
import { v4 as uuidv4 } from 'uuid';

export async function parseDocument(buffer, filename, fileType) {
  try {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid file buffer provided');
    }

    let parseResult;

    switch (fileType.toLowerCase()) {
      case 'pdf':
        parseResult = await parsePDF(buffer);
        break;
      
      case 'md':
      case 'markdown':
        parseResult = await parseMarkdown(buffer);
        break;
      
      case 'txt':
      case 'text':
        parseResult = await parseText(buffer);
        break;
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (!parseResult.success) {
      return parseResult;
    }

    // Add file metadata
    parseResult.metadata = {
      ...parseResult.metadata,
      filename,
      fileType: fileType.toLowerCase(),
      uploadDate: new Date().toISOString(),
      fileSize: buffer.length
    };

    return parseResult;
  } catch (error) {
    console.error('Document parsing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function parseDocumentChunks(buffer, filename, fileType, chunkSize = 1000, overlap = 200) {
  try {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid file buffer provided');
    }

    let chunkResult;

    switch (fileType.toLowerCase()) {
      case 'pdf':
        chunkResult = await parsePDFChunks(buffer, chunkSize, overlap);
        break;
      
      case 'md':
      case 'markdown':
        chunkResult = await parseMarkdownChunks(buffer, chunkSize, overlap);
        break;
      
      case 'txt':
      case 'text':
        chunkResult = await parseTextChunks(buffer, chunkSize, overlap);
        break;
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (!chunkResult.success) {
      return chunkResult;
    }

    // Add file metadata to each chunk
    const enrichedChunks = chunkResult.chunks.map((chunk, index) => ({
      ...chunk,
      id: uuidv4(),
      filename,
      fileType: fileType.toLowerCase(),
      chunkIndex: index,
      uploadDate: new Date().toISOString(),
      fileSize: buffer.length
    }));

    return {
      success: true,
      chunks: enrichedChunks,
      totalChunks: enrichedChunks.length,
      originalText: chunkResult.originalText,
      metadata: {
        ...chunkResult.metadata,
        filename,
        fileType: fileType.toLowerCase(),
        uploadDate: new Date().toISOString(),
        fileSize: buffer.length
      }
    };
  } catch (error) {
    console.error('Document chunking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function parseMarkdown(buffer) {
  try {
    const text = buffer.toString('utf-8');
    
    if (!text || text.trim().length === 0) {
      throw new Error('No content found in Markdown file');
    }

    // Clean and normalize the text
    const cleanedText = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim();

    return {
      success: true,
      text: cleanedText,
      metadata: {
        textLength: cleanedText.length,
        fileSize: buffer.length
      }
    };
  } catch (error) {
    console.error('Markdown parsing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function parseMarkdownChunks(buffer, chunkSize = 1000, overlap = 200) {
  try {
    const parseResult = await parseMarkdown(buffer);
    
    if (!parseResult.success) {
      return parseResult;
    }

    return createTextChunks(parseResult.text, chunkSize, overlap, parseResult.metadata);
  } catch (error) {
    console.error('Markdown chunking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function parseText(buffer) {
  try {
    const text = buffer.toString('utf-8');
    
    if (!text || text.trim().length === 0) {
      throw new Error('No content found in text file');
    }

    // Clean and normalize the text
    const cleanedText = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim();

    return {
      success: true,
      text: cleanedText,
      metadata: {
        textLength: cleanedText.length,
        fileSize: buffer.length
      }
    };
  } catch (error) {
    console.error('Text parsing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function parseTextChunks(buffer, chunkSize = 1000, overlap = 200) {
  try {
    const parseResult = await parseText(buffer);
    
    if (!parseResult.success) {
      return parseResult;
    }

    return createTextChunks(parseResult.text, chunkSize, overlap, parseResult.metadata);
  } catch (error) {
    console.error('Text chunking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function createTextChunks(text, chunkSize, overlap, metadata) {
  try {
    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      let chunk = text.slice(startIndex, endIndex);

      // Try to break at sentence boundaries
      if (endIndex < text.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastQuestion = chunk.lastIndexOf('?');
        const lastExclamation = chunk.lastIndexOf('!');
        const lastNewline = chunk.lastIndexOf('\n');
        
        const breakPoints = [lastPeriod, lastQuestion, lastExclamation, lastNewline]
          .filter(point => point > startIndex + chunkSize * 0.7); // Only break if it's in the last 30% of chunk
        
        if (breakPoints.length > 0) {
          const bestBreak = Math.max(...breakPoints);
          chunk = text.slice(startIndex, bestBreak + 1);
          startIndex = bestBreak + 1;
        } else {
          startIndex = endIndex;
        }
      } else {
        startIndex = endIndex;
      }

      // Clean up the chunk
      chunk = chunk.trim();
      
      if (chunk.length > 0) {
        chunks.push({
          text: chunk,
          startIndex,
          length: chunk.length
        });
      }

      // Apply overlap
      if (startIndex < text.length) {
        startIndex = Math.max(0, startIndex - overlap);
      }
    }

    return {
      success: true,
      chunks,
      totalChunks: chunks.length,
      originalText: text,
      metadata
    };
  } catch (error) {
    console.error('Text chunking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export function getSupportedFileTypes() {
  return ['pdf', 'md', 'markdown', 'txt', 'text'];
}

export function validateFileType(fileType) {
  const supportedTypes = getSupportedFileTypes();
  return supportedTypes.includes(fileType.toLowerCase());
} 