import {
  ContentBatchSchema,
  BankManifestSchema,
  ModuleBankManifestSchema,
} from '../domain/content-package';
import { refKey } from '../domain/common';
import type { LearningDatabase } from './database';

type ContentBatch = ReturnType<typeof ContentBatchSchema.parse>;

function same(existing: unknown, incoming: unknown) {
  if (existing && JSON.stringify(existing) !== JSON.stringify(incoming))
    throw new Error('已有内容版本不可覆盖，请增加版本号');
}

export async function writeContentBatch(
  db: LearningDatabase,
  batch: ContentBatch,
) {
  const pointIds = new Set(
    await db.knowledgePoints.toCollection().primaryKeys(),
  );
  for (const material of batch.materials) {
    const key: [string, number] = [material.id, material.version];
    const existing = await db.materials.get(key);
    same(existing, material);
    if (!existing) await db.materials.add(material);
  }
  for (const question of batch.questions) {
    if (question.knowledgePointIds.some((id) => !pointIds.has(id)))
      throw new Error('内置题目关联知识点不存在');
    if (
      question.materialRef &&
      !(await db.materials.get([
        question.materialRef.id,
        question.materialRef.version,
      ]))
    )
      throw new Error('内置题目关联材料不存在');
    const key: [string, number] = [question.id, question.version];
    const existing = await db.questions.get(key);
    same(existing, question);
    if (!existing) await db.questions.add(question);
  }
  for (const lesson of batch.lessons) {
    if (!pointIds.has(lesson.knowledgePointId))
      throw new Error('内置课程关联知识点不存在');
    for (const ref of lesson.exampleQuestionRefs)
      if (!(await db.questions.get([ref.id, ref.version])))
        throw new Error('内置课程例题版本不存在');
    const key: [string, number] = [lesson.id, lesson.version];
    const existing = await db.lessons.get(key);
    same(existing, lesson);
    if (!existing) await db.lessons.add(lesson);
  }
}

export async function importPrivateBank(
  db: LearningDatabase,
  manifestInput: unknown,
  chunkInputs: unknown[],
) {
  const manifest = BankManifestSchema.parse(manifestInput);
  if (chunkInputs.length !== manifest.chunks.length)
    throw new Error('题库分包数量不一致');
  const chunks = chunkInputs.map((input) => ContentBatchSchema.parse(input));
  const questions = chunks.flatMap((chunk) => chunk.questions);
  const materials = chunks.flatMap((chunk) => chunk.materials);
  if (
    questions.length !== manifest.questionCount ||
    materials.length !== manifest.materialCount ||
    chunks.some(
      (chunk, index) =>
        chunk.questions.length !== manifest.chunks[index]?.count,
    ) ||
    new Set(questions.map((item) => refKey(item))).size !== questions.length ||
    new Set(materials.map((item) => refKey(item))).size !== materials.length ||
    questions.some(
      (item) =>
        item.reviewStatus !== 'source-provided' ||
        item.source.license.status !== 'unknown',
    ) ||
    materials.some(
      (item) =>
        item.reviewStatus !== 'source-provided' ||
        item.source.license.status !== 'unknown',
    )
  )
    throw new Error('私人题库清单与内容不一致');
  await db.transaction(
    'rw',
    [db.questions, db.materials, db.lessons, db.knowledgePoints, db.metadata],
    async () => {
      for (const chunk of chunks) await writeContentBatch(db, chunk);
      await db.metadata.put({
        key: 'private-bank-commit',
        value: manifest.sourceCommit,
      });
    },
  );
}

export async function isPrivateBankCurrent(
  db: LearningDatabase,
  commit: string,
) {
  return (await db.metadata.get('private-bank-commit'))?.value === commit;
}

export async function hasPrivateBank(db: LearningDatabase) {
  return Boolean((await db.metadata.get('private-bank-commit'))?.value);
}

export async function isModuleBankCurrent(
  db: LearningDatabase,
  moduleId: string,
  commit: string,
) {
  return (await db.metadata.get(`module-bank-${moduleId}`))?.value === commit;
}

export async function importModuleBankChunk(
  db: LearningDatabase,
  manifestInput: unknown,
  chunkIndex: number,
  chunkInput: unknown,
) {
  const manifest = ModuleBankManifestSchema.parse(manifestInput);
  const expected = manifest.chunks[chunkIndex];
  if (!expected) throw new Error('题库分包序号无效');
  const batch = ContentBatchSchema.parse(chunkInput);
  if (
    batch.lessons.length ||
    batch.questions.length !== expected.count ||
    batch.questions.some(
      (item) =>
        item.reviewStatus !== 'source-provided' ||
        item.source.kind !== 'third-party' ||
        item.source.license.status !== 'unknown',
    ) ||
    batch.materials.some(
      (item) =>
        item.reviewStatus !== 'source-provided' ||
        item.source.kind !== 'third-party' ||
        item.source.license.status !== 'unknown',
    )
  )
    throw new Error('题库分包内容与清单不一致');
  const pointIds = new Set(
    (
      await db.knowledgePoints
        .where('moduleId')
        .equals(manifest.moduleId)
        .toArray()
    ).map((item) => item.id),
  );
  if (
    batch.questions.some((item) =>
      item.knowledgePointIds.some((id) => !pointIds.has(id)),
    )
  )
    throw new Error('题目关联模块不一致');
  await db.transaction(
    'rw',
    [db.questions, db.materials, db.lessons, db.knowledgePoints],
    () => writeContentBatch(db, batch),
  );
}

export async function markModuleBankCurrent(
  db: LearningDatabase,
  manifestInput: unknown,
) {
  const manifest = ModuleBankManifestSchema.parse(manifestInput);
  await db.metadata.put({
    key: `module-bank-${manifest.moduleId}`,
    value: manifest.sourceCommit,
  });
}
