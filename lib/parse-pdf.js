import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Set up worker for Node.js environment
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export async function parsePDF(buffer) {
  try {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid PDF buffer provided');
    }

    // Convert Buffer to Uint8Array for PDF.js
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    const numPages = pdf.numPages;
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error('No text content found in PDF');
    }

    // Clean and normalize the text
    const cleanedText = fullText
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim();

    return {
      success: true,
      text: cleanedText,
      pages: numPages,
      info: {
        title: 'Unknown',
        author: 'Unknown',
        subject: '',
        creator: '',
        producer: '',
        creationDate: '',
        modDate: ''
      },
      metadata: {
        pageCount: numPages,
        textLength: cleanedText.length,
        fileSize: buffer.length
      }
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function parsePDFChunks(buffer, chunkSize = 1000, overlap = 200) {
  try {
    const parseResult = await parsePDF(buffer);
    
    if (!parseResult.success) {
      return parseResult;
    }

    const text = parseResult.text;
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
      metadata: parseResult.metadata
    };
  } catch (error) {
    console.error('PDF chunking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
} 