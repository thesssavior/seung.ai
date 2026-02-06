"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuizItem {
  question: string;
  answer: string;
}

interface QuizProps {
  transcript?: string | null;
  quizData: QuizItem[] | null;
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

  const [quizItems, setQuizItems] = useState<QuizItem[]>(initialQuizData || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(!!initialQuizData && initialQuizData.length > 0);
  const [revealedAnswers, setRevealedAnswers] = useState<{ [index: number]: boolean }>({});
  const hasStartedGeneration = useRef(false);

  useEffect(() => {
    if (initialQuizData) {
      setQuizItems(initialQuizData);
      setIsGenerated(initialQuizData.length > 0);
      setRevealedAnswers({});
    } else {
      setQuizItems([]);
      setIsGenerated(false);
    }
  }, [initialQuizData]);

  useEffect(() => {
    if (transcript && !isGenerated && !isLoading && !hasStartedGeneration.current) {
      hasStartedGeneration.current = true;
      generateQuiz();
    }
  }, [transcript, isGenerated, isLoading]);

  const generateQuiz = async () => {
    if (!transcript) {
      setError(t('Quiz.errorNoSummary'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setRevealedAnswers({});

    try {
      const response = await fetch('/api/files/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          title,
          contentLanguage: contentLanguage || locale
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || t('Quiz.errorGenerating'));
      }

      const data = await response.json();
      if (data.quiz && Array.isArray(data.quiz)) {
        setQuizItems(data.quiz);
        setIsGenerated(true);

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

  const saveQuiz = async (currentQuizItems: QuizItem[], currentSummaryId: string) => {
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

  const toggleAnswer = (index: number) => {
    setRevealedAnswers(prev => ({ ...prev, [index]: !prev[index] }));
  };

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

  return (
    <ScrollArea className="h-full p-4">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {quizItems.map((item, index) => (
            <div key={index} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleAnswer(index)}
                className="w-full p-4 text-left flex items-start justify-between gap-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex gap-3">
                  <span className="flex-shrink-0 text-sm font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="text-sm">{item.question}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
                    revealedAnswers[index] ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {revealedAnswers[index] && (
                <div className="px-4 pb-4 pt-0">
                  <div className="pl-7 pt-2 border-t">
                    <p className="text-sm text-muted-foreground pt-3">{item.answer}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export default QuizComponent;
