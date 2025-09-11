import { pdfjs } from 'react-pdf';

// Configuration du worker PDF.js
if (typeof window !== 'undefined') {
  const workerUrl = `/pdf-worker/${pdfjs.version}/pdf.worker.min.js`;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

export default pdfjs; 