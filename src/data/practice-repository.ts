import { z } from 'zod';
import { refKey, IdSchema } from '../domain/common';
import {
  AnswerRecordSchema,
  MistakeStateSchema,
  type AnswerRecord,
} from '../domain/learning';
import { gradeSelection } from '../domain/grading';
import { TimestampSchema } from '../domain/common';
import {
  PracticeSessionSchema,
  type PracticeSession,
} from '../domain/practice';
import {
  isTrainingContentEligible,
  QuestionMaterialSchema,
  QuestionSchema,
  type Question,
} from '../domain/questions';
import type { LearningDatabase } from './database';

export class PracticeRepository {
  constructor(private readonly db: LearningDatabase) {}

  private async validateDrafts(session: PracticeSession) {
    for (const draft of session.drafts) {
      const raw = await this.db.questions.get([
        draft.questionRef.id,
        draft.questionRef.version,
      ]);
      if (!raw) throw new Error('草稿题目版本不存在');
      this.validateSelection(
        QuestionSchema.parse(raw),
        draft.selectedOptionIds,
      );
    }
  }

  private validateSelection(question: Question, selection: string[]) {
    if (
      selection.some(
        (id) => !question.options.some((option) => option.id === id),
      ) ||
      (question.type === 'single' && selection.length > 1)
    )
      throw new Error('作答选项无效');
  }

  async createSession(input: unknown): Promise<void> {
    const session = PracticeSessionSchema.parse(input);
    if (session.status !== 'active') throw new Error('新会话必须为进行中');
    await this.db.transaction(
      'rw',
      [this.db.sessions, this.db.questions, this.db.materials],
      async () => {
        for (const ref of session.questionRefs) {
          const raw = await this.db.questions.get([ref.id, ref.version]);
          if (!raw) throw new Error('会话题目版本不存在');
          const question = QuestionSchema.parse(raw);
          if (!isTrainingContentEligible(question))
            throw new Error('题目尚未校验或未获使用许可');
          if (question.materialRef) {
            const material = QuestionMaterialSchema.parse(
              await this.db.materials.get([
                question.materialRef.id,
                question.materialRef.version,
              ]),
            );
            if (!isTrainingContentEligible(material))
              throw new Error('材料尚未校验或未获使用许可');
          }
        }
        await this.validateDrafts(session);
        await this.db.sessions.add(session);
      },
    );
  }

  async saveSession(input: unknown): Promise<void> {
    const session = PracticeSessionSchema.parse(input);
    await this.db.transaction(
      'rw',
      [this.db.sessions, this.db.questions],
      async () => {
        const raw = await this.db.sessions.get(session.id);
        if (!raw) throw new Error('会话不存在');
        const existing = PracticeSessionSchema.parse(raw);
        if (
          JSON.stringify(existing.questionRefs) !==
            JSON.stringify(session.questionRefs) ||
          existing.startedAt !== session.startedAt ||
          existing.explanationMode !== session.explanationMode
        )
          throw new Error('会话题目顺序、版本与初始配置不可修改');
        if (
          existing.status === 'completed' &&
          JSON.stringify(existing) !== JSON.stringify(session)
        )
          throw new Error('已完成会话不可修改');
        if (existing.status === 'active' && session.status !== 'active')
          throw new Error('请通过整套交卷完成会话');
        await this.validateDrafts(session);
        await this.db.sessions.put(session);
      },
    );
  }

  async getSession(id: string) {
    const row = await this.db.sessions.get(IdSchema.parse(id));
    return row ? PracticeSessionSchema.parse(row) : undefined;
  }

  async getSessions() {
    return (await this.db.sessions.toArray())
      .map((row) => PracticeSessionSchema.parse(row))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async getMistakeStates() {
    return (await this.db.mistakes.toArray())
      .map((row) => MistakeStateSchema.parse(row))
      .sort((a, b) => a.questionId.localeCompare(b.questionId));
  }

  async submitSession(
    id: string,
    completedAt: string,
  ): Promise<AnswerRecord[]> {
    const sessionId = IdSchema.parse(id);
    const timestamp = TimestampSchema.parse(completedAt);
    return this.db.transaction(
      'rw',
      [this.db.sessions, this.db.answers, this.db.questions, this.db.mistakes],
      async () => {
        const raw = await this.db.sessions.get(sessionId);
        if (!raw) throw new Error('会话不存在');
        const session = PracticeSessionSchema.parse(raw);
        const existing = await this.getAnswers(sessionId);
        if (session.status === 'completed') {
          if (existing.length !== session.questionRefs.length)
            throw new Error('已完成会话的答案不完整');
          return session.questionRefs.map((ref) => {
            const record = existing.find(
              (item) => refKey(item.questionRef) === refKey(ref),
            );
            if (!record) throw new Error('已完成会话的答案不完整');
            return record;
          });
        }
        if (existing.length) throw new Error('会话已有逐题记录，不能整套交卷');
        if (Date.parse(timestamp) < Date.parse(session.startedAt))
          throw new Error('交卷时间早于开始时间');
        const records: AnswerRecord[] = [];
        for (const ref of session.questionRefs) {
          const question = QuestionSchema.parse(
            await this.db.questions.get([ref.id, ref.version]),
          );
          const draft = session.drafts.find(
            (item) => refKey(item.questionRef) === refKey(ref),
          );
          const selection = draft?.selectedOptionIds ?? [];
          this.validateSelection(question, selection);
          const attemptNumber =
            (await this.db.answers
              .where('questionRef.id')
              .equals(ref.id)
              .count()) + 1;
          const record = AnswerRecordSchema.parse({
            id: `${sessionId}:${ref.id}`,
            sessionId,
            questionRef: ref,
            selectedOptionIds: selection,
            outcome: gradeSelection(question, selection),
            elapsedMs: draft?.elapsedMs ?? 0,
            answeredAt: timestamp,
            attemptNumber,
          });
          await this.db.answers.add(record);
          if (record.outcome === 'incorrect') {
            const previous = await this.db.mistakes.get(ref.id);
            await this.db.mistakes.put(
              MistakeStateSchema.parse({
                questionId: ref.id,
                status: 'pending',
                reason: previous?.reason ?? null,
                updatedAt: timestamp,
              }),
            );
          }
          records.push(record);
        }
        await this.db.sessions.put(
          PracticeSessionSchema.parse({
            ...session,
            status: 'completed',
            completedAt: timestamp,
          }),
        );
        return records;
      },
    );
  }

  /** 仓储计算提交序号；不信任调用方提供的正确性与外键。 */
  async appendAnswer(
    input: Omit<AnswerRecord, 'attemptNumber'>,
  ): Promise<AnswerRecord> {
    const answer = AnswerRecordSchema.parse({ ...input, attemptNumber: 1 });
    return this.db.transaction(
      'rw',
      [this.db.answers, this.db.sessions, this.db.questions],
      async () => {
        const session = await this.getSession(answer.sessionId);
        if (
          !session ||
          !session.questionRefs.some(
            (ref) => refKey(ref) === refKey(answer.questionRef),
          )
        )
          throw new Error('记录不属于会话题目');
        if (
          Date.parse(answer.answeredAt) < Date.parse(session.startedAt) ||
          (session.completedAt &&
            Date.parse(answer.answeredAt) > Date.parse(session.completedAt))
        )
          throw new Error('作答时间不属于会话');
        if (
          await this.db.answers
            .where('[sessionId+questionRef.id]')
            .equals([answer.sessionId, answer.questionRef.id])
            .count()
        )
          throw new Error('该会话已保存此题作答');
        const raw = await this.db.questions.get([
          answer.questionRef.id,
          answer.questionRef.version,
        ]);
        if (!raw) throw new Error('历史题目版本不存在');
        const question = QuestionSchema.parse(raw);
        this.validateSelection(question, answer.selectedOptionIds);
        const expected = gradeSelection(question, answer.selectedOptionIds);
        if (expected !== answer.outcome)
          throw new Error('作答结果与题目答案不一致');
        const attemptNumber =
          (await this.db.answers
            .where('questionRef.id')
            .equals(answer.questionRef.id)
            .count()) + 1;
        const record = AnswerRecordSchema.parse({ ...answer, attemptNumber });
        await this.db.answers.add(record);
        return record;
      },
    );
  }

  async getAnswers(sessionId?: string): Promise<AnswerRecord[]> {
    const rows =
      sessionId === undefined
        ? await this.db.answers.toArray()
        : await this.db.answers
            .where('sessionId')
            .equals(z.string().min(1).parse(sessionId))
            .toArray();
    return rows
      .map((row) => AnswerRecordSchema.parse(row))
      .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt));
  }
}
