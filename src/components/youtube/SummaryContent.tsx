"use client";

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parse as parsePartialJson } from 'partial-json';

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
  const parsed = useMemo(() => tryParseStructured(summaryText), [summaryText]);

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
        <nav className="not-prose my-4 py-3 px-4 bg-muted/40 rounded-lg">
          <ul className="space-y-1 text-sm text-muted-foreground">
            {parsed.body.map((section, i) => (
              section.heading && (
                <li key={i}>
                  {section.emoji && <span className="mr-1.5">{section.emoji}</span>}
                  {section.heading}
                </li>
              )
            ))}
          </ul>
        </nav>
      )}

      {/* Body sections */}
      {parsed.body?.map((section, i) => (
        <section key={i}>
          {section.heading && (
            <h2>
              {section.emoji && <span className="mr-1.5">{section.emoji}</span>}
              {section.heading}
              {section.timestamp && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  [{section.timestamp}]
                </span>
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
