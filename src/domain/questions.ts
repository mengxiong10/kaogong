import { z } from 'zod';
import {
  ContentRefSchema,
  IdSchema,
  ReviewStatusSchema,
  SourceSchema,
  unique,
  VersionSchema,
} from './common';

export const QuestionMaterialSchema = z
  .object({
    id: IdSchema,
    version: VersionSchema,
    title: z.string().min(1),
    bodyMarkdown: z.string().min(1),
    source: SourceSchema,
    reviewStatus: ReviewStatusSchema,
  })
  .strict();
export const QuestionSchema = z
  .object({
    id: IdSchema,
    version: VersionSchema,
    type: z.enum(['single', 'multiple']),
    stemMarkdown: z.string().min(1),
    options: z
      .array(
        z.object({ id: IdSchema, bodyMarkdown: z.string().min(1) }).strict(),
      )
      .min(2),
    correctOptionIds: z.array(IdSchema).min(1),
    explanationMarkdown: z.string().min(1),
    knowledgePointIds: z.array(IdSchema).min(1),
    materialRef: ContentRefSchema.nullable(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    source: SourceSchema,
    reviewStatus: ReviewStatusSchema,
  })
  .strict()
  .superRefine((question, ctx) => {
    const optionIds = question.options.map((option) => option.id);
    if (!unique(optionIds))
      ctx.addIssue({
        code: 'custom',
        message: '选项 ID 重复',
        path: ['options'],
      });
    if (
      !unique(question.correctOptionIds) ||
      question.correctOptionIds.some((id) => !optionIds.includes(id))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '正确答案必须引用不重复的有效选项',
        path: ['correctOptionIds'],
      });
    }
    if (question.type === 'single' && question.correctOptionIds.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: '单选题必须有一个正确选项',
        path: ['correctOptionIds'],
      });
    }
    if (question.type === 'multiple' && question.correctOptionIds.length < 2) {
      ctx.addIssue({
        code: 'custom',
        message: '多选题必须有至少两个正确选项',
        path: ['correctOptionIds'],
      });
    }
    if (!unique(question.knowledgePointIds))
      ctx.addIssue({
        code: 'custom',
        message: '知识点重复',
        path: ['knowledgePointIds'],
      });
  });
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionMaterial = z.infer<typeof QuestionMaterialSchema>;
