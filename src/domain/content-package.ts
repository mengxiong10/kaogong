import { z } from 'zod';
import { LessonSchema } from './catalog';
import { QuestionMaterialSchema, QuestionSchema } from './questions';

export const ContentBatchSchema = z
  .object({
    lessons: z.array(LessonSchema).default([]),
    materials: z.array(QuestionMaterialSchema).default([]),
    questions: z.array(QuestionSchema).default([]),
  })
  .strict();

export const BankManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    visibility: z.literal('private'),
    source: z.literal('ERRRC/xingcezhenti'),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
    questionCount: z.number().int().min(1000),
    materialCount: z.number().int().positive(),
    assetCount: z.number().int().nonnegative(),
    chunks: z
      .array(
        z
          .object({
            file: z.string().regex(/^questions-\d{3}\.json$/),
            count: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const ModuleBankManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    visibility: z.literal('private'),
    source: z.literal('ERRRC/xingcezhenti'),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
    moduleId: z.enum([
      'politics',
      'general',
      'verbal',
      'quantitative',
      'reasoning',
      'data-analysis',
    ]),
    questionCount: z.number().int().positive(),
    materialCount: z.number().int().nonnegative(),
    chunks: z
      .array(
        z
          .object({
            file: z.string().regex(/^questions-\d{3}\.json$/),
            count: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .refine(
    (manifest) =>
      manifest.chunks.reduce((total, chunk) => total + chunk.count, 0) ===
      manifest.questionCount,
    '模块题库分包总数不一致',
  );
