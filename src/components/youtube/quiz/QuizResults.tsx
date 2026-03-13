"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { Trophy, RotateCcw, RefreshCw } from 'lucide-react';

interface QuizResultsProps {
  score: number;
  total: number;
  onRetry: () => void;
  onRegenerate: () => void;
}

const QuizResults: React.FC<QuizResultsProps> = ({
  score,
  total,
  onRetry,
  onRegenerate,
}) => {
  const t = useTranslations('Quiz');
  const percentage = Math.round((score / total) * 100);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-6">
      <div className="rounded-full bg-primary/10 p-4">
        <Trophy className="h-10 w-10 text-primary" />
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-1">{t('resultTitle')}</h3>
        <p className="text-3xl font-bold text-primary">
          {t('resultScore', { score, total, percentage })}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {t('retryButton')}
        </Button>
        <Button onClick={onRegenerate} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('regenerateButton')}
        </Button>
      </div>
    </div>
  );
};

export default QuizResults;
