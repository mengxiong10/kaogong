import type { CatalogView } from './validate-catalog';
import type { AnswerRecord, LessonProgress, MistakeState } from './learning';
import type { PracticeSession } from './practice';
import type { Question } from './questions';
import { refKey } from './common';

export type AnalyticsSnapshot = {
  answers: AnswerRecord[];
  sessions: PracticeSession[];
  questions: Question[];
  lessonProgress: LessonProgress[];
  mistakes: MistakeState[];
};

export type Score = {
  answered: number;
  correct: number;
  accuracy: number | null;
  medianMs: number | null;
};

type ScoredAnswer = { answer: AnswerRecord; question: Question };

function score(rows: readonly ScoredAnswer[]): Score {
  const answered = rows.filter((row) => row.answer.outcome !== 'unanswered');
  const times = answered
    .map((row) => row.answer.elapsedMs)
    .sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const correct = answered.filter(
    (row) => row.answer.outcome === 'correct',
  ).length;
  return {
    answered: answered.length,
    correct,
    accuracy: answered.length ? correct / answered.length : null,
    medianMs: times.length
      ? times.length % 2
        ? times[middle]!
        : (times[middle - 1]! + times[middle]!) / 2
      : null,
  };
}

function splitScores(rows: readonly ScoredAnswer[]) {
  return {
    first: score(rows.filter((row) => row.answer.attemptNumber === 1)),
    repeat: score(rows.filter((row) => row.answer.attemptNumber > 1)),
  };
}

export function summarizeLearningReport(
  snapshot: AnalyticsSnapshot,
  catalog: CatalogView,
) {
  const questions = new Map(
    snapshot.questions.map((question) => [refKey(question), question]),
  );
  const pointModules = new Map(
    catalog.knowledgePoints.map((point) => [point.id, point.moduleId]),
  );
  const rows = snapshot.answers.map((answer) => {
    const question = questions.get(refKey(answer.questionRef));
    if (!question) throw new Error('历史题目版本缺失');
    return { answer, question };
  });
  const completedSessions = snapshot.sessions
    .filter((session) => session.status === 'completed' && session.completedAt)
    .sort(
      (a, b) =>
        b.completedAt!.localeCompare(a.completedAt!) ||
        a.id.localeCompare(b.id),
    );
  const recent = completedSessions.slice(0, 10);
  const recentIds = new Set(recent.map((session) => session.id));
  const recentRows = rows.filter((row) => recentIds.has(row.answer.sessionId));
  const latestLessons = new Map<string, number>();
  for (const lesson of catalog.lessons) {
    latestLessons.set(
      lesson.id,
      Math.max(latestLessons.get(lesson.id) ?? 0, lesson.version),
    );
  }
  const currentProgress = snapshot.lessonProgress.filter(
    (item) => latestLessons.get(item.lessonId) === item.lessonVersion,
  );
  const answeredQuestions = new Set(
    rows
      .filter((row) => row.answer.outcome !== 'unanswered')
      .map((row) => row.answer.questionRef.id),
  );
  const group = (matches: (row: ScoredAnswer) => boolean) =>
    splitScores(rows.filter(matches));
  return {
    totalAnsweredQuestions: answeredQuestions.size,
    totalSubmissions: rows.length,
    pendingMistakes: snapshot.mistakes.filter(
      (item) => item.status === 'pending',
    ).length,
    masteredMistakes: snapshot.mistakes.filter(
      (item) => item.status === 'mastered',
    ).length,
    lessons: {
      total: latestLessons.size,
      completed: currentProgress.filter((item) =>
        ['completed', 'basic-mastery'].includes(item.status),
      ).length,
      learning: currentProgress.filter((item) => item.status === 'learning')
        .length,
    },
    recent: {
      ...splitScores(recentRows),
      sessions: recent.map((session) => {
        const sessionRows = rows.filter(
          (row) => row.answer.sessionId === session.id,
        );
        const moduleIds = [
          ...new Set(
            sessionRows.flatMap((row) =>
              row.question.knowledgePointIds.flatMap((id) =>
                pointModules.has(id) ? [pointModules.get(id)!] : [],
              ),
            ),
          ),
        ];
        return {
          id: session.id,
          completedAt: session.completedAt!,
          moduleIds,
          total: sessionRows.length,
          unanswered: sessionRows.filter(
            (row) => row.answer.outcome === 'unanswered',
          ).length,
          ...splitScores(sessionRows),
        };
      }),
    },
    modules: catalog.modules.map((module) => ({
      id: module.id,
      title: module.title,
      ...group((row) =>
        row.question.knowledgePointIds.some(
          (id) => pointModules.get(id) === module.id,
        ),
      ),
    })),
    knowledgePoints: catalog.knowledgePoints
      .filter((point) => point.kind !== 'category')
      .map((point) => ({
        id: point.id,
        moduleId: point.moduleId,
        title: point.title,
        ...group((row) => row.question.knowledgePointIds.includes(point.id)),
      })),
  };
}
