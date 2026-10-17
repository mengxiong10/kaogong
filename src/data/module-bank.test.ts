import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { LearningDatabase } from './database';
import { initializeDatabase } from './initialize';
import { importModuleBankChunk } from './import-content';

let db: LearningDatabase;
beforeEach(async () => {
  db = new LearningDatabase(`module-bank-test-${crypto.randomUUID()}`);
  await initializeDatabase(db);
});
afterEach(async () => db.delete());

it('模块分包重复导入幂等，冲突回滚且保留学习记录', async () => {
  const root = new URL(
    '../../public/content/all-bank/politics/',
    import.meta.url,
  );
  const manifest = JSON.parse(
    await readFile(new URL('manifest.json', root), 'utf8'),
  );
  const chunk = JSON.parse(
    await readFile(new URL(manifest.chunks[0].file, root), 'utf8'),
  );
  await importModuleBankChunk(db, manifest, 0, chunk);
  const count = await db.questions.count();
  await importModuleBankChunk(db, manifest, 0, chunk);
  expect(await db.questions.count()).toBe(count);

  const first = chunk.questions[0];
  await db.questions.delete([first.id, first.version]);
  await db.lessonProgress.add({
    lessonId: 'lesson-politics-basic-theory',
    lessonVersion: 1,
    status: 'learning',
    updatedAt: '2026-10-17T10:00:00.000Z',
  });
  const altered = structuredClone(chunk);
  altered.questions[1].stemMarkdown = '同版本冲突';
  await expect(importModuleBankChunk(db, manifest, 0, altered)).rejects.toThrow(
    '不可覆盖',
  );
  expect(await db.questions.get([first.id, first.version])).toBeUndefined();
  expect(await db.lessonProgress.count()).toBe(1);
  await importModuleBankChunk(db, manifest, 0, chunk);
  expect(await db.questions.get([first.id, first.version])).toBeDefined();
});
