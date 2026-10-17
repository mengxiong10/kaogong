import { z } from 'zod';
import {
  IdSchema,
  ReviewStatusSchema,
  SourceSchema,
  VersionSchema,
} from './common';

export const ExamProfileSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1),
    region: z.string().min(1),
    year: z.number().int().min(2000).max(2100),
    outline: SourceSchema,
    checkedAt: z.iso.date(),
  })
  .strict();
export const ModuleSchema = z
  .object({
    id: IdSchema,
    examProfileId: IdSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    order: z.number().int().nonnegative(),
    classification: z.literal('official'),
  })
  .strict();
export const KnowledgePointSchema = z
  .object({
    id: IdSchema,
    moduleId: IdSchema,
    parentId: IdSchema.nullable(),
    title: z.string().min(1),
    order: z.number().int().nonnegative(),
    kind: z.enum(['category', 'knowledge', 'method']),
    classification: z.literal('teaching'),
  })
  .strict();
export const LessonSchema = z
  .object({
    id: IdSchema,
    version: VersionSchema,
    knowledgePointId: IdSchema,
    title: z.string().min(1),
    bodyMarkdown: z.string().min(1),
    exampleQuestionRefs: z.array(
      z.object({ id: IdSchema, version: VersionSchema }).strict(),
    ),
    source: SourceSchema,
    reviewStatus: ReviewStatusSchema,
  })
  .strict();

export type ExamProfile = z.infer<typeof ExamProfileSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type KnowledgePoint = z.infer<typeof KnowledgePointSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
