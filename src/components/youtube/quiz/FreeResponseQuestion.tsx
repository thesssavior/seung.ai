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
  selfAssessment: boolean | null;
  onAnswerChange: (answer: string) => void;
  onSelfAssess: (correct: boolean) => void;
}

const FreeResponseQuestion: React.FC<FreeResponseQuestionProps> = ({
  question,
  correctAnswer,
  userAnswer,
  checked,
  selfAssessment,
  onAnswerChange,
  onSelfAssess,
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
        <div className="space-y-3">
          <div className="rounded-xl border border-green-500 bg-green-50 dark:bg-green-950/30 p-4">
            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
              {t('correctAnswer')}
            </p>
            <p className="text-sm">{correctAnswer}</p>
          </div>
          {selfAssessment === null && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelfAssess(true)}
                className="border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
              >
                {t('gotItRight')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelfAssess(false)}
                className="border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                {t('gotItWrong')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FreeResponseQuestion;
