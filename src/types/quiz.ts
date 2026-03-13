export type QuizQuestionType = 'mcq' | 'true_false' | 'free_response';

export interface QuizItem {
  question: string;
  type: QuizQuestionType;
  options?: string[];
  correctAnswer: string;
  tag?: string;
}

export interface LegacyQuizItem {
  question: string;
  answer: string;
}

export function isLegacyQuiz(
  data: QuizItem[] | LegacyQuizItem[] | null
): data is LegacyQuizItem[] {
  if (!data || data.length === 0) return false;
  const first = data[0] as any;
  return 'answer' in first && !('type' in first);
}

export function migrateLegacyQuiz(data: LegacyQuizItem[]): QuizItem[] {
  return data.map((item) => ({
    question: item.question,
    type: 'free_response' as QuizQuestionType,
    correctAnswer: item.answer,
  }));
}
