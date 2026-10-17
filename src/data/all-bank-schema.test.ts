import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import {
  ContentBatchSchema,
  ModuleBankManifestSchema,
} from '../domain/content-package';

it('六模块发布包全部满足运行时 Schema', async () => {
  const modules = [
    'politics',
    'general',
    'verbal',
    'quantitative',
    'reasoning',
    'data-analysis',
  ];
  let total = 0;
  for (const moduleId of modules) {
    const root = new URL(
      `../../public/content/all-bank/${moduleId}/`,
      import.meta.url,
    );
    const manifest = ModuleBankManifestSchema.parse(
      JSON.parse(await readFile(new URL('manifest.json', root), 'utf8')),
    );
    expect(manifest.moduleId).toBe(moduleId);
    for (const chunk of manifest.chunks) {
      const batch = ContentBatchSchema.parse(
        JSON.parse(await readFile(new URL(chunk.file, root), 'utf8')),
      );
      expect(batch.questions).toHaveLength(chunk.count);
      total += batch.questions.length;
    }
  }
  expect(total).toBe(25978);
}, 30000);
