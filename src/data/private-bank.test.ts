import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { LearningDatabase } from './database';
import { initializeDatabase } from './initialize';
import { importPrivateBank } from './import-content';
import { ContentRepository } from './content-repository';
import { PracticeRepository } from './practice-repository';
import allCourses from '../content/all-courses.json';

const root = new URL('../../public/content/bank/', import.meta.url);
async function loadPackage() {
  const manifest = JSON.parse(
    await readFile(new URL('manifest.json', root), 'utf8'),
  );
  const chunks = await Promise.all(
    manifest.chunks.map(async ({ file }: { file: string }) =>
      JSON.parse(await readFile(new URL(file, root), 'utf8')),
    ),
  );
  return { manifest, chunks };
}

let db: LearningDatabase;
beforeEach(async () => {
  db = new LearningDatabase(`bank-test-${crypto.randomUUID()}`);
  await initializeDatabase(db);
});
afterEach(async () => db.delete());

it('导入完整私人题组并重复初始化不改写内容', async () => {
  const { manifest, chunks } = await loadPackage();
  await importPrivateBank(db, manifest, chunks);
  await importPrivateBank(db, manifest, chunks);
  expect(await db.questions.count()).toBe(1006 + allCourses.questions.length);
  expect(await db.materials.count()).toBe(204 + allCourses.materials.length);
  const content = new ContentRepository(db);
  const eligible = await content.getTrainingQuestions(
    'data-analysis-comprehensive',
  );
  const originalIds = new Set(
    chunks.flatMap((chunk) =>
      chunk.questions.map((item: { id: string }) => item.id),
    ),
  );
  expect(eligible.filter((item) => originalIds.has(item.id))).toHaveLength(
    1001,
  );
  expect(eligible[0]?.reviewStatus).toBe('source-provided');
  expect(eligible[0]?.source.license.status).toBe('unknown');
  const question = eligible.find((item) => item.materialRef);
  expect(await content.getMaterial(question!.materialRef!)).toBeDefined();
  const practice = new PracticeRepository(db);
  await practice.createSession({
    id: 'bank-session',
    questionRefs: [{ id: question!.id, version: 1 }],
    status: 'active',
    explanationMode: 'after-submit',
    currentIndex: 0,
    drafts: [],
    startedAt: '2026-10-16T10:00:00.000Z',
    completedAt: null,
  });
  expect(await practice.getSession('bank-session')).toBeDefined();
});

it('冲突版本导致整包回滚，保留已有学习记录', async () => {
  const { manifest, chunks } = await loadPackage();
  await importPrivateBank(db, manifest, chunks);
  const first = chunks[0].questions[0];
  await db.questions.delete([first.id, first.version]);
  await db.lessonProgress.add({
    lessonId: 'lesson-data-analysis-growth-rate',
    lessonVersion: 1,
    status: 'learning',
    updatedAt: '2026-10-16T10:00:00.000Z',
  });
  const altered = structuredClone(chunks);
  altered[1].questions[0].stemMarkdown = '同版本冲突';
  await expect(importPrivateBank(db, manifest, altered)).rejects.toThrow(
    '不可覆盖',
  );
  expect(await db.questions.get([first.id, first.version])).toBeUndefined();
  expect(await db.lessonProgress.count()).toBe(1);
});
