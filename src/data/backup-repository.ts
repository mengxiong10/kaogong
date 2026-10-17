import { z } from 'zod';
import { CatalogSchema, type Catalog } from '../domain/validate-catalog';
import {
  ExamProfileSchema,
  KnowledgePointSchema,
  LessonSchema,
  ModuleSchema,
} from '../domain/catalog';
import {
  AnswerRecordSchema,
  LessonProgressSchema,
  MistakeStateSchema,
} from '../domain/learning';
import { PracticeSessionSchema } from '../domain/practice';
import { QuestionMaterialSchema, QuestionSchema } from '../domain/questions';
import { gradeSelection } from '../domain/grading';
import { refKey } from '../domain/common';
import type { LearningDatabase } from './database';

export const BackupSchema = z
  .object({
    kind: z.literal('kaogong-learning-backup'),
    formatVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    catalog: z
      .object({
        examProfiles: z.array(ExamProfileSchema),
        modules: z.array(ModuleSchema),
        knowledgePoints: z.array(KnowledgePointSchema),
      })
      .strict(),
    lessons: z.array(LessonSchema),
    questions: z.array(QuestionSchema),
    materials: z.array(QuestionMaterialSchema),
    lessonProgress: z.array(LessonProgressSchema),
    sessions: z.array(PracticeSessionSchema),
    answers: z.array(AnswerRecordSchema),
    mistakes: z.array(MistakeStateSchema),
  })
  .strict();

export type LearningBackup = z.infer<typeof BackupSchema>;
export type BackupPreview = {
  sessions: number;
  answers: number;
  lessonProgress: number;
  mistakes: number;
  contentVersions: number;
};

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const key = (row: { id: string; version: number }) => refKey(row);

function uniqueRows<T>(rows: T[], getKey: (row: T) => string, label: string) {
  const seen = new Set<string>();
  for (const row of rows) {
    const id = getKey(row);
    if (seen.has(id)) throw new Error(`备份中${label}重复：${id}`);
    seen.add(id);
  }
}

function validateBackup(backup: LearningBackup) {
  CatalogSchema.parse(backup.catalog);
  uniqueRows(backup.lessons, key, '课程版本');
  uniqueRows(backup.questions, key, '题目版本');
  uniqueRows(backup.materials, key, '材料版本');
  uniqueRows(backup.lessonProgress, (row) => row.lessonId, '课程进度');
  uniqueRows(backup.sessions, (row) => row.id, '会话');
  uniqueRows(backup.answers, (row) => row.id, '作答');
  uniqueRows(backup.mistakes, (row) => row.questionId, '错题状态');
  const lessons = new Set(backup.lessons.map(key));
  const questions = new Set(backup.questions.map(key));
  const materials = new Set(backup.materials.map(key));
  const sessions = new Map(backup.sessions.map((row) => [row.id, row]));
  for (const progress of backup.lessonProgress)
    if (!lessons.has(`${progress.lessonId}@${progress.lessonVersion}`))
      throw new Error('备份缺少课程进度引用的历史版本');
  for (const lesson of backup.lessons)
    for (const ref of lesson.exampleQuestionRefs)
      if (!questions.has(refKey(ref))) throw new Error('备份缺少课程例题版本');
  for (const question of backup.questions)
    if (question.materialRef && !materials.has(refKey(question.materialRef)))
      throw new Error('备份缺少题目材料版本');
  for (const session of backup.sessions)
    for (const ref of session.questionRefs)
      if (!questions.has(refKey(ref))) throw new Error('备份缺少会话题目版本');
  const answersBySession = new Set<string>();
  for (const answer of backup.answers) {
    const session = sessions.get(answer.sessionId);
    if (
      !session ||
      !session.questionRefs.some(
        (ref) => refKey(ref) === refKey(answer.questionRef),
      )
    )
      throw new Error('备份作答不属于会话');
    if (!questions.has(refKey(answer.questionRef)))
      throw new Error('备份缺少作答题目版本');
    const sessionKey = `${answer.sessionId}:${answer.questionRef.id}`;
    if (answersBySession.has(sessionKey))
      throw new Error('备份中同一会话同题重复作答');
    answersBySession.add(sessionKey);
  }
}

export function parseLearningBackup(input: unknown): LearningBackup {
  const backup = BackupSchema.parse(input);
  validateBackup(backup);
  return backup;
}

export class BackupRepository {
  constructor(private readonly db: LearningDatabase) {}

  async exportBackup(): Promise<LearningBackup> {
    return this.db.transaction('r', this.db.tables, async () => {
      const catalog = {
        examProfiles: await this.db.examProfiles.toArray(),
        modules: await this.db.modules.toArray(),
        knowledgePoints: await this.db.knowledgePoints.toArray(),
      };
      const [lessonProgress, sessions, answers, mistakes] = await Promise.all([
        this.db.lessonProgress.toArray(),
        this.db.sessions.toArray(),
        this.db.answers.toArray(),
        this.db.mistakes.toArray(),
      ]);
      const lessonRefs = new Map(
        lessonProgress.map((row) => [
          `${row.lessonId}@${row.lessonVersion}`,
          [row.lessonId, row.lessonVersion] as [string, number],
        ]),
      );
      const lessons = (
        await this.db.lessons.bulkGet([...lessonRefs.values()])
      ).map((row) => {
        if (!row) throw new Error('学习进度引用的课程版本不存在');
        return row;
      });
      const questionRefs = new Map<string, [string, number]>();
      for (const session of sessions)
        for (const ref of session.questionRefs)
          questionRefs.set(refKey(ref), [ref.id, ref.version]);
      for (const answer of answers)
        questionRefs.set(refKey(answer.questionRef), [
          answer.questionRef.id,
          answer.questionRef.version,
        ]);
      for (const lesson of lessons)
        for (const ref of lesson.exampleQuestionRefs)
          questionRefs.set(refKey(ref), [ref.id, ref.version]);
      const questions = (
        await this.db.questions.bulkGet([...questionRefs.values()])
      ).map((row) => {
        if (!row) throw new Error('历史题目版本不存在');
        return row;
      });
      const materialRefs = new Map<string, [string, number]>();
      for (const question of questions)
        if (question.materialRef)
          materialRefs.set(refKey(question.materialRef), [
            question.materialRef.id,
            question.materialRef.version,
          ]);
      const materials = (
        await this.db.materials.bulkGet([...materialRefs.values()])
      ).map((row) => {
        if (!row) throw new Error('历史材料版本不存在');
        return row;
      });
      return parseLearningBackup({
        kind: 'kaogong-learning-backup',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        catalog,
        lessons,
        questions,
        materials,
        lessonProgress,
        sessions,
        answers,
        mistakes,
      });
    });
  }

  private async prepare(backup: LearningBackup) {
    const currentCatalog = {
      examProfiles: await this.db.examProfiles.toArray(),
      modules: await this.db.modules.toArray(),
      knowledgePoints: await this.db.knowledgePoints.toArray(),
    };
    const additions = {
      examProfiles: [] as typeof backup.catalog.examProfiles,
      modules: [] as typeof backup.catalog.modules,
      knowledgePoints: [] as typeof backup.catalog.knowledgePoints,
      lessons: [] as typeof backup.lessons,
      questions: [] as typeof backup.questions,
      materials: [] as typeof backup.materials,
      lessonProgress: [] as typeof backup.lessonProgress,
      sessions: [] as typeof backup.sessions,
      answers: [] as typeof backup.answers,
      mistakes: [] as typeof backup.mistakes,
    };
    const mergeCatalog = <T extends { id: string }>(
      incoming: T[],
      current: T[],
      target: T[],
    ) => {
      const byId = new Map(current.map((row) => [row.id, row]));
      for (const row of incoming) {
        const old = byId.get(row.id);
        if (!old) target.push(row);
      }
    };
    mergeCatalog(
      backup.catalog.examProfiles,
      currentCatalog.examProfiles,
      additions.examProfiles,
    );
    mergeCatalog(
      backup.catalog.modules,
      currentCatalog.modules,
      additions.modules,
    );
    mergeCatalog(
      backup.catalog.knowledgePoints,
      currentCatalog.knowledgePoints,
      additions.knowledgePoints,
    );
    CatalogSchema.parse({
      examProfiles: [...currentCatalog.examProfiles, ...additions.examProfiles],
      modules: [...currentCatalog.modules, ...additions.modules],
      knowledgePoints: [
        ...currentCatalog.knowledgePoints,
        ...additions.knowledgePoints,
      ],
    } satisfies Catalog);
    const mergeContent = async <T extends { id: string; version: number }>(
      incoming: T[],
      get: (id: string, version: number) => Promise<T | undefined>,
      target: T[],
    ) => {
      for (const row of incoming) {
        const old = await get(row.id, row.version);
        if (old && !same(old, row))
          throw new Error(`内容版本冲突：${key(row)}`);
        if (!old) target.push(row);
      }
    };
    await mergeContent(
      backup.materials,
      (id, version) => this.db.materials.get([id, version]),
      additions.materials,
    );
    await mergeContent(
      backup.questions,
      (id, version) => this.db.questions.get([id, version]),
      additions.questions,
    );
    await mergeContent(
      backup.lessons,
      (id, version) => this.db.lessons.get([id, version]),
      additions.lessons,
    );
    const allQuestions = new Map(
      backup.questions.map((row) => [key(row), row]),
    );
    const allLessons = new Map(backup.lessons.map((row) => [key(row), row]));
    const allMaterials = new Set(backup.materials.map(key));
    const allPointIds = new Set(
      [...currentCatalog.knowledgePoints, ...additions.knowledgePoints].map(
        (row) => row.id,
      ),
    );
    for (const question of backup.questions) {
      if (question.knowledgePointIds.some((id) => !allPointIds.has(id)))
        throw new Error('备份题目知识点不存在');
      if (
        question.materialRef &&
        !allMaterials.has(refKey(question.materialRef)) &&
        !(await this.db.materials.get([
          question.materialRef.id,
          question.materialRef.version,
        ]))
      )
        throw new Error('备份题目材料版本不存在');
    }
    for (const lesson of backup.lessons) {
      if (!allPointIds.has(lesson.knowledgePointId))
        throw new Error('备份课程知识点不存在');
      for (const ref of lesson.exampleQuestionRefs)
        if (
          !allQuestions.has(refKey(ref)) &&
          !(await this.db.questions.get([ref.id, ref.version]))
        )
          throw new Error('备份课程例题版本不存在');
    }
    for (const progress of backup.lessonProgress) {
      const id = `${progress.lessonId}@${progress.lessonVersion}`;
      if (
        !allLessons.has(id) &&
        !(await this.db.lessons.get([
          progress.lessonId,
          progress.lessonVersion,
        ]))
      )
        throw new Error('备份课程进度版本不存在');
      const old = await this.db.lessonProgress.get(progress.lessonId);
      if (!old || progress.updatedAt > old.updatedAt)
        additions.lessonProgress.push(progress);
      else if (old.updatedAt === progress.updatedAt && !same(old, progress))
        throw new Error('课程进度时间相同但内容冲突');
    }
    const currentSessions = await this.db.sessions.toArray();
    const sessions = new Map(currentSessions.map((row) => [row.id, row]));
    for (const session of backup.sessions) {
      for (const ref of session.questionRefs)
        if (
          !allQuestions.has(refKey(ref)) &&
          !(await this.db.questions.get([ref.id, ref.version]))
        )
          throw new Error('备份会话题目版本不存在');
      const old = sessions.get(session.id);
      if (!old) additions.sessions.push(session);
      else if (old.status === 'active' && session.status === 'active') {
        if (
          !same(old.questionRefs, session.questionRefs) ||
          old.startedAt !== session.startedAt ||
          old.explanationMode !== session.explanationMode
        )
          throw new Error('进行中会话配置冲突');
      } else if (old.status === 'completed' && session.status === 'active') {
        if (
          !same(old.questionRefs, session.questionRefs) ||
          old.startedAt !== session.startedAt
        )
          throw new Error('会话配置冲突');
      } else if (!same(old, session)) throw new Error('已完成会话冲突');
      sessions.set(session.id, old ?? session);
    }
    const currentAnswers = await this.db.answers.toArray();
    const answers = new Map(currentAnswers.map((row) => [row.id, row]));
    for (const answer of backup.answers) {
      const old = answers.get(answer.id);
      if (old && !same(old, answer)) throw new Error('作答历史冲突');
      if (!old) additions.answers.push(answer);
      answers.set(answer.id, old ?? answer);
    }
    const allAnswers = [...answers.values()];
    const seenSessionQuestions = new Set<string>();
    const attempts = new Map<string, number[]>();
    for (const answer of allAnswers) {
      const session = sessions.get(answer.sessionId);
      if (
        !session ||
        !session.questionRefs.some(
          (ref) => refKey(ref) === refKey(answer.questionRef),
        )
      )
        throw new Error('作答记录不属于会话');
      const question =
        allQuestions.get(refKey(answer.questionRef)) ??
        (await this.db.questions.get([
          answer.questionRef.id,
          answer.questionRef.version,
        ]));
      if (
        Date.parse(answer.answeredAt) < Date.parse(session.startedAt) ||
        (session.completedAt &&
          Date.parse(answer.answeredAt) > Date.parse(session.completedAt))
      )
        throw new Error('作答时间不属于会话');
      if (
        !question ||
        answer.selectedOptionIds.some(
          (id) => !question.options.some((option) => option.id === id),
        ) ||
        (question.type === 'single' && answer.selectedOptionIds.length > 1) ||
        gradeSelection(question, answer.selectedOptionIds) !== answer.outcome
      )
        throw new Error('作答结果与历史题目不一致');
      const pair = `${answer.sessionId}:${answer.questionRef.id}`;
      if (seenSessionQuestions.has(pair))
        throw new Error('同一会话同题重复作答');
      seenSessionQuestions.add(pair);
      const list = attempts.get(answer.questionRef.id) ?? [];
      list.push(answer.attemptNumber);
      attempts.set(answer.questionRef.id, list);
    }
    for (const list of attempts.values()) {
      list.sort((a, b) => a - b);
      if (list.some((number, index) => number !== index + 1))
        throw new Error('作答次数冲突，无法安全合并两条历史');
    }
    for (const session of backup.sessions) {
      if (
        session.status === 'completed' &&
        allAnswers.filter((row) => row.sessionId === session.id).length !==
          session.questionRefs.length
      )
        throw new Error('已完成会话作答不完整');
    }
    for (const mistake of backup.mistakes) {
      if (
        !allAnswers.some(
          (row) =>
            row.questionRef.id === mistake.questionId &&
            row.outcome === 'incorrect',
        )
      )
        throw new Error('错题状态缺少答错历史');
      const old = await this.db.mistakes.get(mistake.questionId);
      if (!old || mistake.updatedAt > old.updatedAt)
        additions.mistakes.push(mistake);
      else if (old.updatedAt === mistake.updatedAt && !same(old, mistake))
        throw new Error('错题状态时间相同但内容冲突');
    }
    const preview: BackupPreview = {
      sessions: additions.sessions.length,
      answers: additions.answers.length,
      lessonProgress: additions.lessonProgress.length,
      mistakes: additions.mistakes.length,
      contentVersions:
        additions.lessons.length +
        additions.questions.length +
        additions.materials.length,
    };
    return { additions, preview };
  }

  async previewImport(input: unknown): Promise<BackupPreview> {
    const backup = parseLearningBackup(input);
    return this.db.transaction(
      'r',
      this.db.tables,
      async () => (await this.prepare(backup)).preview,
    );
  }

  async importBackup(input: unknown): Promise<BackupPreview> {
    const backup = parseLearningBackup(input);
    return this.db.transaction('rw', this.db.tables, async () => {
      const { additions, preview } = await this.prepare(backup);
      await this.db.examProfiles.bulkAdd(additions.examProfiles);
      await this.db.modules.bulkAdd(additions.modules);
      await this.db.knowledgePoints.bulkAdd(additions.knowledgePoints);
      await this.db.materials.bulkAdd(additions.materials);
      await this.db.questions.bulkAdd(additions.questions);
      await this.db.lessons.bulkAdd(additions.lessons);
      await this.db.sessions.bulkAdd(additions.sessions);
      await this.db.answers.bulkAdd(additions.answers);
      await this.db.lessonProgress.bulkPut(additions.lessonProgress);
      await this.db.mistakes.bulkPut(additions.mistakes);
      return preview;
    });
  }
}

export function backupImageUrls(backup: LearningBackup): string[] {
  const urls = new Set<string>();
  for (const body of [
    ...backup.lessons.map((row) => row.bodyMarkdown),
    ...backup.questions.flatMap((row) => [
      row.stemMarkdown,
      row.explanationMarkdown,
      ...row.options.map((option) => option.bodyMarkdown),
    ]),
    ...backup.materials.map((row) => row.bodyMarkdown),
  ]) {
    for (const match of body.matchAll(/!\[[^\]]*\]\((\/content\/[^)]+)\)/g)) {
      if (match[1]) urls.add(match[1]);
    }
  }
  return [...urls];
}

export async function checkBackupImages(backup: LearningBackup): Promise<void> {
  const urls = backupImageUrls(backup);
  for (let index = 0; index < urls.length; index += 8) {
    await Promise.all(
      urls.slice(index, index + 8).map(async (url) => {
        const response = await fetch(
          `${import.meta.env.BASE_URL}${url.slice(1)}`,
          { method: 'HEAD' },
        );
        if (
          !response.ok ||
          !response.headers.get('content-type')?.startsWith('image/')
        )
          throw new Error(`历史图片不可用：${url}`);
      }),
    );
  }
}
