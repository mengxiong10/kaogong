import { z } from 'zod';
import {
  ExamProfileSchema,
  KnowledgePointSchema,
  LessonSchema,
  ModuleSchema,
} from './catalog';
import { unique } from './common';

export const CatalogSchema = z
  .object({
    examProfiles: z.array(ExamProfileSchema),
    modules: z.array(ModuleSchema),
    knowledgePoints: z.array(KnowledgePointSchema),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    for (const [name, items] of Object.entries(catalog)) {
      if (!unique(items.map((item) => item.id)))
        ctx.addIssue({ code: 'custom', message: `${name} ID 重复` });
    }
    const examIds = new Set(catalog.examProfiles.map((exam) => exam.id));
    const moduleIds = new Set(catalog.modules.map((module) => module.id));
    const points = new Map(
      catalog.knowledgePoints.map((point) => [point.id, point]),
    );
    for (const module of catalog.modules) {
      if (!examIds.has(module.examProfileId))
        ctx.addIssue({ code: 'custom', message: '模块考试档案不存在' });
    }
    for (const point of catalog.knowledgePoints) {
      if (!moduleIds.has(point.moduleId))
        ctx.addIssue({ code: 'custom', message: '知识点模块不存在' });
      if (point.parentId !== null) {
        const parent = points.get(point.parentId);
        if (!parent || parent.moduleId !== point.moduleId)
          ctx.addIssue({ code: 'custom', message: '父知识点不存在或跨模块' });
      }
      const seen = new Set<string>();
      let current: typeof point | undefined = point;
      while (current) {
        if (seen.has(current.id)) {
          ctx.addIssue({ code: 'custom', message: '知识树存在循环' });
          break;
        }
        seen.add(current.id);
        current =
          current.parentId === null ? undefined : points.get(current.parentId);
      }
    }
  });
export type Catalog = z.infer<typeof CatalogSchema>;
export type CatalogView = Catalog & { lessons: z.infer<typeof LessonSchema>[] };
