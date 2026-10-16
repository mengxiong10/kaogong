import { CatalogSchema, type Catalog } from '../domain/validate-catalog';
import type { LearningDatabase } from './database';
import { seedCatalog } from './seed';
import { growthRateLesson, growthRateQuestions } from './growth-rate-content';
import { LessonSchema } from '../domain/catalog';
import { QuestionSchema } from '../domain/questions';

export async function initializeDatabase(
  db: LearningDatabase,
  input: unknown = seedCatalog,
): Promise<void> {
  const seed = CatalogSchema.parse(input);
  await db.open();
  await db.transaction(
    'rw',
    [
      db.examProfiles,
      db.modules,
      db.knowledgePoints,
      db.lessons,
      db.questions,
      db.metadata,
    ],
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
      const knowledgePointIds = new Set(
        await db.knowledgePoints.toCollection().primaryKeys(),
      );
      for (const question of growthRateQuestions) {
        if (question.knowledgePointIds.some((id) => !knowledgePointIds.has(id)))
          throw new Error('内置题目关联知识点不存在');
        const existing = await db.questions.get([
          question.id,
          question.version,
        ]);
        if (existing) {
          QuestionSchema.parse(existing);
          if (JSON.stringify(existing) !== JSON.stringify(question))
            throw new Error('已有增长率题目版本与内置内容不一致');
        } else await db.questions.add(question);
      }
      const existingLesson = await db.lessons.get([
        growthRateLesson.id,
        growthRateLesson.version,
      ]);
      if (!knowledgePointIds.has(growthRateLesson.knowledgePointId))
        throw new Error('内置课程关联知识点不存在');
      for (const ref of growthRateLesson.exampleQuestionRefs)
        if (!(await db.questions.get([ref.id, ref.version])))
          throw new Error('内置课程例题版本不存在');
      if (existingLesson) {
        LessonSchema.parse(existingLesson);
        if (JSON.stringify(existingLesson) !== JSON.stringify(growthRateLesson))
          throw new Error('已有增长率课程版本与内置内容不一致');
      } else await db.lessons.add(growthRateLesson);
      if (!(await db.metadata.get('seed-v1')))
        await db.metadata.add({
          key: 'seed-v1',
          value: new Date().toISOString(),
        });
    },
  );
}
