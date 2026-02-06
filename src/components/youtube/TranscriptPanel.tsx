'use client';

import { FullTranscriptViewer } from './FullTranscriptViewer';
import { useTranslations } from 'next-intl';

interface TranscriptPanelProps {
  transcript: string | null;
}

export function TranscriptPanel({ transcript }: TranscriptPanelProps) {
  const t = useTranslations();

  return (
    <div className="p-3">
      {transcript ? (
        <FullTranscriptViewer transcript={transcript} />
      ) : (
        <p className="text-gray-500 text-sm">No transcript available for this summary.</p>
      )}
    </div>
  );
} 