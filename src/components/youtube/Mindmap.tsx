"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { Loader2, AlertTriangle, Brain, Plus, Minus, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useVideoPlayerOptional } from '@/contexts/VideoPlayerContext';
import { usePdfViewerOptional } from '@/contexts/PdfViewerContext';
import { timeStringToSeconds } from '@/lib/utils';
import posthog from 'posthog-js';

interface MindmapProps {
  transcript?: string;
  title?: string;
  mindmap: any | null;
  locale: string;
  contentLanguage?: string;
  fileId: string | null | undefined;
  isActive: boolean | null;
  sourceType?: 'youtube' | 'pdf' | 'audio';
}

const transformer = new Transformer();

const MindmapComponent: React.FC<MindmapProps> = ({
  transcript,
  title,
  mindmap,
  locale,
  contentLanguage,
  fileId,
  isActive,
  sourceType
}) => {
  const t = useTranslations();
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const [markdown, setMarkdown] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const videoPlayer = useVideoPlayerOptional();
  const pdfViewer = usePdfViewerOptional();
  const videoPlayerRef = useRef(videoPlayer);
  const pdfViewerRef = useRef(pdfViewer);
  videoPlayerRef.current = videoPlayer;
  pdfViewerRef.current = pdfViewer;
  const hasStartedGeneration = useRef(false);

  // Load existing mindmap data
  useEffect(() => {
    if (mindmap?.markdown) {
      setMarkdown(mindmap.markdown);
      setIsGenerated(true);
    }
  }, [mindmap]);

  // Destroy and recreate markmap when tab becomes active to avoid SVGLength errors
  useEffect(() => {
    if (!markdown || !svgRef.current || !isActive) return;

    // Destroy previous instance to avoid stale SVG measurements
    if (markmapRef.current) {
      markmapRef.current.destroy();
      markmapRef.current = null;
    }

    // Clear SVG children from previous render
    while (svgRef.current.firstChild) {
      svgRef.current.removeChild(svgRef.current.firstChild);
    }

    // Strip reference tags from markdown for display, but store them as data attributes
    const refMap = new Map<string, string>();
    const displayMarkdown = markdown.replace(
      /^(#{1,4}\s+.+?)\s*\[(\d{1,2}:\d{2}(?::\d{2})?|p\.\d+)\]\s*$/gm,
      (_, heading, ref) => {
        const key = heading.trim();
        refMap.set(key, ref);
        return heading;
      }
    );

    const { root } = transformer.transform(displayMarkdown);

    // Small delay to ensure container is laid out before measuring
    requestAnimationFrame(() => {
      if (!svgRef.current) return;
      // Create with no animation so it snaps to center immediately
      const mm = Markmap.create(svgRef.current, {
        autoFit: false,
        duration: 0,
        maxWidth: 200,
        color: () => 'currentColor',
        paddingX: 16,
        spacingVertical: 28,
        spacingHorizontal: 100,
        scrollForPan: false,
      }, root);
      markmapRef.current = mm;
      mm.fit().then(() => {
        // Restore animation duration after initial positioning
        mm.setOptions({ duration: 500 });
      });

      // Attach click handler for reference navigation
      const handleNodeClick = (e: Event) => {
        const target = e.target as Element;
        const node = target.closest('.markmap-foreign') || target.closest('.markmap-node');
        if (!node) return;
        const text = (node.textContent || '').trim();
        // Look up the reference from the stored map
        let ref: string | undefined;
        refMap.forEach((val, key) => {
          if (ref) return;
          // Strip heading markers for comparison
          const cleanKey = key.replace(/^#{1,4}\s+/, '');
          if (text.includes(cleanKey)) {
            ref = val;
          }
        });
        if (!ref) return;
        // Timestamp reference
        const tsMatch = ref.match(/^(\d{1,2}:\d{2}(?::\d{2})?)$/);
        if (tsMatch && videoPlayerRef.current) {
          videoPlayerRef.current.seekTo(timeStringToSeconds(tsMatch[1]));
          return;
        }
        // Page reference
        const pageMatch = ref.match(/^p\.(\d+)$/);
        if (pageMatch && pdfViewerRef.current) {
          pdfViewerRef.current.goToPage(parseInt(pageMatch[1]));
        }
      };
      svgRef.current.addEventListener('click', handleNodeClick);
    });

    return () => {
      if (markmapRef.current) {
        markmapRef.current.destroy();
        markmapRef.current = null;
      }
    };
  }, [markdown, isActive]);

  // Auto-generate if no mindmap exists
  useEffect(() => {
    if (transcript && !isGenerated && !isLoading && !hasStartedGeneration.current && !mindmap?.markdown) {
      hasStartedGeneration.current = true;
      generateMindmap();
    }
  }, [transcript, isGenerated, isLoading, mindmap]);

  const handleZoomIn = () => {
    markmapRef.current?.rescale(1.25);
    posthog.capture('mindmap_interaction', { action: 'zoom_in' });
  };

  const handleZoomOut = () => {
    markmapRef.current?.rescale(0.8);
    posthog.capture('mindmap_interaction', { action: 'zoom_out' });
  };

  const handleFit = () => {
    markmapRef.current?.fit();
    posthog.capture('mindmap_interaction', { action: 'fit_to_view' });
  };

  const generateMindmap = async () => {
    if (!transcript) {
      setError("No transcript available to generate mind map.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/files/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title,
          contentLanguage: contentLanguage || locale,
          sourceType
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate mindmap');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullMarkdown = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullMarkdown += decoder.decode(value, { stream: true });
        }
      }

      // Clean up: remove code fences if the LLM wraps it
      fullMarkdown = fullMarkdown.replace(/^```(?:markdown)?\n?/gm, '').replace(/\n?```$/gm, '').trim();

      setMarkdown(fullMarkdown);
      setIsGenerated(true);
      setIsLoading(false);

      // Save to database
      if (!user || !fileId) {
        setIsSaving(false);
        return;
      }

      setIsSaving(true);
      try {
        const saveResponse = await fetch('/api/files/mindmap', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId, mindmap: { markdown: fullMarkdown } }),
        });

        if (!saveResponse.ok) {
          const saveErrData = await saveResponse.json();
          console.error("Failed to save mindmap:", saveErrData.error);
        }
      } finally {
        setIsSaving(false);
      }
    } catch (err: any) {
      console.error("Error generating mindmap:", err);
      setError(err.message || 'An unknown error occurred');
      setIsLoading(false);
    }
  };

  if (!transcript) {
    return (
      <div className="h-full w-full flex items-center justify-center border rounded-md">
        <p className="text-gray-500">{t('Mindmap.noSummaryAvailable')}</p>
      </div>
    );
  }

  if (!isGenerated && !isLoading && !error && !isSaving) {
    return (
      <div className="flex flex-col items-center pt-36 h-full text-center px-4">
        <Brain className="h-10 w-10 text-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('Mindmap.title')}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {t('Mindmap.generateMindmapDescription')}
        </p>
        <Button onClick={generateMindmap}>
          {t('Mindmap.generateMindmapButton')}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center pt-36 h-full p-6">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (error || (!markdown && !isLoading && !isSaving)) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center rounded-md p-4">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-600">Error Generating Mind Map</h3>
        <p className="text-sm text-red-500 text-center">{error}</p>
        <Button onClick={generateMindmap} className="mt-4" variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[500px]">
      <style>{`
        .markmap {
          --markmap-font: 500 16px/20px sans-serif !important;
          font: 500 16px/20px sans-serif !important;
        }
        .markmap-foreign > div {
          font-weight: 500 !important;
        }
        .markmap-node text {
          fill: currentColor;
        }
        .markmap-foreign > div {
          color: #1f2937 !important;
        }
        .dark .markmap-foreign > div {
          color: #f3f4f6 !important;
        }
        .markmap-node { cursor: pointer; }
        .markmap-link { stroke: #d1d5db !important; }
        .markmap-node line { stroke: #d1d5db !important; }
        .markmap-node circle { fill: #d1d5db !important; stroke: #d1d5db !important; }
        .markmap-node:hover line { stroke: #6b7280 !important; }
        .markmap-node:hover circle { fill: #6b7280 !important; stroke: #6b7280 !important; }
        .dark .markmap-link { stroke: #4b5563 !important; }
        .dark .markmap-node line { stroke: #4b5563 !important; }
        .dark .markmap-node circle { fill: #4b5563 !important; stroke: #4b5563 !important; }
        .dark .markmap-node:hover line { stroke: #9ca3af !important; }
        .dark .markmap-node:hover circle { fill: #9ca3af !important; stroke: #9ca3af !important; }
      `}</style>
      <svg ref={svgRef} width="100%" height="100%" className="w-full h-full text-foreground" />
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-md bg-background border border-border hover:bg-muted transition-colors"
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-md bg-background border border-border hover:bg-muted transition-colors"
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleFit}
          className="p-1.5 rounded-md bg-background border border-border hover:bg-muted transition-colors"
          aria-label="Fit to view"
        >
          <Maximize className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default MindmapComponent;
