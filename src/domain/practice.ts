import { z } from 'zod';
import {
  ContentRefSchema,
  IdSchema,
  refKey,
  TimestampSchema,
  unique,
} from './common';

export const PracticeSessionSchema = z
  .object({
    id: IdSchema,
    questionRefs: z.array(ContentRefSchema).min(1),
    status: z.enum(['active', 'completed']),
    explanationMode: z.enum(['immediate', 'after-submit']),
    currentIndex: z.number().int().nonnegative(),
    drafts: z.array(
      z
        .object({
          questionRef: ContentRefSchema,
          selectedOptionIds: z.array(IdSchema),
          uncertain: z.boolean(),
          elapsedMs: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
  })
  .strict()
  .superRefine((session, ctx) => {
    const keys = session.questionRefs.map(refKey);
    if (!unique(session.questionRefs.map((ref) => ref.id))) {
      ctx.addIssue({
        code: 'custom',
        message: '会话题目重复',
        path: ['questionRefs'],
      });
    }
    if (session.currentIndex >= keys.length)
      ctx.addIssue({
        code: 'custom',
        message: '题号超出范围',
        path: ['currentIndex'],
      });
    if (!unique(session.drafts.map((draft) => refKey(draft.questionRef)))) {
      ctx.addIssue({ code: 'custom', message: '草稿重复', path: ['drafts'] });
    }
    for (const draft of session.drafts) {
      if (
        !keys.includes(refKey(draft.questionRef)) ||
        !unique(draft.selectedOptionIds)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: '草稿引用或选项无效',
          path: ['drafts'],
        });
      }
    }
    if ((session.status === 'completed') !== (session.completedAt !== null)) {
      ctx.addIssue({
        code: 'custom',
        message: '完成状态与时间不一致',
        path: ['completedAt'],
      });
    }
    if (
      session.completedAt &&
      Date.parse(session.completedAt) < Date.parse(session.startedAt)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '完成时间早于开始时间',
        path: ['completedAt'],
      });
    }
  });
export type PracticeSession = z.infer<typeof PracticeSessionSchema>;
