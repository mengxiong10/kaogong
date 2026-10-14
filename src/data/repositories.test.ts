import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LearningDatabase } from './database';
import { initializeDatabase } from './initialize';
import { CatalogRepository } from './catalog-repository';
import { ContentRepository } from './content-repository';
import { PracticeRepository } from './practice-repository';
import { seedCatalog } from './seed';
import { question, session, answerInput } from './test-fixtures';

let db: LearningDatabase;
let content: ContentRepository;
let practice: PracticeRepository;
let catalog: CatalogRepository;
beforeEach(async () => {
  db = new LearningDatabase(`test-${crypto.randomUUID()}`);
  content = new ContentRepository(db);
  practice = new PracticeRepository(db);
  catalog = new CatalogRepository(db);
  await initializeDatabase(db);
});
afterEach(async () => {
  await db.delete();
});

async function addTrainingSession() {
  await content.addQuestionVersion(question);
  await practice.createSession(session);
}

describe('本地目录与事务初始化', () => {
  it('首次写入并重复初始化保持唯一', async () => {
    await initializeDatabase(db);
    expect((await catalog.getCatalog()).modules).toHaveLength(6);
    expect(await db.knowledgePoints.count()).toBe(53);
    expect(await db.metadata.count()).toBe(1);
  });
  it('并发初始化不产生重复种子', async () => {
    await Promise.all([initializeDatabase(db), initializeDatabase(db)]);
    expect(await db.modules.count()).toBe(6);
    expect(await db.knowledgePoints.count()).toBe(53);
  });
  it('初始化保留已有目录、会话与历史', async () => {
    await addTrainingSession();
    await practice.appendAnswer(answerInput);
    await db.modules.update('politics', { description: '保留的目录说明' });
    await initializeDatabase(db);
    expect((await db.modules.get('politics'))?.description).toBe(
      '保留的目录说明',
    );
    expect(await practice.getAnswers()).toHaveLength(1);
    expect(await practice.getSession('s1')).toEqual(session);
  });
  it('无效输入写入前被拒绝，不影响记录', async () => {
    await addTrainingSession();
    await practice.appendAnswer(answerInput);
    await expect(
      initializeDatabase(db, {
        ...seedCatalog,
        modules: [...seedCatalog.modules, seedCatalog.modules[0]],
      }),
    ).rejects.toThrow();
    expect(await db.modules.count()).toBe(6);
    expect(await db.answers.count()).toBe(1);
  });
  it('事务中途失败回滚，重试不丢数据', async () => {
    await addTrainingSession();
    await practice.appendAnswer(answerInput);
    // 模拟上次初始化尚未补齐目录，随后遇到写入故障。
    await db.knowledgePoints.delete('data-analysis-growth-amount');
    await db.modules.delete('politics');
    const hook = () => {
      throw new Error('模拟磁盘写入故障');
    };
    db.knowledgePoints.hook('creating', hook);
    await expect(initializeDatabase(db)).rejects.toThrow('模拟磁盘写入故障');
    expect(await db.modules.get('politics')).toBeUndefined();
    expect(await db.answers.count()).toBe(1);
    db.knowledgePoints.hook('creating').unsubscribe(hook);
    await initializeDatabase(db);
    expect(await db.modules.count()).toBe(6);
    expect(await db.knowledgePoints.count()).toBe(53);
    expect(await db.answers.count()).toBe(1);
  });
  it('已损坏目录会报告错误，保留现场而不是重置', async () => {
    await db.knowledgePoints.update('data-analysis-growth-rate', {
      parentId: 'missing',
    });
    await expect(initializeDatabase(db)).rejects.toThrow();
    expect(
      (await db.knowledgePoints.get('data-analysis-growth-rate'))?.parentId,
    ).toBe('missing');
  });
});

describe('不可变内容版本与关联', () => {
  it('相同版本可幂等保存，但不能覆盖答案', async () => {
    await content.addQuestionVersion(question);
    await content.addQuestionVersion(question);
    await expect(
      content.addQuestionVersion({ ...question, correctOptionIds: ['B'] }),
    ).rejects.toThrow('不可覆盖');
    expect(
      (await content.getQuestion({ id: 'q1', version: 1 }))?.correctOptionIds,
    ).toEqual(['A']);
  });
  it('新版本不改变旧会话与历史答案', async () => {
    await addTrainingSession();
    await practice.appendAnswer(answerInput);
    await content.addQuestionVersion({
      ...question,
      version: 2,
      correctOptionIds: ['B'],
    });
    expect((await practice.getSession('s1'))?.questionRefs).toEqual([
      { id: 'q1', version: 1 },
    ]);
    expect((await practice.getAnswers())[0]?.questionRef.version).toBe(1);
    expect(
      (await content.getQuestion({ id: 'q1', version: 1 }))?.correctOptionIds,
    ).toEqual(['A']);
  });
  it('未知知识点与材料不能写入', async () => {
    await expect(
      content.addQuestionVersion({
        ...question,
        knowledgePointIds: ['missing'],
      }),
    ).rejects.toThrow('知识点不存在');
    await expect(
      content.addQuestionVersion({
        ...question,
        materialRef: { id: 'm1', version: 1 },
      }),
    ).rejects.toThrow('材料版本不存在');
    expect(await db.questions.count()).toBe(0);
  });
  it('共享材料和课程版本保留，支持学习进度', async () => {
    const material = {
      id: 'm1',
      version: 1,
      title: '材料',
      bodyMarkdown: '共享材料',
      source: question.source,
      reviewStatus: 'verified',
    };
    await content.addMaterialVersion(material);
    await content.addQuestionVersion({
      ...question,
      materialRef: { id: 'm1', version: 1 },
    });
    await content.addQuestionVersion({
      ...question,
      id: 'q2',
      materialRef: { id: 'm1', version: 1 },
    });
    expect(await db.materials.count()).toBe(1);
    await expect(
      content.addMaterialVersion({ ...material, bodyMarkdown: '覆盖' }),
    ).rejects.toThrow('不可覆盖');
    const lesson = {
      id: 'l1',
      version: 1,
      title: '课程',
      knowledgePointId: 'data-analysis-growth-rate',
      bodyMarkdown: '# 测试',
      exampleQuestionRefs: [{ id: 'q1', version: 1 }],
      source: question.source,
      reviewStatus: 'verified',
    };
    await content.addLessonVersion(lesson);
    await catalog.saveLessonProgress({
      lessonId: 'l1',
      lessonVersion: 1,
      status: 'learning',
      updatedAt: answerInput.answeredAt,
    });
    await content.addLessonVersion({
      ...lesson,
      version: 2,
      bodyMarkdown: '# 新版',
    });
    expect((await catalog.getLessonProgress())[0]?.lessonVersion).toBe(1);
    await expect(
      content.addLessonVersion({ ...lesson, title: '覆盖' }),
    ).rejects.toThrow('不可覆盖');
  });
  it('课程、进度和错题拒绝失效关联', async () => {
    await expect(
      content.addLessonVersion({
        id: 'l1',
        version: 1,
        title: '课程',
        knowledgePointId: 'missing',
        bodyMarkdown: '内容',
        exampleQuestionRefs: [],
        source: question.source,
        reviewStatus: 'draft',
      }),
    ).rejects.toThrow('知识点不存在');
    await expect(
      catalog.saveLessonProgress({
        lessonId: 'missing',
        lessonVersion: 1,
        status: 'learning',
        updatedAt: answerInput.answeredAt,
      }),
    ).rejects.toThrow('课程版本不存在');
    await expect(
      catalog.saveMistakeState({
        questionId: 'missing',
        status: 'pending',
        reason: null,
        updatedAt: answerInput.answeredAt,
      }),
    ).rejects.toThrow('题目不存在');
  });
});

describe('会话恢复与追加历史', () => {
  it.each([
    { reviewStatus: 'draft' },
    {
      source: {
        ...question.source,
        license: { status: 'unknown', description: '待核对' },
      },
    },
  ])('未通过审核或许可的内容不能创建训练', async (change) => {
    await content.addQuestionVersion({ ...question, ...change });
    await expect(practice.createSession(session)).rejects.toThrow(
      '尚未校验或未获使用许可',
    );
    expect(await db.sessions.count()).toBe(0);
  });
  it('未审核共享材料不能进入训练', async () => {
    await content.addMaterialVersion({
      id: 'm1',
      version: 1,
      title: '材料',
      bodyMarkdown: '内容',
      source: question.source,
      reviewStatus: 'draft',
    });
    await content.addQuestionVersion({
      ...question,
      materialRef: { id: 'm1', version: 1 },
    });
    await expect(practice.createSession(session)).rejects.toThrow(
      '材料尚未校验',
    );
  });
  it('关闭重开数据库恢复草稿和标记', async () => {
    await addTrainingSession();
    const saved = {
      ...session,
      drafts: [
        {
          questionRef: { id: 'q1', version: 1 },
          selectedOptionIds: ['B'],
          uncertain: true,
          elapsedMs: 3000,
        },
      ],
    };
    await practice.saveSession(saved);
    db.close();
    await db.open();
    expect(await practice.getSession('s1')).toEqual(saved);
  });
  it('会话题目版本与顺序冻结，完成后不可重开', async () => {
    await addTrainingSession();
    await expect(
      practice.saveSession({
        ...session,
        questionRefs: [{ id: 'q1', version: 2 }],
      }),
    ).rejects.toThrow('不可修改');
    await practice.saveSession({
      ...session,
      status: 'completed',
      completedAt: answerInput.answeredAt,
    });
    await expect(practice.saveSession(session)).rejects.toThrow(
      '已完成会话不可修改',
    );
  });
  it('拒绝错误选项和伪造正确结果', async () => {
    await addTrainingSession();
    await expect(
      practice.appendAnswer({ ...answerInput, selectedOptionIds: ['Z'] }),
    ).rejects.toThrow('选项无效');
    await expect(
      practice.appendAnswer({ ...answerInput, selectedOptionIds: ['B'] }),
    ).rejects.toThrow('结果与题目答案不一致');
    await expect(
      practice.appendAnswer({
        ...answerInput,
        questionRef: { id: 'q1', version: 2 },
      }),
    ).rejects.toThrow('不属于会话');
    expect(await db.answers.count()).toBe(0);
  });
  it('重复提交拒绝，不重复记账；跨会话重做保留历史', async () => {
    await addTrainingSession();
    const first = await practice.appendAnswer(answerInput);
    await expect(
      practice.appendAnswer({ ...answerInput, id: 'a2' }),
    ).rejects.toThrow('已保存');
    await practice.createSession({ ...session, id: 's2' });
    const repeat = await practice.appendAnswer({
      ...answerInput,
      id: 'a2',
      sessionId: 's2',
      selectedOptionIds: ['B'],
      outcome: 'incorrect',
    });
    expect(first.attemptNumber).toBe(1);
    expect(repeat.attemptNumber).toBe(2);
    expect(await practice.getAnswers()).toHaveLength(2);
    expect((await practice.getAnswers('s1'))[0]?.outcome).toBe('correct');
  });
  it('并发追加同题只保存一次', async () => {
    await addTrainingSession();
    const results = await Promise.allSettled([
      practice.appendAnswer(answerInput),
      practice.appendAnswer({ ...answerInput, id: 'a2' }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(await db.answers.count()).toBe(1);
  });
  it('未作答保存单独状态，拒绝会话外时间', async () => {
    await addTrainingSession();
    await expect(
      practice.appendAnswer({
        ...answerInput,
        answeredAt: '2026-10-13T10:00:00.000Z',
      }),
    ).rejects.toThrow('时间不属于会话');
    await practice.appendAnswer({
      ...answerInput,
      selectedOptionIds: [],
      outcome: 'unanswered',
      elapsedMs: 0,
    });
    expect((await practice.getAnswers())[0]?.outcome).toBe('unanswered');
  });
});
