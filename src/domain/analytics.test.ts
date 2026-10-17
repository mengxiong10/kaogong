import { describe, expect, it } from 'vitest';
import catalogJson from '../content/catalog.json';
import growthRate from '../content/growth-rate.json';
import { answerInput, question, session } from '../data/test-fixtures';
import { LessonSchema } from './catalog';
import { CatalogSchema } from './validate-catalog';
import type { AnalyticsSnapshot } from './analytics';
import { summarizeLearningReport } from './analytics';

const catalog = {
  ...CatalogSchema.parse(catalogJson),
  lessons: growthRate.lessons.map((lesson) => LessonSchema.parse(lesson)),
};

function emptySnapshot(): AnalyticsSnapshot {
  return {
    answers: [],
    sessions: [],
    questions: [],
    lessonProgress: [],
    mistakes: [],
  };
}

describe('学习报告统计', () => {
  it('空记录不显示虚构正确率，课程完成只计当前版本', () => {
    const snapshot = emptySnapshot();
    snapshot.lessonProgress = [
      {
        lessonId: 'lesson-data-analysis-growth-rate',
        lessonVersion: 1,
        status: 'completed',
        updatedAt: answerInput.answeredAt,
      },
    ];
    const report = summarizeLearningReport(snapshot, catalog);
    expect(report.recent.first.accuracy).toBeNull();
    expect(report.totalAnsweredQuestions).toBe(0);
    expect(report.lessons.completed).toBe(0);
  });

  it('首次留空后的作答算重做，按冻结版本归类并排除第11套', () => {
    const snapshot = emptySnapshot();
    snapshot.questions = [
      question,
      {
        ...question,
        version: 2,
        knowledgePointIds: ['data-analysis-proportion'],
      },
    ];
    snapshot.sessions = Array.from({ length: 11 }, (_, index) => ({
      ...session,
      id: `s${index + 1}`,
      questionRefs: [{ id: question.id, version: index === 0 ? 1 : 2 }],
      status: 'completed' as const,
      completedAt: `2026-10-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    }));
    snapshot.answers = snapshot.sessions.map((item, index) => ({
      ...answerInput,
      id: `a${index + 1}`,
      sessionId: item.id,
      questionRef: item.questionRefs[0]!,
      outcome: index === 0 ? ('unanswered' as const) : ('correct' as const),
      selectedOptionIds: index === 0 ? [] : ['A'],
      attemptNumber: index + 1,
      elapsedMs: index * 1000,
      answeredAt: item.completedAt!,
    }));
    const report = summarizeLearningReport(snapshot, catalog);
    expect(report.recent.sessions).toHaveLength(10);
    expect(report.recent.first.answered).toBe(0);
    expect(report.recent.repeat).toMatchObject({
      answered: 10,
      correct: 10,
      medianMs: 5500,
    });
    expect(report.totalAnsweredQuestions).toBe(1);
    expect(
      report.knowledgePoints.find(
        (point) => point.id === 'data-analysis-growth-rate',
      )?.first.answered,
    ).toBe(0);
    expect(
      report.knowledgePoints.find(
        (point) => point.id === 'data-analysis-proportion',
      )?.repeat.answered,
    ).toBe(10);
  });

  it('重复题不抬高首次正确率，多知识点分别计数但模块只计一次', () => {
    const snapshot = emptySnapshot();
    snapshot.questions = [
      {
        ...question,
        knowledgePointIds: [
          'data-analysis-growth-rate',
          'data-analysis-proportion',
        ],
      },
    ];
    snapshot.sessions = [
      { ...session, status: 'completed', completedAt: answerInput.answeredAt },
      {
        ...session,
        id: 's2',
        status: 'completed',
        completedAt: '2026-10-15T10:01:00.000Z',
      },
    ];
    snapshot.answers = [
      {
        ...answerInput,
        outcome: 'incorrect',
        selectedOptionIds: ['B'],
        attemptNumber: 1,
      },
      {
        ...answerInput,
        id: 'a2',
        sessionId: 's2',
        answeredAt: '2026-10-15T10:01:00.000Z',
        attemptNumber: 2,
      },
    ];
    const report = summarizeLearningReport(snapshot, catalog);
    const module = report.modules.find((item) => item.id === 'data-analysis');
    expect(report.recent.first).toMatchObject({
      answered: 1,
      correct: 0,
      accuracy: 0,
    });
    expect(report.recent.repeat).toMatchObject({
      answered: 1,
      correct: 1,
      accuracy: 1,
    });
    expect(module?.first.answered).toBe(1);
    expect(
      report.knowledgePoints.filter((point) => point.first.answered === 1),
    ).toHaveLength(2);
  });
});
