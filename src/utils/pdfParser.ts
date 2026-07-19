import * as pdfjsLib from 'pdfjs-dist';

// CDN worker — seule méthode fiable sur Safari iOS
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export async function extractBalanceFromPDF(file: File): Promise<number | null> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str ?? '').join(' ');
    fullText += pageText + '\n';
  }

  return parseBalance(fullText);
}

function parseBalance(text: string): number | null {
  const lines = text.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.includes('solde') &&
      (lower.includes('fin') || lower.includes('clôture') || lower.includes('cloture') ||
       lower.includes('arrêt') || lower.includes('arret') || lower.includes('nouveau') ||
       lower.includes('créditeur') || lower.includes('débiteur') || lower.includes('debiteur') ||
       lower.includes('au '))
    ) {
      const amountMatch = line.match(/([+-]?\s*\d[\d\s]*[,\.]\d{2})/);
      if (amountMatch) {
        const raw = amountMatch[1].replace(/\s/g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val)) return val;
      }
    }
  }

  for (const line of lines) {
    if (line.toLowerCase().includes('solde')) {
      const amountMatch = line.match(/([+-]?\s*\d[\d\s]*[,\.]\d{2})/);
      if (amountMatch) {
        const raw = amountMatch[1].replace(/\s/g, '').replace(',', '.');
        const val = parseFloat(raw);
        if (!isNaN(val) && Math.abs(val) > 0) return val;
      }
    }
  }

  return null;
}
