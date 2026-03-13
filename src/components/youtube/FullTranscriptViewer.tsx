"use client";

import { useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useVideoPlayerOptional } from '@/contexts/VideoPlayerContext';
import posthog from 'posthog-js';

interface TranscriptGroup {
  timestamp: string;
  lines: string[];
}

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  if (typeof window !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }
  // Basic fallback for server-side or non-browser environments
  return text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
             .replace(/&quot;/g, '"')
             .replace(/&apos;/g, "'")
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&');
}

// Function to parse timestamp and convert to seconds
function parseTimestampToSeconds(timestamp: string): number {
  // Remove brackets and parse [HH:MM:SS] or [MM:SS]
  const timeStr = timestamp.replace(/[\[\]]/g, '');
  const parts = timeStr.split(':').map(Number);

  if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

export function FullTranscriptViewer({ transcript }: { transcript: string }) {
  const t = useTranslations();
  const videoPlayer = useVideoPlayerOptional();
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevActiveRef = useRef(-1);

  // Handle timestamp click
  const handleTimestampClick = (timestamp: string) => {
    if (videoPlayer) {
      const seconds = parseTimestampToSeconds(timestamp);
      videoPlayer.seekTo(seconds);
      posthog.capture('transcript_clicked', { timestamp: seconds });
    }
  };

  // Parse transcript into groups (memoized to avoid re-parsing on every time update)
  const finalGroups = useMemo(() => {
    if (!transcript) return [];

    // Remove the "자막" prefix if it exists
    let processedTranscript = transcript.startsWith("자막\n") ? transcript.substring(3).trim() : transcript.trim();

    // Pre-processing: Ensure every timestamp forces a new line for the split operation.
    const timestampRegex = /(\[[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\])/g;
    processedTranscript = processedTranscript.replace(timestampRegex, '\n$1');

    const groups = processedTranscript
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .reduce<TranscriptGroup[]>((acc, rawLine) => {
        const match = rawLine.match(/^(\[[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\])/);
        if (match) {
          const timestamp = match[1];
          const textContent = decodeHtmlEntities(rawLine.substring(timestamp.length).trim());
          acc.push({ timestamp: timestamp, lines: textContent ? [textContent] : [] });
        } else if (acc.length > 0) {
          const textContent = decodeHtmlEntities(rawLine.trim());
          if (textContent) {
            acc[acc.length - 1].lines.push(textContent);
          }
        }
        return acc;
      }, []);

    return groups.filter(g => g.lines.length > 0 || g.timestamp);
  }, [transcript]);

  // Determine active group based on current playback time
  const activeGroupIndex = useMemo(() => {
    if (!videoPlayer || videoPlayer.currentTime <= 0 || !finalGroups.length) return -1;

    let active = -1;
    for (let i = 0; i < finalGroups.length; i++) {
      if (!finalGroups[i].timestamp) continue;
      if (parseTimestampToSeconds(finalGroups[i].timestamp) <= videoPlayer.currentTime) {
        active = i;
      } else {
        break;
      }
    }
    return active;
  }, [videoPlayer?.currentTime, finalGroups]);

  // Auto-scroll to active group when it changes
  useEffect(() => {
    if (activeGroupIndex >= 0 && activeGroupIndex !== prevActiveRef.current) {
      prevActiveRef.current = activeGroupIndex;
      const el = groupRefs.current[activeGroupIndex];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeGroupIndex]);

  if (!transcript) {
    return (
      <Alert className="mt-6 bg-blue-50 border-blue-200 text-blue-700">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('noTranscriptAvailableOrNotProcessed')}</AlertDescription>
      </Alert>
    );
  }

  if (finalGroups.length === 0 && transcript.trim()) {
     return (
      <Alert className="mt-6 bg-yellow-50 border-yellow-200 text-yellow-700">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('transcriptCouldNotBeParsed')}</AlertDescription>
      </Alert>
    );
  } else if (finalGroups.length === 0) {
     return (
      <Alert className="mt-6 bg-blue-50 border-blue-200 text-blue-700">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t('noTranscriptAvailableOrNotProcessed')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="pr-2">
        {finalGroups.map((group, index) => {
          const isActive = index === activeGroupIndex;
          return (
            <div
              key={index}
              ref={(el) => { groupRefs.current[index] = el; }}
              className={`rounded-lg p-4 text-card-foreground hover:bg-accent transition-colors ${
                videoPlayer ? 'cursor-pointer' : ''
              } ${isActive ? 'bg-accent' : 'bg-card'}`}
              style={{ scrollMarginTop: '8px' }}
              onClick={() => handleTimestampClick(group.timestamp)}
            >
              {group.timestamp && (
                <p className="font-normal mb-1">{group.timestamp.replace(/[\[\]]/g, '')}</p>
              )}
              <div className={"space-y-1"}>
                {group.lines.map((textLine, lineIndex) => (
                  <p key={lineIndex} className="text-sm leading-relaxed text-muted-foreground">{textLine}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
