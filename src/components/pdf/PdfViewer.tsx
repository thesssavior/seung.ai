'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePdfViewerOptional } from '@/contexts/PdfViewerContext';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string;
  title?: string;
}

export function PdfViewer({ pdfUrl, title }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pdfViewer = usePdfViewerOptional();

  // Register scroll container with context
  useEffect(() => {
    if (pdfViewer) {
      pdfViewer.registerScrollContainer(scrollContainerRef.current);
    }
  }, [pdfViewer]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const zoomIn = () => setScale((s) => Math.min(2.0, s + 0.2));
  const zoomOut = () => setScale((s) => Math.max(0.4, s - 0.2));

  return (
    <div className="h-full flex flex-col bg-muted/30 rounded-lg overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/80 backdrop-blur-sm">
        <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={title}>
          {title || 'PDF'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={scale <= 0.4}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={scale >= 2.0}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <span className="text-xs text-muted-foreground">
            {numPages} {numPages === 1 ? 'page' : 'pages'}
          </span>
        </div>
      </div>

      {/* PDF Document - continuous scroll */}
      <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Loading PDF...
            </div>
          }
          error={
            <div className="flex items-center justify-center h-40 text-red-500 text-sm">
              Failed to load PDF
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i + 1} className="flex justify-center py-2" data-page-number={i + 1}>
              <Page
                pageNumber={i + 1}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}
