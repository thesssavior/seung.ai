"use client";

import React from 'react';
import { QuizItem } from '@/types/quiz';
import MCQQuestion from './MCQQuestion';
import TrueFalseQuestion from './TrueFalseQuestion';
import FreeResponseQuestion from './FreeResponseQuestion';

interface QuizQuestionProps {
  item: QuizItem;
  selectedAnswer: string | null;
  checked: boolean;
  selfAssessment: boolean | null;
  onSelect: (answer: string) => void;
  onAnswerChange: (answer: string) => void;
  onSelfAssess: (correct: boolean) => void;
}

const QuizQuestion: React.FC<QuizQuestionProps> = ({
  item,
  selectedAnswer,
  checked,
  selfAssessment,
  onSelect,
  onAnswerChange,
  onSelfAssess,
}) => {
  switch (item.type) {
    case 'mcq':
      return (
        <MCQQuestion
          question={item.question}
          options={item.options || []}
          correctAnswer={item.correctAnswer}
          selectedAnswer={selectedAnswer}
          checked={checked}
          onSelect={onSelect}
        />
      );
    case 'true_false':
      return (
        <TrueFalseQuestion
          question={item.question}
          correctAnswer={item.correctAnswer}
          selectedAnswer={selectedAnswer}
          checked={checked}
          onSelect={onSelect}
        />
      );
    case 'free_response':
      return (
        <FreeResponseQuestion
          question={item.question}
          correctAnswer={item.correctAnswer}
          userAnswer={selectedAnswer || ''}
          checked={checked}
          selfAssessment={selfAssessment}
          onAnswerChange={onAnswerChange}
          onSelfAssess={onSelfAssess}
        />
      );
    default:
      return null;
  }
};

export default QuizQuestion;
