'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface PdfViewerContextType {
  currentPage: number;
  goToPage: (page: number) => void;
  updateCurrentPage: (page: number) => void;
  registerScrollContainer: (el: HTMLDivElement | null) => void;
}

const PdfViewerContext = createContext<PdfViewerContextType | undefined>(undefined);

interface PdfViewerProviderProps {
  children: ReactNode;
}

export function PdfViewerProvider({ children }: PdfViewerProviderProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  const registerScrollContainer = useCallback((el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
  }, []);

  const updateCurrentPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);

    const container = scrollContainerRef.current;
    if (!container) return;

    // Find the page element by data attribute
    const pageEl = container.querySelector(`[data-page-number="${page}"]`) as HTMLElement;
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <PdfViewerContext.Provider value={{ currentPage, goToPage, updateCurrentPage, registerScrollContainer }}>
      {children}
    </PdfViewerContext.Provider>
  );
}

export function usePdfViewer() {
  const context = useContext(PdfViewerContext);
  if (context === undefined) {
    throw new Error('usePdfViewer must be used within a PdfViewerProvider');
  }
  return context;
}

export function usePdfViewerOptional() {
  return useContext(PdfViewerContext) ?? null;
}
