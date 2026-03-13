"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { Loader2, AlertTriangle, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';

interface MindmapProps {
  transcript?: string;
  title?: string;
  mindmap: any | null;
  locale: string;
  contentLanguage?: string;
  fileId: string | null | undefined;
  isActive: boolean | null;
}

const transformer = new Transformer();

const MindmapComponent: React.FC<MindmapProps> = ({
  transcript,
  title,
  mindmap,
  locale,
  contentLanguage,
  fileId,
  isActive
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
  const hasStartedGeneration = useRef(false);

  // Load existing mindmap data
  useEffect(() => {
    if (mindmap?.markdown) {
      setMarkdown(mindmap.markdown);
      setIsGenerated(true);
    }
  }, [mindmap]);

  // Render markmap when markdown changes or becomes active
  useEffect(() => {
    if (!markdown || !svgRef.current || !isActive) return;

    const { root } = transformer.transform(markdown);

    if (markmapRef.current) {
      markmapRef.current.setData(root);
      markmapRef.current.fit();
    } else {
      markmapRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 500,
        maxWidth: 200,
        color: () => 'currentColor',
        paddingX: 16,
      }, root);
    }
  }, [markdown, isActive]);

  // Fit when tab becomes active
  useEffect(() => {
    if (isActive && markmapRef.current) {
      requestAnimationFrame(() => {
        markmapRef.current?.fit();
      });
    }
  }, [isActive]);

  // Auto-generate if no mindmap exists
  useEffect(() => {
    if (transcript && !isGenerated && !isLoading && !hasStartedGeneration.current && !mindmap?.markdown) {
      hasStartedGeneration.current = true;
      generateMindmap();
    }
  }, [transcript, isGenerated, isLoading, mindmap]);

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
          contentLanguage: contentLanguage || locale
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
      <svg ref={svgRef} className="w-full h-full text-foreground [&_.markmap-node_text]:fill-current [&_.markmap-link]:!stroke-current [&_.markmap-node_circle]:!fill-current" />
    </div>
  );
};

export default MindmapComponent;
