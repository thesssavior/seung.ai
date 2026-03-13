"use client";

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface QuizProgressBarProps {
  current: number;
  total: number;
  tag?: string;
}

const QuizProgressBar: React.FC<QuizProgressBarProps> = ({ current, total, tag }) => {
  const t = useTranslations('Quiz');
  const progress = ((current + 1) / total) * 100;

  return (
    <div className="space-y-2 2xl:space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm 2xl:text-base font-medium text-muted-foreground">
          {t('questionCounter', { current: current + 1, total })}
        </span>
        {tag && (
          <Badge variant="secondary" className="text-xs">
            {tag}
          </Badge>
        )}
      </div>
      <Progress value={progress} className="h-1.5 2xl:h-2 [&>div]:bg-green-500 [&>div]:rounded-full" />
    </div>
  );
};

export default QuizProgressBar;
