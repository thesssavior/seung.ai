"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnimatePresence, motion } from 'framer-motion';
import { QuizItem, isLegacyQuiz, migrateLegacyQuiz } from '@/types/quiz';
import QuizProgressBar from './quiz/QuizProgressBar';
import QuizQuestion from './quiz/QuizQuestion';
import QuizResults from './quiz/QuizResults';

interface QuizProps {
  transcript?: string | null;
  quizData: any[] | null;
  locale: string;
  contentLanguage?: string;
  fileId: string | null;
  title?: string | null;
}

const QuizComponent: React.FC<QuizProps> = ({
  transcript,
  quizData: initialQuizData,
  locale,
  contentLanguage,
  fileId,
  title
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
  const [selfAssessments, setSelfAssessments] = useState<Record<number, boolean | null>>({});
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [direction, setDirection] = useState(1);

  const normalizeQuizData = useCallback((data: any[] | null): QuizItem[] => {
    if (!data || data.length === 0) return [];
    if (isLegacyQuiz(data)) {
      return migrateLegacyQuiz(data);
    }
    return data as QuizItem[];
  }, []);

  useEffect(() => {
    console.log('[Quiz] Props received:', {
      fileId,
      locale,
      contentLanguage,
      hasTranscript: !!transcript,
      initialQuizDataLength: initialQuizData?.length ?? null,
    });
  }, [fileId, locale, contentLanguage, transcript, initialQuizData]);

  useEffect(() => {
    console.log('[Quiz] initialQuizData changed:', JSON.stringify({
      hasData: !!initialQuizData,
      length: initialQuizData?.length ?? 0,
      firstItem: initialQuizData?.[0] ?? null,
    }));
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
    console.log('[Quiz] fileId effect:', { fileId, quizItemsLength: quizItems.length, isGenerated, hasSavedForFileId: hasSavedForFileId.current });
    if (fileId && fileId !== 'new' && quizItems.length > 0 && isGenerated && hasSavedForFileId.current !== fileId) {
      console.log('[Quiz] Saving quiz via fileId effect for:', fileId);
      hasSavedForFileId.current = fileId;
      saveQuiz(quizItems, fileId);
    }
  }, [fileId, quizItems, isGenerated]);

  useEffect(() => {
    const hasExistingQuiz = initialQuizData && initialQuizData.length > 0;
    console.log('[Quiz] Auto-generate check:', { hasTranscript: !!transcript, isGenerated, isLoading, hasStarted: hasStartedGeneration.current, hasExistingQuiz });
    if (transcript && !isGenerated && !hasExistingQuiz && !isLoading && !hasStartedGeneration.current) {
      hasStartedGeneration.current = true;
      generateQuiz();
    }
  }, [transcript, isGenerated, isLoading, initialQuizData]);

  const resetQuizState = () => {
    setCurrentIndex(0);
    setAnswers({});
    setChecked({});
    setSelfAssessments({});
    setScore(0);
    setQuizComplete(false);
    setDirection(1);
  };

  const generateQuiz = async () => {
    if (!transcript) {
      setError(t('Quiz.errorNoSummary'));
      return;
    }

    setIsLoading(true);
    setError(null);
    resetQuizState();

    try {
      const langToSend = contentLanguage || locale;
      console.log('[Quiz] generateQuiz sending:', { title, contentLanguage, locale, langToSend, fileId });

      const response = await fetch('/api/files/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title,
          contentLanguage: langToSend
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || t('Quiz.errorGenerating'));
      }

      const data = await response.json();
      console.log('[Quiz] API response:', { hasQuiz: !!data.quiz, quizLength: data.quiz?.length });
      if (data.quiz && Array.isArray(data.quiz)) {
        const normalized = normalizeQuizData(data.quiz);
        setQuizItems(normalized);
        setIsGenerated(true);

        if (fileId && fileId !== 'new') {
          console.log('[Quiz] Saving immediately after generation, fileId:', fileId);
          await saveQuiz(data.quiz, fileId);
        } else {
          console.log('[Quiz] Skipping immediate save, fileId:', fileId);
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
    console.log('[Quiz] saveQuiz called:', { fileId: currentSummaryId, itemCount: currentQuizItems?.length });
    if (!currentSummaryId || currentSummaryId === 'new') {
      console.log('[Quiz] saveQuiz early return: invalid fileId', currentSummaryId);
      return;
    }
    if (!currentQuizItems || currentQuizItems.length === 0) {
      console.log('[Quiz] saveQuiz early return: no items');
      return;
    }

    try {
      const res = await fetch('/api/files/quiz', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: currentSummaryId,
          quiz: currentQuizItems
        }),
      });
      const result = await res.json();
      console.log('[Quiz] saveQuiz response:', { status: res.status, result });
    } catch (err: any) {
      console.error("[Quiz] Error saving quiz:", err);
    }
  };

  const handleSelect = (answer: string) => {
    if (checked[currentIndex]) return;
    setAnswers(prev => ({ ...prev, [currentIndex]: answer }));
  };

  const handleAnswerChange = (answer: string) => {
    if (checked[currentIndex]) return;
    setAnswers(prev => ({ ...prev, [currentIndex]: answer }));
  };

  const handleCheck = () => {
    const currentItem = quizItems[currentIndex];
    setChecked(prev => ({ ...prev, [currentIndex]: true }));

    if (currentItem.type === 'mcq' || currentItem.type === 'true_false') {
      if (answers[currentIndex] === currentItem.correctAnswer) {
        setScore(prev => prev + 1);
      }
    }
    // For free_response, score is handled by self-assessment
  };

  const handleSelfAssess = (correct: boolean) => {
    setSelfAssessments(prev => ({ ...prev, [currentIndex]: correct }));
    if (correct) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < quizItems.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    } else {
      setQuizComplete(true);
    }
  };

  const handleRetry = () => {
    resetQuizState();
  };

  const handleRegenerate = () => {
    hasStartedGeneration.current = false;
    setIsGenerated(false);
    setQuizItems([]);
    resetQuizState();
    generateQuiz();
  };

  const currentItem = quizItems[currentIndex];
  const isCurrentChecked = checked[currentIndex] || false;
  const hasAnswer = !!answers[currentIndex]?.trim();
  const currentSelfAssessment = selfAssessments[currentIndex] ?? null;

  // For free response: need self-assessment before "Next"
  const canProceed = isCurrentChecked && (
    currentItem?.type !== 'free_response' || currentSelfAssessment !== null
  );

  const isLastQuestion = currentIndex === quizItems.length - 1;

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
      <ScrollArea className="h-full p-4">
        <div className="max-w-2xl mx-auto">
          <QuizResults
            score={score}
            total={quizItems.length}
            onRetry={handleRetry}
            onRegenerate={handleRegenerate}
          />
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full p-4">
      <div className="max-w-2xl mx-auto space-y-6">
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
                checked={isCurrentChecked}
                selfAssessment={currentSelfAssessment}
                onSelect={handleSelect}
                onAnswerChange={handleAnswerChange}
                onSelfAssess={handleSelfAssess}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-end pt-2">
          {!isCurrentChecked ? (
            <Button
              onClick={handleCheck}
              disabled={!hasAnswer}
            >
              {t('Quiz.checkButton')}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
            >
              {isLastQuestion ? t('Quiz.seeResults') : t('Quiz.nextButton')}
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  );
};

export default QuizComponent;
