import { expect, test } from '@playwright/test';

test('首次进入、模块导航、刷新与主题持久化', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '从一个知识点开始。' }),
  ).toBeVisible();
  await expect(page.getByText('还没有学习记录', { exact: true })).toBeVisible();
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
  await expect(page.getByText('判断推理 / 真题 · 单选')).toBeVisible({
    timeout: 45000,
  });
  await page
    .getByRole('group', { name: '选择答案' })
    .getByRole('button')
    .first()
    .click();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible();
  await expect(page.getByText('判断推理 / 真题 · 已交卷')).toBeVisible();
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
  await expect(
    page.getByRole('heading', { name: '按难度看用时' }),
  ).toBeVisible();
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
    page.getByRole('heading', { name: '从一个知识点开始。' }),
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
