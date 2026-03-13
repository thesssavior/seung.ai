"use client";

import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface MCQQuestionProps {
  question: string;
  options: string[];
  correctAnswer: string;
  selectedAnswer: string | null;
  checked: boolean;
  onSelect: (answer: string) => void;
  explanation?: string;
}

const MCQQuestion: React.FC<MCQQuestionProps> = ({
  question,
  options,
  correctAnswer,
  selectedAnswer,
  checked,
  onSelect,
  explanation,
}) => {
  const t = useTranslations('Quiz');
  return (
    <div className="space-y-4">
      <p className="text-base font-medium">{question}</p>
      <div className="flex flex-col gap-3">
        {options.map((option, index) => {
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
              key={index}
              onClick={() => !checked && onSelect(option)}
              disabled={checked}
              className={cn(
                'rounded-xl border p-4 text-left transition-all flex items-center justify-between gap-3',
                stateClasses,
                !checked && 'cursor-pointer'
              )}
            >
              <span className="text-sm">{option}</span>
              {checked && isCorrect && <Check className="h-4 w-4 text-green-500 flex-shrink-0" />}
              {checked && isSelected && !isCorrect && <X className="h-4 w-4 text-red-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      {checked && explanation && (
        <div className="pt-3">
          <p className="text-xs font-medium text-foreground mb-1">{t('explanation')}</p>
          <p className="text-sm text-muted-foreground">{explanation}</p>
        </div>
      )}
    </div>
  );
};

export default MCQQuestion;
