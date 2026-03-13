"use client";

import React from 'react';
import { Check, X } from 'lucide-react';
import { cn, timeStringToSeconds, formatTimeString } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useVideoPlayerOptional } from '@/contexts/VideoPlayerContext';
import { usePdfViewerOptional } from '@/contexts/PdfViewerContext';

interface TrueFalseQuestionProps {
  question: string;
  correctAnswer: string;
  selectedAnswer: string | null;
  checked: boolean;
  onSelect: (answer: string) => void;
  explanation?: string;
  timestamp?: string;
  page?: number;
}

const TrueFalseQuestion: React.FC<TrueFalseQuestionProps> = ({
  question,
  correctAnswer,
  selectedAnswer,
  checked,
  onSelect,
  explanation,
  timestamp,
  page,
}) => {
  const t = useTranslations('Quiz');
  const videoPlayer = useVideoPlayerOptional();
  const pdfViewer = usePdfViewerOptional();
  const options = ['True', 'False'];

  const handleRefClick = () => {
    if (timestamp && videoPlayer) {
      videoPlayer.seekTo(timeStringToSeconds(timestamp));
    } else if (page && pdfViewer) {
      pdfViewer.goToPage(page);
    }
  };

  const hasRef = (timestamp && videoPlayer) || (page && pdfViewer);

  return (
    <div className="space-y-4 2xl:space-y-5">
      <p className="text-base 2xl:text-lg font-normal">{question}</p>
      <div className="flex flex-col gap-3 2xl:gap-4">
        {options.map((option) => {
          const isSelected = selectedAnswer === option;
          const isCorrect = option === correctAnswer;

          let stateClasses = 'border-border bg-card hover:border-primary/50';
          if (checked) {
            if (isCorrect) {
              stateClasses = 'border-green-500 bg-green-50 dark:bg-green-950/30';
            } else if (isSelected && !isCorrect) {
              stateClasses = 'border-red-500 bg-red-50 dark:bg-red-950/30';
            } else {
              stateClasses = 'border-border bg-card opacity-60';
            }
          } else if (isSelected) {
            stateClasses = 'border-primary bg-primary/5';
          }

          return (
            <button
              key={option}
              onClick={() => !checked && onSelect(option)}
              disabled={checked}
              className={cn(
                'rounded-xl border p-4 2xl:p-5 text-left transition-all flex items-center justify-between gap-3',
                stateClasses,
                !checked && 'cursor-pointer'
              )}
            >
              <span className="text-sm 2xl:text-base font-normal">{option}</span>
              {checked && isCorrect && <Check className="h-4 w-4 2xl:h-5 2xl:w-5 text-green-500 flex-shrink-0" />}
              {checked && isSelected && !isCorrect && <X className="h-4 w-4 2xl:h-5 2xl:w-5 text-red-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      {checked && explanation && (
        <div className="pt-3">
          <p className="text-xs 2xl:text-sm font-normal text-foreground mb-1">{t('explanation')}</p>
          <p className="text-sm 2xl:text-base font-normal text-muted-foreground">
            {explanation}
            {hasRef && (
              <button
                type="button"
                onClick={handleRefClick}
                className="ml-2 text-xs font-normal text-muted-foreground hover:text-primary cursor-pointer transition-colors"
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

export default TrueFalseQuestion;
