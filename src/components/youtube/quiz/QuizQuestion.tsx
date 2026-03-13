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
  onSelect: (answer: string) => void;
  onAnswerChange: (answer: string) => void;
  onCheck: () => void;
}

const QuizQuestion: React.FC<QuizQuestionProps> = ({
  item,
  selectedAnswer,
  checked,
  onSelect,
  onAnswerChange,
  onCheck,
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
          explanation={item.explanation}
          timestamp={item.timestamp}
          page={item.page}
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
          explanation={item.explanation}
          timestamp={item.timestamp}
          page={item.page}
        />
      );
    case 'free_response':
      return (
        <FreeResponseQuestion
          question={item.question}
          correctAnswer={item.correctAnswer}
          userAnswer={selectedAnswer || ''}
          checked={checked}
          onAnswerChange={onAnswerChange}
          onCheck={onCheck}
          explanation={item.explanation}
          timestamp={item.timestamp}
          page={item.page}
        />
      );
    default:
      return null;
  }
};

export default QuizQuestion;
