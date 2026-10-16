import type { AnswerRecord } from './learning';
import { PracticeSessionSchema, type PracticeSession } from './practice';
import type { Question } from './questions';

export function buildGrowthRateSession(
  questions: readonly Question[],
  id: string,
  startedAt: string,
) {
  if (
    questions.length < 5 ||
    new Set(questions.map((question) => question.id)).size !==
      questions.length ||
    questions.some(
      (question) =>
        question.type !== 'single' ||
        !question.knowledgePointIds.includes('data-analysis-growth-rate') ||
        question.reviewStatus !== 'verified' ||
        question.source.license.status !== 'permitted',
    )
  )
    throw new Error('增长率练习需要五道经审核且获许可的单选题');
  return PracticeSessionSchema.parse({
    id,
    questionRefs: questions
      .slice(0, 5)
      .map(({ id, version }) => ({ id, version })),
    status: 'active',
    explanationMode: 'after-submit',
    currentIndex: 0,
    drafts: [],
    startedAt,
    completedAt: null,
  });
}

export function advanceSessionTime(
  session: PracticeSession,
  elapsedMs: number,
): PracticeSession {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
    throw new Error('单题用时无效');
  const ref = session.questionRefs[session.currentIndex]!;
  const previous = session.drafts.find(
    (draft) => draft.questionRef.id === ref.id,
  );
  const nextDraft = previous
    ? { ...previous, elapsedMs: previous.elapsedMs + Math.round(elapsedMs) }
    : {
        questionRef: ref,
        selectedOptionIds: [],
        uncertain: false,
        elapsedMs: Math.round(elapsedMs),
      };
  return {
    ...session,
    drafts: [
      ...session.drafts.filter((draft) => draft.questionRef.id !== ref.id),
      nextDraft,
    ],
  };
}

type ResultEntry = Pick<
  AnswerRecord,
  'outcome' | 'elapsedMs' | 'attemptNumber'
>;

type PracticeObservation = ResultEntry & {
  difficulty: Question['difficulty'];
  uncertain: boolean;
};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function summarizePracticeHistory(
  records: readonly PracticeObservation[],
) {
  return (['easy', 'medium', 'hard'] as const).map((difficulty) => {
    const group = records.filter((record) => record.difficulty === difficulty);
    const first = group.filter(
      (record) => record.attemptNumber === 1 && record.outcome !== 'unanswered',
    );
    const repeat = group.filter(
      (record) => record.attemptNumber > 1 && record.outcome !== 'unanswered',
    );
    return {
      difficulty,
      firstAnswered: first.length,
      firstCorrect: first.filter((record) => record.outcome === 'correct')
        .length,
      firstMedianMs: median(first.map((record) => record.elapsedMs)),
      repeatAnswered: repeat.length,
      repeatCorrect: repeat.filter((record) => record.outcome === 'correct')
        .length,
      repeatMedianMs: median(repeat.map((record) => record.elapsedMs)),
      uncertainCount: group.filter((record) => record.uncertain).length,
    };
  });
}

export function summarizeAnswers(records: readonly ResultEntry[]) {
  const answered = records.filter((record) => record.outcome !== 'unanswered');
  const first = answered.filter((record) => record.attemptNumber === 1);
  const repeat = answered.filter((record) => record.attemptNumber > 1);
  const times = answered.map((record) => record.elapsedMs);
  return {
    total: records.length,
    correct: records.filter((record) => record.outcome === 'correct').length,
    incorrect: records.filter((record) => record.outcome === 'incorrect')
      .length,
    unanswered: records.filter((record) => record.outcome === 'unanswered')
      .length,
    elapsedMs: records.reduce((sum, record) => sum + record.elapsedMs, 0),
    answered: answered.length,
    accuracy: answered.length
      ? answered.filter((record) => record.outcome === 'correct').length /
        answered.length
      : null,
    firstAnswered: first.length,
    firstCorrect: first.filter((record) => record.outcome === 'correct').length,
    firstAccuracy: first.length
      ? first.filter((record) => record.outcome === 'correct').length /
        first.length
      : null,
    repeatAnswered: repeat.length,
    repeatCorrect: repeat.filter((record) => record.outcome === 'correct')
      .length,
    medianAnsweredMs: median(times),
  };
}
