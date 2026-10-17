import { describe, expect, it } from 'vitest';
import seedCatalog from '../content/catalog.json';
import { CatalogSchema } from './validate-catalog';
import { QuestionSchema } from './questions';
import {
  AnswerRecordSchema,
  LessonProgressSchema,
  MistakeStateSchema,
} from './learning';
import { PracticeSessionSchema } from './practice';
import { question, session, answerInput } from '../data/test-fixtures';

describe('内容与学习数据校验', () => {
  it('种子目录含六模块、47知识点、6教学分类', () => {
    expect(CatalogSchema.parse(seedCatalog).modules).toHaveLength(6);
    expect(
      seedCatalog.knowledgePoints.filter((point) => point.kind !== 'category'),
    ).toHaveLength(47);
    expect(
      seedCatalog.knowledgePoints.filter((point) => point.kind === 'category'),
    ).toHaveLength(6);
  });
  it.each([
    [
      '重复选项',
      {
        options: [
          { id: 'A', bodyMarkdown: '1' },
          { id: 'A', bodyMarkdown: '2' },
        ],
      },
    ],
    ['无效答案', { correctOptionIds: ['Z'] }],
    ['重复答案', { correctOptionIds: ['A', 'A'] }],
    ['单选多答案', { correctOptionIds: ['A', 'B'] }],
    ['多选一个答案', { type: 'multiple' }],
    ['非法审核状态', { reviewStatus: 'published' }],
    ['缺少题干', { stemMarkdown: undefined }],
    [
      '重复知识点',
      {
        knowledgePointIds: [
          'data-analysis-growth-rate',
          'data-analysis-growth-rate',
        ],
      },
    ],
    ['无许可信息', { source: { ...question.source, license: undefined } }],
  ])('拒绝%s', (_, change) => {
    expect(QuestionSchema.safeParse({ ...question, ...change }).success).toBe(
      false,
    );
  });
  it('许可与校验状态独立，draft和unknown可保存但不能训练', () => {
    expect(
      QuestionSchema.parse({
        ...question,
        reviewStatus: 'draft',
        source: {
          ...question.source,
          license: { status: 'unknown', description: '待核对' },
        },
      }).reviewStatus,
    ).toBe('draft');
  });
  it.each(['duplicate', 'orphan', 'cycle', 'cross-module'] as const)(
    '拒绝目录错误 %s',
    (kind) => {
      const data = structuredClone(seedCatalog);
      const first = data.knowledgePoints[0]!;
      if (kind === 'duplicate') data.knowledgePoints.push({ ...first });
      if (kind === 'orphan') first.parentId = 'missing';
      if (kind === 'cycle') first.parentId = data.knowledgePoints[1]!.id;
      if (kind === 'cross-module') first.parentId = 'general-foundation';
      expect(CatalogSchema.safeParse(data).success).toBe(false);
    },
  );
  it('拒绝模块关联不存在的考试档案', () => {
    const data = structuredClone(seedCatalog);
    data.modules[0]!.examProfileId = 'missing';
    expect(CatalogSchema.safeParse(data).success).toBe(false);
  });
  it.each([
    { currentIndex: 1 },
    {
      questionRefs: [question, question].map(({ id, version }) => ({
        id,
        version,
      })),
    },
    { status: 'completed' },
    { completedAt: '2026-10-14T10:05:00.000Z' },
    {
      drafts: [
        {
          questionRef: { id: 'missing', version: 1 },
          selectedOptionIds: [],
          elapsedMs: 0,
          uncertain: false,
        },
      ],
    },
    { status: 'completed', completedAt: '2026-10-13T10:00:00.000Z' },
  ])('拒绝非法会话 %j', (change) => {
    expect(
      PracticeSessionSchema.safeParse({ ...session, ...change }).success,
    ).toBe(false);
  });
  it('拒绝未作答状态与所选答案不一致', () => {
    expect(
      AnswerRecordSchema.safeParse({
        ...answerInput,
        attemptNumber: 1,
        outcome: 'unanswered',
      }).success,
    ).toBe(false);
  });
  it('完成时间比较按时间值，允许等价的不同毫秒精度', () => {
    expect(
      PracticeSessionSchema.safeParse({
        ...session,
        status: 'completed',
        startedAt: '2026-10-14T10:00:00Z',
        completedAt: '2026-10-14T10:00:00.000Z',
      }).success,
    ).toBe(true);
  });
  it('拒绝负耗时与重复选择', () => {
    expect(
      AnswerRecordSchema.safeParse({
        ...answerInput,
        attemptNumber: 1,
        elapsedMs: -1,
      }).success,
    ).toBe(false);
    expect(
      AnswerRecordSchema.safeParse({
        ...answerInput,
        attemptNumber: 1,
        selectedOptionIds: ['A', 'A'],
      }).success,
    ).toBe(false);
  });
  it('学习和错题状态受枚举约束', () => {
    expect(
      LessonProgressSchema.safeParse({
        lessonId: 'lesson',
        lessonVersion: 1,
        status: 'done',
        updatedAt: answerInput.answeredAt,
      }).success,
    ).toBe(false);
    expect(
      MistakeStateSchema.safeParse({
        questionId: 'q1',
        status: 'pending',
        reason: 'typo',
        updatedAt: answerInput.answeredAt,
      }).success,
    ).toBe(false);
  });
});
