import type { Question } from '../domain/questions';
import type { PracticeSession } from '../domain/practice';
import type { AnswerRecord } from '../domain/learning';

// 仅测试使用；应用不会导入或写入这些内容。
export const question: Question = {
  id: 'q1',
  version: 1,
  type: 'single',
  stemMarkdown: '测试题干',
  options: [
    { id: 'A', bodyMarkdown: '答案 A' },
    { id: 'B', bodyMarkdown: '答案 B' },
  ],
  correctOptionIds: ['A'],
  explanationMarkdown: '测试解析',
  knowledgePointIds: ['data-analysis-growth-rate'],
  materialRef: null,
  difficulty: 'easy',
  reviewStatus: 'verified',
  source: {
    kind: 'original',
    title: '测试专用内容',
    region: '湖北',
    year: null,
    license: { status: 'permitted', description: '仅用于自动化测试' },
  },
};
export const session: PracticeSession = {
  id: 's1',
  questionRefs: [{ id: 'q1', version: 1 }],
  status: 'active',
  explanationMode: 'after-submit',
  currentIndex: 0,
  drafts: [],
  startedAt: '2026-10-14T10:00:00.000Z',
  completedAt: null,
};
export const answerInput: Omit<AnswerRecord, 'attemptNumber'> = {
  id: 'a1',
  sessionId: 's1',
  questionRef: { id: 'q1', version: 1 },
  selectedOptionIds: ['A'],
  outcome: 'correct',
  elapsedMs: 1000,
  answeredAt: '2026-10-14T10:01:00.000Z',
};
