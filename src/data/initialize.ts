import { CatalogSchema, type Catalog } from '../domain/validate-catalog';
import type { LearningDatabase } from './database';
import { seedCatalog } from './seed';

export async function initializeDatabase(
  db: LearningDatabase,
  input: unknown = seedCatalog,
): Promise<void> {
  const seed = CatalogSchema.parse(input);
  await db.open();
  await db.transaction(
    'rw',
    [db.examProfiles, db.modules, db.knowledgePoints, db.metadata],
    async () => {
      // 只补充缺失项；已有目录和用户学习记录均保留。
      for (const exam of seed.examProfiles)
        if (!(await db.examProfiles.get(exam.id)))
          await db.examProfiles.add(exam);
      for (const module of seed.modules)
        if (!(await db.modules.get(module.id))) await db.modules.add(module);
      for (const point of seed.knowledgePoints)
        if (!(await db.knowledgePoints.get(point.id)))
          await db.knowledgePoints.add(point);
      CatalogSchema.parse({
        examProfiles: await db.examProfiles.toArray(),
        modules: await db.modules.toArray(),
        knowledgePoints: await db.knowledgePoints.toArray(),
      } satisfies Catalog);
      if (!(await db.metadata.get('seed-v1')))
        await db.metadata.add({
          key: 'seed-v1',
          value: new Date().toISOString(),
        });
    },
  );
}
