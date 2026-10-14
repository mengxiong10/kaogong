import { z } from 'zod';

export const IdSchema = z.string().trim().min(1);
export const VersionSchema = z.number().int().positive();
export const TimestampSchema = z.iso.datetime();
export const ReviewStatusSchema = z.enum(['draft', 'reviewed', 'verified']);
export const SourceSchema = z
  .object({
    kind: z.enum(['official', 'licensed', 'original', 'ai-assisted']),
    title: z.string().min(1),
    url: z.url().optional(),
    region: z.string().min(1),
    year: z.number().int().min(2000).max(2100).nullable(),
    license: z
      .object({
        status: z.enum(['unknown', 'permitted', 'restricted']),
        description: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export const ContentRefSchema = z
  .object({ id: IdSchema, version: VersionSchema })
  .strict();
export type ContentRef = z.infer<typeof ContentRefSchema>;
export const refKey = (ref: ContentRef) => `${ref.id}@${ref.version}`;
export const unique = (values: readonly string[]) =>
  new Set(values).size === values.length;
