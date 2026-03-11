"use client";

import React, { useMemo, useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parse as parsePartialJson } from 'partial-json';
import { useVideoPlayerOptional } from '@/contexts/VideoPlayerContext';
import { timeStringToSeconds, formatTimeString } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface SummarySection {
  emoji?: string;
  heading?: string;
  timestamp?: string;
  content?: string;
}

export interface StructuredSummary {
  intro?: string;
  body?: SummarySection[];
  outro?: string;
}

interface SummaryContentProps {
  summaryText: string;
  isStreaming: boolean;
}

function tryParseStructured(text: string): StructuredSummary | null {
  if (!text) return null;
  try {
    const data = parsePartialJson(text);
    if (data && typeof data === 'object' && !Array.isArray(data) && ('intro' in data || 'body' in data)) {
      return data as StructuredSummary;
    }
  } catch {}
  return null;
}

const proseClasses = "prose prose-sm dark:prose-invert max-w-none prose-hr:my-4 prose-hr:border-muted prose-th:border-transparent prose-td:border-transparent prose-img:border-0";

const SummaryContent: React.FC<SummaryContentProps> = ({ summaryText, isStreaming }) => {
  const videoPlayer = useVideoPlayerOptional();
  const parsed = useMemo(() => tryParseStructured(summaryText), [summaryText]);
  const [tocOpen, setTocOpen] = useState(true);
  const t = useTranslations('SummaryContent');

  const handleTimestampClick = useCallback((timestamp: string) => {
    if (videoPlayer) {
      videoPlayer.seekTo(timeStringToSeconds(timestamp));
    }
  }, [videoPlayer]);

  // Legacy markdown fallback (old saved summaries)
  if (!parsed) {
    return (
      <article className={proseClasses}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {summaryText}
        </ReactMarkdown>
      </article>
    );
  }

  // Structured rendering
  return (
    <article className={proseClasses}>
      {/* Intro */}
      {parsed.intro && (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {parsed.intro}
        </ReactMarkdown>
      )}

      {/* Table of Contents - derived from body headings */}
      {parsed.body && parsed.body.length > 0 && parsed.body[0]?.heading && (
        <nav className={`not-prose my-4 py-3 px-4 ${tocOpen ? 'bg-muted/40' : 'bg-background'} rounded-lg`}>
          <button
            type="button"
            onClick={() => setTocOpen(!tocOpen)}
            className="flex items-center gap-1.5 font-normal text-foreground cursor-pointer w-full text-left"
          >
            <span className="text-xs text-muted-foreground transition-transform" style={{ transform: tocOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            {t('tableOfContents')}
          </button>
          {tocOpen && (
            <ul className="space-y-1 text-sm text-muted-foreground mt-2">
              {parsed.body.map((section, i) => (
                section.heading && (
                  <li
                    key={i}
                    className={videoPlayer && section.timestamp ? 'cursor-pointer hover:text-foreground transition-colors' : ''}
                    onClick={() => section.timestamp && handleTimestampClick(section.timestamp)}
                  >
                    {<span className="mr-1.5">{i + 1}.</span>}
                    {section.heading}
                    {section.timestamp && (
                      <span className="ml-1.5 text-xs opacity-70">
                        {formatTimeString(section.timestamp)}
                      </span>
                    )}
                  </li>
                )
              ))}
            </ul>
          )}
        </nav>
      )}

      {/* Body sections */}
      {parsed.body?.map((section, i) => (
        <section key={i}>
          {section.heading && (
            <h2 className="font-normal">
              {section.emoji && <span className="mr-1.5">{section.emoji}</span>}
              {section.heading}
              {section.timestamp && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleTimestampClick(section.timestamp!); }}
                  className="ml-2 text-sm font-normal text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                >
                  {formatTimeString(section.timestamp)}
                </button>
              )}
            </h2>
          )}
          {section.content && (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {section.content}
            </ReactMarkdown>
          )}
        </section>
      ))}

      {/* Outro */}
      {parsed.outro && (
        <>
          <hr />
          <p className="not-prose font-normal text-foreground mb-2">{t('takeaways')}</p>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {parsed.outro}
          </ReactMarkdown>
        </>
      )}

      {/* Streaming cursor */}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
      )}
    </article>
  );
};

export default SummaryContent;
