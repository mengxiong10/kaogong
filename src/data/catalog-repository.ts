import { LessonProgressSchema, MistakeStateSchema } from '../domain/learning';
import { CatalogSchema, type CatalogView } from '../domain/validate-catalog';
import { LessonSchema } from '../domain/catalog';
import type { LearningDatabase } from './database';

export class CatalogRepository {
  constructor(private readonly db: LearningDatabase) {}

  async getCatalog(): Promise<CatalogView> {
    return this.db.transaction(
      'r',
      [
        this.db.examProfiles,
        this.db.modules,
        this.db.knowledgePoints,
        this.db.lessons,
      ],
      async () => {
        const catalog = CatalogSchema.parse({
          examProfiles: await this.db.examProfiles.toArray(),
          modules: await this.db.modules.toArray(),
          knowledgePoints: await this.db.knowledgePoints.toArray(),
        });
        const lessons = (await this.db.lessons.toArray()).map((lesson) =>
          LessonSchema.parse(lesson),
        );
        for (const lesson of lessons) {
          if (
            !catalog.knowledgePoints.some(
              (point) => point.id === lesson.knowledgePointId,
            )
          )
            throw new Error('课程关联知识点不存在');
        }
        return {
          ...catalog,
          modules: catalog.modules.sort((a, b) => a.order - b.order),
          lessons,
        };
      },
    );
  }

  async saveLessonProgress(input: unknown): Promise<void> {
    const progress = LessonProgressSchema.parse(input);
    await this.db.transaction(
      'rw',
      [this.db.lessons, this.db.lessonProgress],
      async () => {
        if (
          !(await this.db.lessons.get([
            progress.lessonId,
            progress.lessonVersion,
          ]))
        )
          throw new Error('课程版本不存在');
        await this.db.lessonProgress.put(progress);
      },
    );
  }

  async getLessonProgress() {
    return (await this.db.lessonProgress.toArray()).map((row) =>
      LessonProgressSchema.parse(row),
    );
  }

  async saveMistakeState(input: unknown): Promise<void> {
    const state = MistakeStateSchema.parse(input);
    await this.db.transaction(
      'rw',
      [this.db.questions, this.db.mistakes],
      async () => {
        if (
          !(await this.db.questions
            .where('id')
            .equals(state.questionId)
            .count())
        )
          throw new Error('题目不存在');
        await this.db.mistakes.put(state);
      },
    );
  }
}
