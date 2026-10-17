import { describe, expect, it } from 'vitest';
import growthRateContent from '../content/growth-rate.json';
import {
  advanceSessionTime,
  summarizeAnswers,
  summarizePracticeHistory,
} from './practice-flow';
import { session } from '../data/test-fixtures';

const growthRateQuestions = growthRateContent.questions;

describe('练习规则与原创题内容核算', () => {
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
