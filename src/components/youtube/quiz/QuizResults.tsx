"use client";

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { Trophy, Eye } from 'lucide-react';
import { QuizItem } from '@/types/quiz';

interface QuizResultsProps {
  score: number;
  total: number;
  answers: Record<number, string>;
  checked: Record<number, boolean>;
  quizItems: QuizItem[];
  onRetry: () => void;
  onRegenerate: () => void;
  onReview: () => void;
  analysisLoading: boolean;
  freeResponseGrades: Record<number, boolean>;
  analysisHighlights: string[] | null;
  analysisFocusAreas: string[] | null;
}

const Shimmer = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} />
);

const QuizResults: React.FC<QuizResultsProps> = ({
  score,
  total,
  answers,
  checked,
  quizItems,
  onRetry,
  onRegenerate,
  onReview,
  analysisLoading,
  freeResponseGrades,
  analysisHighlights,
  analysisFocusAreas,
}) => {
  const t = useTranslations('Quiz');

  const { right, wrong, skipped, fallbackHighlights, fallbackFocusAreas } = useMemo(() => {
    let right = 0;
    let wrong = 0;
    let skipped = 0;
    const highlightTags: string[] = [];
    const focusTags: string[] = [];

    quizItems.forEach((item, i) => {
      if (item.type === 'free_response') {
        if (!answers[i]?.trim()) {
          skipped++;
        } else if (freeResponseGrades[i] !== undefined) {
          if (freeResponseGrades[i]) {
            right++;
            if (item.tag && !highlightTags.includes(item.tag)) highlightTags.push(item.tag);
          } else {
            wrong++;
            if (item.tag && !focusTags.includes(item.tag)) focusTags.push(item.tag);
          }
        }
        return;
      }

      if (!answers[i]) {
        skipped++;
        return;
      }

      if (answers[i] === item.correctAnswer) {
        right++;
        if (item.tag && !highlightTags.includes(item.tag)) highlightTags.push(item.tag);
      } else {
        wrong++;
        if (item.tag && !focusTags.includes(item.tag)) focusTags.push(item.tag);
      }
    });

    return { right, wrong, skipped, fallbackHighlights: highlightTags, fallbackFocusAreas: focusTags };
  }, [quizItems, answers, freeResponseGrades]);

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  const showHighlights = (analysisHighlights && analysisHighlights.length > 0) || fallbackHighlights.length > 0;
  const showFocusAreas = (analysisFocusAreas && analysisFocusAreas.length > 0) || fallbackFocusAreas.length > 0;

  return (
    <div className="flex flex-col py-8 px-4 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="rounded-full bg-primary/10 p-4 w-fit mx-auto">
          <Trophy className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">{t('resultComplete')}</h3>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{t('statsScore')}</p>
          {analysisLoading ? (
            <Shimmer className="h-8 w-16 mx-auto" />
          ) : (
            <p className="text-2xl font-bold text-primary">{score}/{total}</p>
          )}
        </div>
        <div className="rounded-xl border p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{t('statsAccuracy')}</p>
          {analysisLoading ? (
            <Shimmer className="h-8 w-14 mx-auto" />
          ) : (
            <p className="text-2xl font-bold text-primary">{percentage}%</p>
          )}
        </div>
        <div className="rounded-xl border p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{t('statsBreakdown')}</p>
          {analysisLoading ? (
            <div className="space-y-1.5 pt-1">
              <Shimmer className="h-3 w-16 mx-auto" />
              <Shimmer className="h-3 w-14 mx-auto" />
              <Shimmer className="h-3 w-18 mx-auto" />
            </div>
          ) : (
            <div className="text-xs space-y-0.5">
              <p className="text-green-600 dark:text-green-400">{t('statsRight', { count: right })}</p>
              <p className="text-red-600 dark:text-red-400">{t('statsWrong', { count: wrong })}</p>
              <p className="text-muted-foreground">{t('statsSkipped', { count: skipped })}</p>
            </div>
          )}
        </div>
      </div>

      {/* Highlights */}
      {analysisLoading ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">{t('highlightsTitle')}</h4>
          <div className="space-y-2 pl-6">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-4 w-1/2" />
          </div>
        </div>
      ) : showHighlights && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t('highlightsTitle')}</h4>
          <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
            {(analysisHighlights || fallbackHighlights).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Focus Areas */}
      {analysisLoading ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">{t('focusAreasTitle')}</h4>
          <div className="space-y-2 pl-6">
            <Shimmer className="h-4 w-2/3" />
            <Shimmer className="h-4 w-1/2" />
          </div>
        </div>
      ) : showFocusAreas && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">{t('focusAreasTitle')}</h4>
          <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
            {(analysisFocusAreas || fallbackFocusAreas).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Buttons */}
      <div className="flex justify-center">
        <Button onClick={onReview} className="gap-2">
          <Eye className="h-4 w-4" />
          {t('reviewButton')}
        </Button>
      </div>
    </div>
  );
};

export default QuizResults;
