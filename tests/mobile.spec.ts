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
  expect(counts).toEqual([6, 53, 0, 0, 0]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
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
