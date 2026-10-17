import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { BackupRepository, parseLearningBackup } from './backup-repository';
import { LearningDatabase } from './database';
import { initializeDatabase } from './initialize';
import { ContentRepository } from './content-repository';
import { PracticeRepository } from './practice-repository';
import { question, session } from './test-fixtures';
import growthRateContent from '../content/growth-rate.json';

let source: LearningDatabase;
let target: LearningDatabase;
beforeEach(async () => {
  source = new LearningDatabase(`backup-source-${crypto.randomUUID()}`);
  target = new LearningDatabase(`backup-target-${crypto.randomUUID()}`);
  await initializeDatabase(source);
  await initializeDatabase(target);
  await new ContentRepository(source).addQuestionVersion(question);
});
afterEach(async () => {
  await source.delete();
  await target.delete();
});

it('导出后恢复历史内容与作答；重复恢复不重复记账', async () => {
  const practice = new PracticeRepository(source);
  await practice.createSession(session);
  await practice.saveSession({
    ...session,
    drafts: [
      {
        questionRef: session.questionRefs[0],
        selectedOptionIds: ['B'],
        uncertain: false,
        elapsedMs: 1200,
      },
    ],
  });
  await practice.submitSession('s1', '2026-10-14T10:01:00.000Z');
  await source.lessonProgress.put({
    lessonId: growthRateContent.lessons[0]!.id,
    lessonVersion: 1,
    status: 'completed',
    updatedAt: '2026-10-14T10:02:00.000Z',
  });
  const backup = await new BackupRepository(source).exportBackup();
  expect(backup.questions.some((row) => row.id === 'q1')).toBe(true);
  const repository = new BackupRepository(target);
  expect((await repository.previewImport(backup)).answers).toBe(1);
  await repository.importBackup(backup);
  expect(await target.questions.get(['q1', 1])).toEqual(question);
  expect(await target.answers.count()).toBe(1);
  expect((await target.mistakes.get('q1'))?.status).toBe('pending');
  expect((await repository.importBackup(backup)).answers).toBe(0);
  expect(await target.answers.count()).toBe(1);
});

it('本机草稿优先，较新进度生效', async () => {
  await new PracticeRepository(source).createSession(session);
  const backup = await new BackupRepository(source).exportBackup();
  await new ContentRepository(target).addQuestionVersion(question);
  await new PracticeRepository(target).createSession({
    ...session,
    currentIndex: 0,
    drafts: [
      {
        questionRef: session.questionRefs[0],
        selectedOptionIds: ['A'],
        uncertain: true,
        elapsedMs: 2000,
      },
    ],
  });
  await target.lessonProgress.put({
    lessonId: growthRateContent.lessons[0]!.id,
    lessonVersion: 1,
    status: 'basic-mastery',
    updatedAt: '2026-10-15T10:00:00.000Z',
  });
  await new BackupRepository(target).importBackup(backup);
  expect(
    (await target.sessions.get('s1'))?.drafts[0]?.selectedOptionIds,
  ).toEqual(['A']);
  expect(
    (await target.lessonProgress.get(growthRateContent.lessons[0]!.id))?.status,
  ).toBe('basic-mastery');
});

it('应用更新了同 ID 目录文案后仍能恢复旧备份', async () => {
  await new PracticeRepository(source).createSession(session);
  const backup = await new BackupRepository(source).exportBackup();
  await target.modules.update('politics', { description: '新版目录说明' });
  await new BackupRepository(target).importBackup(backup);
  expect((await target.modules.get('politics'))?.description).toBe(
    '新版目录说明',
  );
  expect(await target.sessions.count()).toBe(1);
});

it('内容冲突和写入失败均整次回滚', async () => {
  await new PracticeRepository(source).createSession(session);
  const backup = await new BackupRepository(source).exportBackup();
  await target.questions.add({ ...question, stemMarkdown: '冲突版本' });
  await expect(
    new BackupRepository(target).importBackup(backup),
  ).rejects.toThrow('内容版本冲突');
  expect(await target.sessions.count()).toBe(0);
  await target.questions.delete(['q1', 1]);
  const hook = () => {
    throw new Error('模拟写入中断');
  };
  target.sessions.hook('creating', hook);
  await expect(
    new BackupRepository(target).importBackup(backup),
  ).rejects.toThrow('模拟写入中断');
  expect(await target.questions.get(['q1', 1])).toBeUndefined();
  expect(await target.sessions.count()).toBe(0);
  target.sessions.hook('creating').unsubscribe(hook);
  await new BackupRepository(target).importBackup(backup);
  expect(await target.sessions.count()).toBe(1);
});

it('格式版本和重复记录校验失败时不触碰数据库', async () => {
  const backup = await new BackupRepository(source).exportBackup();
  expect(() => parseLearningBackup({ ...backup, formatVersion: 2 })).toThrow();
  await expect(
    new BackupRepository(target).importBackup({
      ...backup,
      sessions: [session, session],
    }),
  ).rejects.toThrow('重复');
  expect(await target.sessions.count()).toBe(0);
});

it('旧逐题作答会话可恢复；分叉的作答次数会阻止合并', async () => {
  const practice = new PracticeRepository(source);
  await practice.createSession(session);
  await practice.appendAnswer({
    id: 'legacy-answer',
    sessionId: 's1',
    questionRef: session.questionRefs[0]!,
    selectedOptionIds: ['A'],
    outcome: 'correct',
    elapsedMs: 500,
    answeredAt: '2026-10-14T10:01:00.000Z',
  });
  const backup = await new BackupRepository(source).exportBackup();
  await new BackupRepository(target).importBackup(backup);
  expect(await target.answers.count()).toBe(1);
  await target.sessions.add({ ...session, id: 'other-session' });
  await target.answers.add({
    ...backup.answers[0]!,
    id: 'other-answer',
    sessionId: 'other-session',
  });
  await expect(
    new BackupRepository(target).importBackup(backup),
  ).rejects.toThrow('作答次数冲突');
  expect(await target.answers.count()).toBe(2);
});
