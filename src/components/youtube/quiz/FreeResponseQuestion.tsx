"use client";

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { timeStringToSeconds, formatTimeString } from '@/lib/utils';
import { useVideoPlayerOptional } from '@/contexts/VideoPlayerContext';
import { usePdfViewerOptional } from '@/contexts/PdfViewerContext';

interface FreeResponseQuestionProps {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  checked: boolean;
  onAnswerChange: (answer: string) => void;
  onCheck: () => void;
  explanation?: string;
  timestamp?: string;
  page?: number;
}

const FreeResponseQuestion: React.FC<FreeResponseQuestionProps> = ({
  question,
  correctAnswer,
  userAnswer,
  checked,
  onAnswerChange,
  onCheck,
  explanation,
  timestamp,
  page,
}) => {
  const t = useTranslations('Quiz');
  const videoPlayer = useVideoPlayerOptional();
  const pdfViewer = usePdfViewerOptional();

  const handleRefClick = () => {
    if (timestamp && videoPlayer) {
      videoPlayer.seekTo(timeStringToSeconds(timestamp));
    } else if (page && pdfViewer) {
      pdfViewer.goToPage(page);
    }
  };

  const hasRef = (timestamp && videoPlayer) || (page && pdfViewer);

  return (
    <div className="space-y-4 lg:space-y-5">
      <p className="text-base lg:text-lg font-medium">{question}</p>
      <Textarea
        value={userAnswer}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder={t('typeAnswer')}
        disabled={checked}
        className="min-h-[100px] lg:min-h-[120px] lg:text-base resize-none"
      />
      {checked && (
        <div className="rounded-xl border border-green-500 bg-green-50 dark:bg-green-950/30 p-4 lg:p-5">
          <p className="text-xs lg:text-sm font-medium text-green-700 dark:text-green-400 mb-1">
            {t('correctAnswer')}
          </p>
          <p className="text-sm lg:text-base">{correctAnswer}</p>
        </div>
      )}
      {checked && explanation && (
        <div className="pt-3">
          <p className="text-xs lg:text-sm font-medium text-foreground mb-0.5">{t('explanation')}</p>
          <p className="text-sm lg:text-base text-muted-foreground">
            {explanation}
            {hasRef && (
              <button
                type="button"
                onClick={handleRefClick}
                className="ml-2 text-xs font-medium text-muted-foreground hover:text-primary cursor-pointer transition-colors"
              >
                {timestamp ? formatTimeString(timestamp) : `p.${page}`}
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default FreeResponseQuestion;
