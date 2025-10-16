'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
}

export default function PDFViewer({ isOpen, onClose, pdfUrl }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-[90vw] h-[90vh] max-w-5xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50 bg-white/50">
          <h2 className="text-xl font-semibold text-gray-800">Roshan Kern - CV</h2>
          <div className="flex items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale(Math.max(0.5, scale - 0.2))}
                className="px-3 py-1 bg-gray-200/70 hover:bg-gray-300/70 rounded text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={scale <= 0.5}
              >
                −
              </button>
              <span className="text-sm text-gray-600 w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(Math.min(2.0, scale + 0.2))}
                className="px-3 py-1 bg-gray-200/70 hover:bg-gray-300/70 rounded text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={scale >= 2.0}
              >
                +
              </button>
            </div>

            {/* Download Button */}
            <a
              href={pdfUrl}
              download="Roshan_Kern_CV.pdf"
              className="px-4 py-2 bg-blue-500/90 hover:bg-blue-600/90 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="px-3 py-2 hover:bg-gray-200/70 rounded-lg transition-colors text-gray-600 hover:text-gray-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF Display Area */}
        <div className="flex-1 overflow-auto bg-gray-100/50 flex items-start justify-center p-6">
          <div className="bg-white shadow-lg">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-12">
                  <div className="text-gray-600">Loading PDF...</div>
                </div>
              }
              error={
                <div className="flex items-center justify-center p-12">
                  <div className="text-red-600">Failed to load PDF</div>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
          </div>
        </div>

        {/* Footer - Page Navigation */}
        {numPages > 1 && (
          <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-gray-200/50 bg-white/50">
            <button
              onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
              disabled={pageNumber <= 1}
              className="px-4 py-2 bg-gray-200/70 hover:bg-gray-300/70 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-gray-700 font-medium"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
              disabled={pageNumber >= numPages}
              className="px-4 py-2 bg-gray-200/70 hover:bg-gray-300/70 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-gray-700 font-medium"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
