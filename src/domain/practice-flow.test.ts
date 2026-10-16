import { describe, expect, it } from 'vitest';
import { question } from '../data/test-fixtures';
import { growthRateQuestions } from '../data/growth-rate-content';
import {
  advanceSessionTime,
  buildGrowthRateSession,
  summarizeAnswers,
  summarizePracticeHistory,
} from './practice-flow';
import { session } from '../data/test-fixtures';

describe('增长率练习规则', () => {
  it('累计当前题用时，保留选择和不确定标记', () => {
    const first = advanceSessionTime(session, 1200);
    const selected = {
      ...first,
      drafts: [
        { ...first.drafts[0]!, selectedOptionIds: ['A'], uncertain: true },
      ],
    };
    expect(advanceSessionTime(selected, 300).drafts[0]).toMatchObject({
      selectedOptionIds: ['A'],
      uncertain: true,
      elapsedMs: 1500,
    });
  });
  it('五道原创题的答案与独立算式核对一致', () => {
    const expected = [
      ['growth-rate-direct-01', 'A', 30 / 120],
      ['growth-rate-decline-02', 'A', -24 / 120],
      ['growth-rate-base-03', 'A', 135 / 1.125],
      ['growth-rate-compound-04', 'B', 1.15 * 1.1 - 1],
      ['growth-rate-compare-05', 'A', 20 / 80 - 30 / 150],
    ] as const;
    expect(expected.map(([id, option]) => [id, option])).toEqual(
      growthRateQuestions.map((item) => [item.id, item.correctOptionIds[0]]),
    );
    [0.25, -0.2, 120, 0.265, 0.05].forEach((value, index) => {
      expect(expected[index]![2]).toBeCloseTo(value);
    });
  });
  it('只从五道合格增长率单选题建立冻结会话', () => {
    const questions = Array.from({ length: 5 }, (_, index) => ({
      ...question,
      id: `q${index}`,
    }));
    const result = buildGrowthRateSession(
      questions,
      'new-session',
      '2026-10-16T10:00:00.000Z',
    );
    expect(result.questionRefs).toEqual(
      questions.map(({ id }) => ({ id, version: 1 })),
    );
    expect(result.explanationMode).toBe('after-submit');
    expect(() =>
      buildGrowthRateSession(questions.slice(0, 4), 's', result.startedAt),
    ).toThrow();
    expect(
      buildGrowthRateSession(
        [...questions, { ...question, id: 'q5' }],
        's',
        result.startedAt,
      ).questionRefs,
    ).toHaveLength(5);
    expect(() =>
      buildGrowthRateSession(
        [{ ...questions[0]!, reviewStatus: 'draft' }, ...questions.slice(1)],
        's',
        result.startedAt,
      ),
    ).toThrow();
  });

  it('正确、错误和未答分别计数；未答不进入首次正确率', () => {
    const records = [
      { outcome: 'correct', elapsedMs: 1000, attemptNumber: 1 },
      { outcome: 'incorrect', elapsedMs: 3000, attemptNumber: 1 },
      { outcome: 'unanswered', elapsedMs: 0, attemptNumber: 1 },
      { outcome: 'correct', elapsedMs: 2000, attemptNumber: 2 },
      { outcome: 'incorrect', elapsedMs: 5000, attemptNumber: 2 },
    ] as const;
    expect(summarizeAnswers(records)).toEqual({
      total: 5,
      correct: 2,
      incorrect: 2,
      unanswered: 1,
      elapsedMs: 11000,
      answered: 4,
      accuracy: 0.5,
      firstAnswered: 2,
      firstCorrect: 1,
      firstAccuracy: 0.5,
      repeatAnswered: 2,
      repeatCorrect: 1,
      medianAnsweredMs: 2500,
    });
  });
  it('按相同难度区分首次与重复作答用时，并保留不确定次数', () => {
    const rows = summarizePracticeHistory([
      {
        difficulty: 'easy',
        outcome: 'correct',
        elapsedMs: 1000,
        attemptNumber: 1,
        uncertain: false,
      },
      {
        difficulty: 'easy',
        outcome: 'incorrect',
        elapsedMs: 3000,
        attemptNumber: 1,
        uncertain: true,
      },
      {
        difficulty: 'easy',
        outcome: 'correct',
        elapsedMs: 500,
        attemptNumber: 2,
        uncertain: false,
      },
      {
        difficulty: 'medium',
        outcome: 'unanswered',
        elapsedMs: 200,
        attemptNumber: 1,
        uncertain: true,
      },
    ]);
    expect(rows.find((row) => row.difficulty === 'easy')).toMatchObject({
      firstAnswered: 2,
      firstCorrect: 1,
      firstMedianMs: 2000,
      repeatAnswered: 1,
      repeatCorrect: 1,
      repeatMedianMs: 500,
      uncertainCount: 1,
    });
    expect(rows.find((row) => row.difficulty === 'medium')).toMatchObject({
      firstAnswered: 0,
      firstMedianMs: null,
      uncertainCount: 1,
    });
  });
});
