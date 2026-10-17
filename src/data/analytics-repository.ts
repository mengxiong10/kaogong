import {
  LessonProgressSchema,
  MistakeStateSchema,
  AnswerRecordSchema,
} from '../domain/learning';
import { PracticeSessionSchema } from '../domain/practice';
import { QuestionSchema } from '../domain/questions';
import { refKey } from '../domain/common';
import type { LearningDatabase } from './database';

/** A consistent, validated read of the records used by the learning report. */
export class AnalyticsRepository {
  constructor(private readonly db: LearningDatabase) {}

  async getSnapshot() {
    return this.db.transaction(
      'r',
      [
        this.db.answers,
        this.db.sessions,
        this.db.questions,
        this.db.lessonProgress,
        this.db.mistakes,
      ],
      async () => {
        const answers = (await this.db.answers.toArray()).map((row) =>
          AnswerRecordSchema.parse(row),
        );
        const sessions = (await this.db.sessions.toArray()).map((row) =>
          PracticeSessionSchema.parse(row),
        );
        const refs = [
          ...new Map(
            answers.map((answer) => [
              refKey(answer.questionRef),
              answer.questionRef,
            ]),
          ).values(),
        ];
        const questions = (
          await this.db.questions.bulkGet(
            refs.map((ref) => [ref.id, ref.version]),
          )
        ).map((row) => QuestionSchema.parse(row));
        const lessonProgress = (await this.db.lessonProgress.toArray()).map(
          (row) => LessonProgressSchema.parse(row),
        );
        const mistakes = (await this.db.mistakes.toArray()).map((row) =>
          MistakeStateSchema.parse(row),
        );
        return { answers, sessions, questions, lessonProgress, mistakes };
      },
    );
  }
}
