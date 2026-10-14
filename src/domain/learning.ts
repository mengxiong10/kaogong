import { z } from 'zod';
import { ContentRefSchema, IdSchema, TimestampSchema } from './common';

export const LessonProgressSchema = z
  .object({
    lessonId: IdSchema,
    lessonVersion: z.number().int().positive(),
    status: z.enum(['not-started', 'learning', 'completed', 'basic-mastery']),
    updatedAt: TimestampSchema,
  })
  .strict();
export const MistakeStateSchema = z
  .object({
    questionId: IdSchema,
    status: z.enum(['pending', 'mastered']),
    reason: z
      .enum(['knowledge', 'formula', 'reading', 'calculation', 'time', 'other'])
      .nullable(),
    updatedAt: TimestampSchema,
  })
  .strict();
export const AnswerRecordSchema = z
  .object({
    id: IdSchema,
    sessionId: IdSchema,
    questionRef: ContentRefSchema,
    selectedOptionIds: z.array(IdSchema),
    outcome: z.enum(['correct', 'incorrect', 'unanswered']),
    elapsedMs: z.number().int().nonnegative(),
    answeredAt: TimestampSchema,
    attemptNumber: z.number().int().positive(),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (
      new Set(record.selectedOptionIds).size !== record.selectedOptionIds.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '作答选项重复',
        path: ['selectedOptionIds'],
      });
    }
    if (
      (record.outcome === 'unanswered') !==
      (record.selectedOptionIds.length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '未作答状态与选项不一致',
        path: ['outcome'],
      });
    }
  });
export type LessonProgress = z.infer<typeof LessonProgressSchema>;
export type MistakeState = z.infer<typeof MistakeStateSchema>;
export type AnswerRecord = z.infer<typeof AnswerRecordSchema>;
