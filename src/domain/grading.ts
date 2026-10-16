import type { Question } from './questions';

export function gradeSelection(
  question: Question,
  selectedOptionIds: readonly string[],
): 'correct' | 'incorrect' | 'unanswered' {
  if (selectedOptionIds.length === 0) return 'unanswered';
  return selectedOptionIds.length === question.correctOptionIds.length &&
    question.correctOptionIds.every((id) => selectedOptionIds.includes(id))
    ? 'correct'
    : 'incorrect';
}
