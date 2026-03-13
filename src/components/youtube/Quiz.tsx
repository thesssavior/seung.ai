"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnimatePresence, motion } from 'framer-motion';
import { QuizItem, isLegacyQuiz, migrateLegacyQuiz } from '@/types/quiz';
import QuizProgressBar from './quiz/QuizProgressBar';
import QuizQuestion from './quiz/QuizQuestion';
import QuizResults from './quiz/QuizResults';
import posthog from 'posthog-js';

interface QuizProps {
  transcript?: string | null;
  quizData: any[] | null;
  locale: string;
  contentLanguage?: string;
  fileId: string | null;
  title?: string | null;
  sourceType?: 'youtube' | 'pdf' | 'audio';
}

const QuizComponent: React.FC<QuizProps> = ({
  transcript,
  quizData: initialQuizData,
  locale,
  contentLanguage,
  fileId,
  title,
  sourceType
}) => {
  const t = useTranslations();

  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);
  const hasStartedGeneration = useRef(false);

  // Interactive quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [direction, setDirection] = useState(1);
  const [reviewMode, setReviewMode] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [freeResponseGrades, setFreeResponseGrades] = useState<Record<number, boolean>>({});
  const [analysisHighlights, setAnalysisHighlights] = useState<string[] | null>(null);
  const [analysisFocusAreas, setAnalysisFocusAreas] = useState<string[] | null>(null);

  const normalizeQuizData = useCallback((data: any[] | null): QuizItem[] => {
    if (!data || data.length === 0) return [];
    if (isLegacyQuiz(data)) {
      return migrateLegacyQuiz(data);
    }
    return data as QuizItem[];
  }, []);

  useEffect(() => {
    if (initialQuizData) {
      const normalized = normalizeQuizData(initialQuizData);
      setQuizItems(normalized);
      setIsGenerated(normalized.length > 0);
      resetQuizState();
    } else {
      setQuizItems([]);
      setIsGenerated(false);
    }
  }, [initialQuizData, normalizeQuizData]);

  // Save quiz when fileId becomes available after generation
  const hasSavedForFileId = useRef<string | null>(null);
  useEffect(() => {
    if (fileId && fileId !== 'new' && quizItems.length > 0 && isGenerated && hasSavedForFileId.current !== fileId) {
      hasSavedForFileId.current = fileId;
      saveQuiz(quizItems, fileId);
    }
  }, [fileId, quizItems, isGenerated]);

  useEffect(() => {
    const hasExistingQuiz = initialQuizData && initialQuizData.length > 0;
    if (transcript && !isGenerated && !hasExistingQuiz && !isLoading && !hasStartedGeneration.current) {
      hasStartedGeneration.current = true;
      generateQuiz();
    }
  }, [transcript, isGenerated, isLoading, initialQuizData]);

  // Load progress from localStorage
  const hasRestoredProgress = useRef(false);
  useEffect(() => {
    if (!fileId || !isGenerated || hasRestoredProgress.current) return;
    hasRestoredProgress.current = true;
    try {
      const saved = localStorage.getItem(`quiz_progress_${fileId}`);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.version === 1) {
          setAnswers(p.answers);
          setChecked(p.checked);
          setCurrentIndex(p.currentIndex);
          setScore(p.score);
        }
      }
    } catch {}
  }, [fileId, isGenerated]);

  // Save progress to localStorage
  useEffect(() => {
    if (!fileId || !isGenerated || quizComplete || reviewMode) return;
    if (Object.keys(answers).length === 0) return;
    try {
      localStorage.setItem(`quiz_progress_${fileId}`, JSON.stringify({
        answers, checked, currentIndex, score, version: 1
      }));
    } catch {}
  }, [answers, checked, currentIndex, score, fileId, isGenerated, quizComplete, reviewMode]);

  const clearProgress = () => {
    if (fileId) {
      try { localStorage.removeItem(`quiz_progress_${fileId}`); } catch {}
    }
  };

  const resetQuizState = () => {
    setCurrentIndex(0);
    setAnswers({});
    setChecked({});
    setScore(0);
    setQuizComplete(false);
    setReviewMode(false);
    setDirection(1);
    hasRestoredProgress.current = false;
    setAnalysisLoading(false);
    setFreeResponseGrades({});
    setAnalysisHighlights(null);
    setAnalysisFocusAreas(null);
  };

  const generateQuiz = async () => {
    if (!transcript) {
      setError(t('Quiz.errorNoSummary'));
      return;
    }

    setIsLoading(true);
    setError(null);
    resetQuizState();
    clearProgress();

    try {
      const langToSend = contentLanguage || locale;

      const response = await fetch('/api/files/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title,
          contentLanguage: langToSend,
          sourceType
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || t('Quiz.errorGenerating'));
      }

      const data = await response.json();
      if (data.quiz && Array.isArray(data.quiz)) {
        const normalized = normalizeQuizData(data.quiz);
        setQuizItems(normalized);
        setIsGenerated(true);
        posthog.capture('quiz_generated', { question_count: normalized.length });

        if (fileId && fileId !== 'new') {
          await saveQuiz(data.quiz, fileId);
        }
      } else {
        throw new Error(t('Quiz.errorInvalidData'));
      }
    } catch (err: any) {
      console.error("Error generating quiz:", err);
      setError(err.message || t('Quiz.errorUnknown'));
    } finally {
      setIsLoading(false);
    }
  };

  const saveQuiz = async (currentQuizItems: QuizItem[] | any[], currentSummaryId: string) => {
    if (!currentSummaryId || currentSummaryId === 'new') return;
    if (!currentQuizItems || currentQuizItems.length === 0) return;

    try {
      await fetch('/api/files/quiz', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: currentSummaryId,
          quiz: currentQuizItems
        }),
      });
    } catch (err: any) {
      console.error("Error saving quiz:", err);
    }
  };

  const saveResults = async (finalScore: number) => {
    if (!fileId || fileId === 'new') return;
    try {
      await fetch('/api/files/quiz', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          quizResults: {
            answers,
            score: finalScore,
            total: quizItems.length,
            completedAt: new Date().toISOString(),
          }
        }),
      });
    } catch (err: any) {
      console.error("Error saving quiz results:", err);
    }
  };

  const handleComplete = async () => {
    setQuizComplete(true);
    clearProgress();
    setAnalysisLoading(true);

    try {
      const langToSend = contentLanguage || locale;
      const res = await fetch('/api/files/quiz/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizItems,
          answers,
          title,
          contentLanguage: langToSend,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Set free-response grades
        const grades: Record<number, boolean> = {};
        if (data.freeResponseGrades) {
          for (const g of data.freeResponseGrades) {
            grades[g.index] = g.correct;
          }
        }
        setFreeResponseGrades(grades);
        setAnalysisHighlights(data.highlights || null);
        setAnalysisFocusAreas(data.focusAreas || null);

        // Recalculate score including free-response grades
        let newScore = 0;
        quizItems.forEach((item, i) => {
          if (item.type === 'free_response') {
            if (grades[i]) newScore++;
          } else if (answers[i] === item.correctAnswer) {
            newScore++;
          }
        });
        setScore(newScore);
        saveResults(newScore);
        posthog.capture('quiz_completed', {
          score: newScore,
          total: quizItems.length,
          percentage: Math.round((newScore / quizItems.length) * 100),
        });
      } else {
        // Analysis failed — save with current score
        saveResults(score);
        posthog.capture('quiz_completed', {
          score,
          total: quizItems.length,
          percentage: Math.round((score / quizItems.length) * 100),
        });
      }
    } catch (err) {
      console.error('Error analyzing quiz:', err);
      saveResults(score);
      posthog.capture('quiz_completed', {
        score,
        total: quizItems.length,
        percentage: Math.round((score / quizItems.length) * 100),
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  // MCQ/TF: selecting an option immediately checks the answer
  const handleSelect = (answer: string) => {
    if (checked[currentIndex] || reviewMode) return;
    setAnswers(prev => ({ ...prev, [currentIndex]: answer }));
    // Auto-check
    const currentItem = quizItems[currentIndex];
    setChecked(prev => ({ ...prev, [currentIndex]: true }));
    if (answer === currentItem.correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleAnswerChange = (answer: string) => {
    if (checked[currentIndex] || reviewMode) return;
    setAnswers(prev => ({ ...prev, [currentIndex]: answer }));
  };

  // Free response: explicit "Show Answer" button
  const handleFreeResponseCheck = () => {
    if (reviewMode) return;
    setChecked(prev => ({ ...prev, [currentIndex]: true }));
  };

  const goTo = (index: number) => {
    if (index < 0 || index >= quizItems.length) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  };

  const handleRetry = () => {
    clearProgress();
    resetQuizState();
  };

  const handleRegenerate = () => {
    clearProgress();
    hasStartedGeneration.current = false;
    setIsGenerated(false);
    setQuizItems([]);
    resetQuizState();
    generateQuiz();
  };

  const handleReview = () => {
    setQuizComplete(false);
    setReviewMode(true);
    setCurrentIndex(0);
    setDirection(1);
  };

  const handleBackToResults = () => {
    setReviewMode(false);
    setQuizComplete(true);
  };

  const currentItem = quizItems[currentIndex];
  const isCurrentChecked = checked[currentIndex] || false;
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === quizItems.length - 1;
  const allChecked = quizItems.length > 0 && quizItems.every((_, i) => checked[i]);
  const isFreeResponsePending = currentItem?.type === 'free_response' && !isCurrentChecked && !!answers[currentIndex]?.trim();

  // Keyboard navigation
  useEffect(() => {
    if (!isGenerated || quizComplete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in a textarea
      if (e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Enter' && !e.shiftKey && isFreeResponsePending && !reviewMode) {
          e.preventDefault();
          handleFreeResponseCheck();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (!isFirstQuestion) goTo(currentIndex - 1);
          break;
        case 'ArrowRight':
          if (!isLastQuestion) goTo(currentIndex + 1);
          break;
        case 'Enter':
          if (reviewMode) {
            if (isLastQuestion) handleBackToResults();
          } else if (isFreeResponsePending) {
            handleFreeResponseCheck();
          } else if (isLastQuestion && allChecked) {
            handleComplete();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerated, quizComplete, currentIndex, isFirstQuestion, isLastQuestion, isFreeResponsePending, allChecked, reviewMode]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center pt-36 h-full p-6">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!isGenerated) {
    return (
      <div className="flex flex-col items-center pt-36 h-full text-center px-4">
        <Lightbulb className="h-10 w-10 text-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">{t('Quiz.title')}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {t('Quiz.generateDescription')}
        </p>
        <Button onClick={generateQuiz} disabled={!transcript || isLoading}>
          {t('Quiz.generateButton')}
        </Button>
        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }

  if (quizComplete) {
    return (
      <ScrollArea className="h-full p-4 lg:p-6">
        <div className="max-w-2xl lg:max-w-3xl mx-auto">
          <QuizResults
            score={score}
            total={quizItems.length}
            answers={answers}
            checked={checked}
            quizItems={quizItems}
            onRetry={handleRetry}
            onRegenerate={handleRegenerate}
            onReview={handleReview}
            analysisLoading={analysisLoading}
            freeResponseGrades={freeResponseGrades}
            analysisHighlights={analysisHighlights}
            analysisFocusAreas={analysisFocusAreas}
          />
        </div>
      </ScrollArea>
    );
  }

  // Dot color logic for review mode
  const getDotColor = (i: number) => {
    if (i === currentIndex) return 'bg-primary scale-125';
    if (reviewMode) {
      const item = quizItems[i];
      if (item.type === 'free_response') {
        if (freeResponseGrades[i] !== undefined) {
          return freeResponseGrades[i] ? 'bg-green-500' : 'bg-red-500';
        }
        return checked[i] ? 'bg-blue-500' : 'bg-muted-foreground/30';
      }
      if (!answers[i]) return 'bg-muted-foreground/30';
      return answers[i] === item.correctAnswer ? 'bg-green-500' : 'bg-red-500';
    }
    return checked[i] ? 'bg-green-500' : 'bg-muted-foreground/30';
  };

  return (
    <ScrollArea className="h-full p-4 lg:p-6">
      <div className="max-w-2xl lg:max-w-3xl mx-auto space-y-6 lg:space-y-8">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
            {error}
          </div>
        )}

        <QuizProgressBar
          current={currentIndex}
          total={quizItems.length}
          tag={currentItem?.tag}
        />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 50 }}
            transition={{ duration: 0.2 }}
          >
            {currentItem && (
              <QuizQuestion
                item={currentItem}
                selectedAnswer={answers[currentIndex] || null}
                checked={reviewMode ? true : isCurrentChecked}
                onSelect={handleSelect}
                onAnswerChange={handleAnswerChange}
                onCheck={handleFreeResponseCheck}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goTo(currentIndex - 1)}
            disabled={isFirstQuestion}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex gap-1.5">
            {quizItems.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 w-2 lg:h-2.5 lg:w-2.5 rounded-full transition-all ${getDotColor(i)}`}
              />
            ))}
          </div>

          {reviewMode ? (
            isLastQuestion ? (
              <Button
                size="sm"
                onClick={handleBackToResults}
              >
                {t('Quiz.backToResults')}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => goTo(currentIndex + 1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )
          ) : isFreeResponsePending ? (
            <Button
              size="sm"
              onClick={handleFreeResponseCheck}
            >
              {t('Quiz.submitButton')}
            </Button>
          ) : isLastQuestion && allChecked ? (
            <Button
              size="sm"
              onClick={handleComplete}
            >
              {t('Quiz.seeResults')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goTo(currentIndex + 1)}
              disabled={isLastQuestion}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  );
};

export default QuizComponent;
