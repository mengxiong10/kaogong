import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('学习记录下载后可在新浏览器空间恢复', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/practice');
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  const correct = await optionIndex(page, true);
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .nth(correct)
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('link', { name: '首页', exact: true }).click();
  await page.getByRole('link', { name: '备份与恢复学习记录' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载学习记录' }).click();
  const download = await downloadPromise;
  const bytes = await readFile(await download.path());
  const backup = JSON.parse(bytes.toString()) as {
    answers: unknown[];
    sessions: unknown[];
  };
  expect(backup.answers).toHaveLength(5);
  expect(backup.sessions).toHaveLength(1);

  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4187',
    viewport: page.viewportSize() ?? { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const restored = await context.newPage();
    await restored.goto('/backup');
    await restored.locator('#backup-file').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/json',
      buffer: bytes,
    });
    await expect(restored.getByText('新增作答：5')).toBeVisible();
    expect(
      await restored.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await restored.screenshot({
      path: testInfo.outputPath('backup-preview.png'),
      fullPage: true,
    });
    await restored.getByRole('button', { name: '确认恢复' }).click();
    await expect(
      restored.getByRole('heading', { name: '备份与恢复' }),
    ).toBeVisible();
    await restored.getByRole('link', { name: '返回首页' }).click();
    await restored.getByRole('link', { name: '详细报告' }).click();
    await expect(
      restored.getByRole('heading', { name: '最近 1 套练习' }),
    ).toBeVisible();
    expect(
      await restored.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test('首页学习概况和详细报告使用真实作答记录', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '学习概况' })).toBeVisible();
  await expect(page.getByText('近期首次正确率')).toBeVisible();
  await page.getByRole('link', { name: '详细报告' }).click();
  await expect(page.getByRole('heading', { name: '学习报告' })).toBeVisible();
  await expect(
    page.getByText('暂无已完成练习。', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: '返回首页' }).click();
  await page.getByRole('link', { name: '专项练习' }).click();
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  const correct = await optionIndex(page, true);
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .nth(correct)
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('link', { name: '首页', exact: true }).click();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '详细报告' }).click();
  await expect(
    page.getByRole('heading', { name: '最近 1 套练习' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /资料分析 ·/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('analytics.png'),
    fullPage: true,
  });
});

test('首页推荐未完成课程并独立保留继续作答', async ({ page }) => {
  await page.goto('/');
  const suggestion = page.getByRole('region', { name: '今日学习建议' });
  const first = suggestion.getByRole('heading', { level: 2 });
  const firstTitle = await first.textContent();
  await suggestion.getByRole('link', { name: '学习这节课程' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(firstTitle!);
  await page.getByRole('link', { name: '首页', exact: true }).click();
  await expect(first).toHaveText(firstTitle!);
  await suggestion.getByRole('link', { name: '学习这节课程' }).click();
  await page.getByRole('button', { name: '标记课程已学完' }).click();
  await expect(page.getByRole('button', { name: '已完成课程' })).toBeVisible();
  await page.getByRole('link', { name: '首页', exact: true }).click();
  await expect(first).not.toHaveText(firstTitle!);

  await page.getByRole('link', { name: '专项练习' }).click();
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: '首页', exact: true }).click();
  await expect(
    suggestion.getByRole('link', { name: /继续作答 · 第 1\/5 题/ }),
  ).toBeVisible();
  await expect(
    suggestion.getByRole('link', { name: '学习这节课程' }),
  ).toBeVisible();
});

async function optionIndex(
  page: import('@playwright/test').Page,
  correct = false,
) {
  return page.evaluate(async (wantedCorrect) => {
    const request = indexedDB.open('kaogong-learning');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const sessionId = location.pathname.split('/').at(-1)!;
    const session = await new Promise<{
      questionRefs: { id: string; version: number }[];
    }>((resolve, reject) => {
      const query = db
        .transaction('sessions')
        .objectStore('sessions')
        .get(sessionId);
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    const ref = session.questionRefs[0]!;
    const question = await new Promise<{
      options: { id: string }[];
      correctOptionIds: string[];
    }>((resolve, reject) => {
      const query = db
        .transaction('questions')
        .objectStore('questions')
        .get([ref.id, ref.version]);
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    db.close();
    return question.options.findIndex(
      (option) =>
        question.correctOptionIds.includes(option.id) === wantedCorrect,
    );
  }, correct);
}

test('错题筛选、原因、掌握、重做和再次答错恢复待复习', async ({
  page,
}, testInfo) => {
  await page.goto('/practice');
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  const wrong = await optionIndex(page);
  expect(wrong).toBeGreaterThanOrEqual(0);
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .nth(wrong)
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('link', { name: '查看待复习错题' }).click();
  await expect(page.getByRole('heading', { name: '错题本' })).toBeVisible();
  await expect(page.getByText('1 道待复习。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '资料分析', exact: true }).click();
  await page.getByRole('button', { name: '综合资料分析' }).click();
  await expect(page.getByText('答错 1 次')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mistake-list.png') });
  await page.locator('a[href^="/mistakes/"]').last().click();
  await expect(page.getByRole('heading', { name: '错题详情' })).toBeVisible();
  await expect(page.getByText('共用资料 · 可横向滑动查看表格')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mistake-detail.png') });
  await page.getByRole('button', { name: '审题错误' }).click();
  await expect(page.getByRole('button', { name: '审题错误' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '标记已掌握' }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: '重新标记待复习' }),
  ).toBeVisible();
  await page.getByRole('link', { name: '错题本' }).first().click();
  await expect(page.getByText('0 道待复习。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '已掌握' }).click();
  await expect(page.getByText('答错 1 次')).toBeVisible();
  await page.locator('a[href^="/mistakes/"]').last().click();
  await page.getByRole('button', { name: '重做这道题' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .nth(await optionIndex(page))
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await page.getByRole('link', { name: '查看待复习错题' }).click();
  await expect(page.getByText('1 道待复习。', { exact: false })).toBeVisible();
  await page.locator('a[href^="/mistakes/"]').last().click();
  await expect(page.getByText('答错 2 次')).toBeVisible();
  await expect(page.getByRole('button', { name: '暂不填写' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('从筛选结果批量重做，正确作答也保留待复习状态', async ({ page }) => {
  await page.goto('/practice');
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(page.getByRole('group', { name: '选择答案' })).toBeVisible();
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .nth(await optionIndex(page))
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await page.getByRole('link', { name: '查看待复习错题' }).click();
  await page.getByRole('button', { name: '重做前 1 题' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .nth(await optionIndex(page, true))
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByText('第 2 次作答')).toBeVisible();
  await page.getByRole('link', { name: '错题本' }).click();
  await expect(page.getByText('1 道待复习。', { exact: false })).toBeVisible();
});

test('首次进入、模块导航、刷新与主题持久化', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '今天学什么？' }),
  ).toBeVisible();
  await expect(
    page.getByText('完成一套真题后，这里会显示你的学习数据。'),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('home-light.png') });
  await page.getByRole('link', { name: '浏览知识体系' }).click();
  await expect(
    page.getByRole('heading', { name: '知识体系', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.module-list > li')).toHaveCount(6);
  await page.getByRole('link', { name: /资料分析.*11 个知识点/ }).click();
  await expect(
    page.getByRole('heading', { name: '资料分析', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.knowledge-row')).toHaveCount(11);
  await expect(page.getByText('增长率', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.knowledge-row')).toHaveCount(11);
  await page.getByRole('button', { name: '切换深色模式' }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.screenshot({ path: testInfo.outputPath('module-dark.png') });
  await page.reload();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.getByRole('button', { name: '切换浅色模式' }).click();
  await expect(page.locator('html')).not.toHaveClass('dark');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('初始化不重复、数据库真实持久化与无模拟记录', async ({ page }) => {
  await page.goto('/learn');
  await expect(page.locator('.module-list > li')).toHaveCount(6);
  await page.reload();
  await expect(page.locator('.module-list > li')).toHaveCount(6);
  const counts = await page.evaluate(async () => {
    const request = indexedDB.open('kaogong-learning');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = [
      'modules',
      'knowledgePoints',
      'answers',
      'sessions',
      'lessons',
    ];
    const counts = await Promise.all(
      names.map(
        (name) =>
          new Promise<number>((resolve, reject) => {
            const count = db.transaction(name).objectStore(name).count();
            count.onsuccess = () => resolve(count.result);
            count.onerror = () => reject(count.error);
          }),
      ),
    );
    db.close();
    return counts;
  });
  expect(counts).toEqual([6, 53, 0, 0, 48]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('新课程可从目录进入并创建对应模块的真题练习', async ({ page }) => {
  await page.goto('/learn/politics');
  await page.getByRole('link', { name: '基本政治理论' }).click();
  await expect(
    page.getByRole('heading', { name: /基本政治理论：从真题理解考点/ }),
  ).toBeVisible();
  await expect(page.getByText('真题例题')).toBeVisible();
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  await expect(page.getByText('来源答案，未独立核验')).toBeVisible();
});

test('大模块首次导入后可交卷并显示正确模块', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/practice');
  await page.getByRole('button', { name: '练习判断推理' }).click();
  await expect(page.getByText(/判断推理 · 已作答/)).toBeVisible({
    timeout: 45000,
  });
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .first()
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/判断推理 · 真题 · 5 题/)).toBeVisible();
});

test('课程和练习入口统一使用真题，草稿恢复与交卷正常', async ({
  page,
}, testInfo) => {
  await page.goto('/learn/data-analysis');
  await page.getByRole('link', { name: '增长率' }).click();
  await expect(
    page.getByRole('heading', { name: /增长率：先找基期/ }),
  ).toBeVisible();
  await expect(page.getByText('识别题型')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('lesson.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: '标记课程已学完' }).click();
  await expect(page.getByRole('button', { name: '已完成课程' })).toBeVisible();
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('session.png') });
  await expect(page.getByText('来源答案，未独立核验')).toBeVisible();
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .first()
    .click();
  await page.getByRole('button', { name: '标记不确定' }).click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByLabel('练习用时 00:00')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('group', { name: '选择答案' }).getByRole('button').first(),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: '已标记不确定' }),
  ).toBeVisible();
  await expect(page.getByLabel('练习用时 00:00')).toHaveCount(0);
  await page.getByRole('link', { name: '练习', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '继续未完成练习' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: /真题练习 · 5 题 · 已到第 1 题/ })
    .click();
  await expect(
    page.getByRole('group', { name: '选择答案' }).getByRole('button').first(),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '下一题' }).click();
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .nth(1)
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('result.png'),
    fullPage: true,
  });
  await expect(
    page.getByText(/首次作答：\d\/2 题正确；重复作答：0\/0 题正确。/),
  ).toBeVisible();
  await expect(page.getByText('按难度看历史用时')).toBeVisible();
  await expect(page.getByText('未作答', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible();
  await page.getByRole('link', { name: '再练一套' }).click();
  await expect(
    page.getByRole('button', { name: '开始一套新练习' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始真题题组' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(page.getByText('来源答案，未独立核验')).toBeVisible();
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .first()
    .click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(
    page.getByText(/首次作答：\d\/1 题正确；重复作答：0\/0 题正确。/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('私人真题练习显示共享表格图片并保留来源状态', async ({
  page,
}, testInfo) => {
  await page.goto('/practice');
  await page.getByRole('button', { name: '开始练习真题' }).click();
  await expect(page.getByText('共用资料 · 可横向滑动查看表格')).toBeVisible();
  await expect(page.getByText('来源答案，未独立核验')).toBeVisible();
  const image = page.locator('img[src*="/content/bank/assets/"]').first();
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
  ).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('bank-session.png') });
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible();
  await expect(page.getByText('来源答案，未独立核验').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.route('**/content/bank/manifest.json', (route) => route.abort());
  await page.reload();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible();
});

test('存储不可用时显示错误并支持重试', async ({ page }) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (
      ...args: Parameters<IDBFactory['open']>
    ) {
      if (sessionStorage.getItem('allow-idb') !== 'yes')
        throw new DOMException('测试存储被禁用', 'SecurityError');
      return open.apply(this, args);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('本地学习空间暂时不可用');
  await page.evaluate(() => sessionStorage.setItem('allow-idb', 'yes'));
  await page.getByRole('button', { name: '重新尝试' }).click();
  await expect(
    page.getByRole('heading', { name: '今天学什么？' }),
  ).toBeVisible();
});

test('无效路径有返回入口；全部模块可浏览且不溢出', async ({ page }) => {
  await page.goto('/learn/missing');
  await expect(
    page.getByRole('heading', { name: '没有找到这个页面' }),
  ).toBeVisible();
  await page.getByRole('link', { name: '返回知识体系' }).click();
  const links = await page
    .locator('.module-row')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('href')!),
    );
  for (const link of links) {
    await page.goto(link);
    await expect(page.locator('.knowledge-row').first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
