import { LearningDatabase } from './database';
import { CatalogRepository } from './catalog-repository';
import { ContentRepository } from './content-repository';
import { PracticeRepository } from './practice-repository';
import { AnalyticsRepository } from './analytics-repository';
import { initializeDatabase } from './initialize';
import {
  hasPrivateBank,
  importPrivateBank,
  isPrivateBankCurrent,
  importModuleBankChunk,
  isModuleBankCurrent,
  markModuleBankCurrent,
} from './import-content';
import {
  BankManifestSchema,
  ModuleBankManifestSchema,
} from '../domain/content-package';

const database = new LearningDatabase();
export const catalogRepository = new CatalogRepository(database);
export const contentRepository = new ContentRepository(database);
export const practiceRepository = new PracticeRepository(database);
export const analyticsRepository = new AnalyticsRepository(database);
export async function initializeLocalData() {
  await initializeDatabase(database);
  const root = `${import.meta.env.BASE_URL}content/bank/`;
  let manifest: ReturnType<typeof BankManifestSchema.parse>;
  try {
    const response = await fetch(`${root}manifest.json`);
    if (!response.ok) throw new Error('私人题库清单无法读取');
    manifest = BankManifestSchema.parse(await response.json());
  } catch (error) {
    if (await hasPrivateBank(database)) return;
    throw error;
  }
  if (await isPrivateBankCurrent(database, manifest.sourceCommit)) return;
  const chunks = await Promise.all(
    manifest.chunks.map(async ({ file }) => {
      const chunk = await fetch(`${root}${file}`);
      if (!chunk.ok) throw new Error(`私人题库分包无法读取: ${file}`);
      return chunk.json() as Promise<unknown>;
    }),
  );
  await importPrivateBank(database, manifest, chunks);
}

const moduleImports = new Map<string, Promise<void>>();
export function ensureModuleBank(moduleId: string): Promise<void> {
  const pending = moduleImports.get(moduleId);
  if (pending) return pending;
  const task = (async () => {
    const root = `${import.meta.env.BASE_URL}content/all-bank/${moduleId}/`;
    const response = await fetch(`${root}manifest.json`);
    if (!response.ok) throw new Error('模块题库清单无法读取');
    const manifest = ModuleBankManifestSchema.parse(await response.json());
    if (manifest.moduleId !== moduleId) throw new Error('模块题库清单不匹配');
    if (await isModuleBankCurrent(database, moduleId, manifest.sourceCommit))
      return;
    for (const [index, chunk] of manifest.chunks.entries()) {
      const result = await fetch(`${root}${chunk.file}`);
      if (!result.ok) throw new Error(`模块题库分包无法读取: ${chunk.file}`);
      await importModuleBankChunk(
        database,
        manifest,
        index,
        await result.json(),
      );
    }
    await markModuleBankCurrent(database, manifest);
  })();
  moduleImports.set(moduleId, task);
  void task.catch(() => moduleImports.delete(moduleId));
  return task;
}
