"use client";

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface FreeResponseQuestionProps {
  question: string;
  correctAnswer: string;
  userAnswer: string;
  checked: boolean;
  onAnswerChange: (answer: string) => void;
  onCheck: () => void;
  explanation?: string;
}

const FreeResponseQuestion: React.FC<FreeResponseQuestionProps> = ({
  question,
  correctAnswer,
  userAnswer,
  checked,
  onAnswerChange,
  onCheck,
  explanation,
}) => {
  const t = useTranslations('Quiz');

  return (
    <div className="space-y-4">
      <p className="text-base font-medium">{question}</p>
      <Textarea
        value={userAnswer}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder={t('typeAnswer')}
        disabled={checked}
        className="min-h-[100px] resize-none"
      />
      {checked && (
        <div className="rounded-xl border border-green-500 bg-green-50 dark:bg-green-950/30 p-4">
          <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
            {t('correctAnswer')}
          </p>
          <p className="text-sm">{correctAnswer}</p>
        </div>
      )}
      {checked && explanation && (
        <div className="pt-3">
          <p className="text-xs font-medium text-foreground mb-0.5">{t('explanation')}</p>
          <p className="text-sm text-muted-foreground">{explanation}</p>
        </div>
      )}
    </div>
  );
};

export default FreeResponseQuestion;
