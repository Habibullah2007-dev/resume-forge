import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker using unpkg CDN matching the installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Extracts text from a PDF file client-side.
 */
export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    
    if (items.length === 0) continue;
    
    // Group text items by y-coordinate (vertical alignment) with a small tolerance threshold
    const linesMap: { [y: number]: { text: string; x: number }[] } = {};
    const tolerance = 5;
    
    for (const item of items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      
      const x = item.transform[4];
      const y = item.transform[5];
      
      // Find close y-coordinate group
      let foundYKey = null;
      for (const existingYStr of Object.keys(linesMap)) {
        const existingY = parseFloat(existingYStr);
        if (Math.abs(existingY - y) < tolerance) {
          foundYKey = existingY;
          break;
        }
      }
      
      if (foundYKey !== null) {
        linesMap[foundYKey].push({ text: item.str, x });
      } else {
        linesMap[y] = [{ text: item.str, x }];
      }
    }
    
    // Sort y-coordinate keys in descending order (from top to bottom of page)
    const sortedYKeys = Object.keys(linesMap)
      .map(Number)
      .sort((a, b) => b - a);
      
    let pageText = '';
    for (const yKey of sortedYKeys) {
      // Sort segments on the same line by x-coordinate (from left to right)
      const lineItems = linesMap[yKey].sort((a, b) => a.x - b.x);
      const lineStr = lineItems.map(item => item.text).join(' ');
      pageText += lineStr + '\n';
    }
    
    fullText += pageText + '\n';
  }
  
  return fullText.trim();
};

/**
 * Extracts text from a DOCX file client-side.
 */
export const extractTextFromDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
};
