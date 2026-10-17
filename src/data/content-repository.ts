import { LessonSchema } from '../domain/catalog';
import {
  isTrainingContentEligible,
  QuestionMaterialSchema,
  QuestionSchema,
} from '../domain/questions';
import type { ContentRef } from '../domain/common';
import { ContentRefSchema } from '../domain/common';
import type { LearningDatabase } from './database';

function assertSameVersion(existing: unknown, incoming: unknown) {
  if (existing && JSON.stringify(existing) !== JSON.stringify(incoming))
    throw new Error('已有内容版本不可覆盖，请增加版本号');
}

export class ContentRepository {
  constructor(private readonly db: LearningDatabase) {}

  async addQuestionVersion(input: unknown): Promise<void> {
    const question = QuestionSchema.parse(input);
    await this.db.transaction(
      'rw',
      [this.db.questions, this.db.knowledgePoints, this.db.materials],
      async () => {
        for (const id of question.knowledgePointIds)
          if (!(await this.db.knowledgePoints.get(id)))
            throw new Error('题目知识点不存在');
        if (
          question.materialRef &&
          !(await this.db.materials.get([
            question.materialRef.id,
            question.materialRef.version,
          ]))
        )
          throw new Error('材料版本不存在');
        const existing = await this.db.questions.get([
          question.id,
          question.version,
        ]);
        assertSameVersion(existing, question);
        if (!existing) await this.db.questions.add(question);
      },
    );
  }

  async addMaterialVersion(input: unknown): Promise<void> {
    const material = QuestionMaterialSchema.parse(input);
    await this.db.transaction('rw', this.db.materials, async () => {
      const existing = await this.db.materials.get([
        material.id,
        material.version,
      ]);
      assertSameVersion(existing, material);
      if (!existing) await this.db.materials.add(material);
    });
  }

  async addLessonVersion(input: unknown): Promise<void> {
    const lesson = LessonSchema.parse(input);
    await this.db.transaction(
      'rw',
      [this.db.lessons, this.db.knowledgePoints, this.db.questions],
      async () => {
        if (!(await this.db.knowledgePoints.get(lesson.knowledgePointId)))
          throw new Error('课程知识点不存在');
        for (const ref of lesson.exampleQuestionRefs)
          if (!(await this.db.questions.get([ref.id, ref.version])))
            throw new Error('例题版本不存在');
        const existing = await this.db.lessons.get([lesson.id, lesson.version]);
        assertSameVersion(existing, lesson);
        if (!existing) await this.db.lessons.add(lesson);
      },
    );
  }

  async getQuestion(input: ContentRef) {
    const ref = ContentRefSchema.parse(input);
    const row = await this.db.questions.get([ref.id, ref.version]);
    return row ? QuestionSchema.parse(row) : undefined;
  }

  async getLatestTrainingQuestion(id: string) {
    const rows = await this.db.questions
      .where('id')
      .equals(ContentRefSchema.shape.id.parse(id))
      .toArray();
    for (const row of rows.sort((a, b) => b.version - a.version)) {
      const question = QuestionSchema.parse(row);
      if (!isTrainingContentEligible(question)) continue;
      if (question.materialRef) {
        const material = await this.getMaterial(question.materialRef);
        if (!material || !isTrainingContentEligible(material)) continue;
      }
      return question;
    }
    return undefined;
  }

  async getTrainingQuestions(knowledgePointId: string) {
    const id = ContentRefSchema.shape.id.parse(knowledgePointId);
    const rows = await this.db.questions
      .where('knowledgePointIds')
      .equals(id)
      .toArray();
    const latest = new Map<string, ReturnType<typeof QuestionSchema.parse>>();
    const materialEligibility = new Map<string, boolean>();
    for (const row of rows) {
      const question = QuestionSchema.parse(row);
      if (!isTrainingContentEligible(question)) continue;
      if (question.materialRef) {
        const key = `${question.materialRef.id}@${question.materialRef.version}`;
        if (!materialEligibility.has(key)) {
          const material = await this.getMaterial(question.materialRef);
          materialEligibility.set(
            key,
            Boolean(material && isTrainingContentEligible(material)),
          );
        }
        if (!materialEligibility.get(key)) continue;
      }
      if (
        !latest.has(question.id) ||
        latest.get(question.id)!.version < question.version
      )
        latest.set(question.id, question);
    }
    const difficultyOrder = { easy: 0, medium: 1, hard: 2, unrated: 3 };
    return [...latest.values()].sort(
      (a, b) =>
        difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty] ||
        a.id.localeCompare(b.id),
    );
  }

  async getMaterial(input: ContentRef) {
    const ref = ContentRefSchema.parse(input);
    const row = await this.db.materials.get([ref.id, ref.version]);
    return row ? QuestionMaterialSchema.parse(row) : undefined;
  }
}
