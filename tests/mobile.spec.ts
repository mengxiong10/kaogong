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
  expect(counts).toEqual([6, 53, 0, 0, 1]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('增长率课程、草稿恢复、统一交卷和重复作答', async ({ page }, testInfo) => {
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
  await page.getByRole('button', { name: '开始 5 题练习' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /第 1 题/ }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('session.png') });
  await page.getByRole('button', { name: 'A -20%' }).click();
  await page.getByRole('button', { name: '标记不确定' }).click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByLabel('练习用时 00:00')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'A -20%' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.getByRole('button', { name: '已标记不确定' }),
  ).toBeVisible();
  await expect(page.getByLabel('练习用时 00:00')).toHaveCount(0);
  await page.getByRole('link', { name: '练习', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '继续未完成练习' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /增长率 · 5 题 · 已到第 1 题/ }).click();
  await expect(page.getByRole('button', { name: 'A -20%' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '下一题' }).click();
  await page.getByRole('button', { name: 'B 20%' }).click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('result.png'),
    fullPage: true,
  });
  await expect(
    page.getByText('首次作答：1/2 题正确；重复作答：0/0 题正确。'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '按难度看用时' }),
  ).toBeVisible();
  await expect(page.getByText('未作答', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '练习结果' })).toBeVisible();
  await page.getByRole('link', { name: '再练一套' }).click();
  await page.getByRole('button', { name: '开始一套新练习' }).click();
  await page.getByRole('button', { name: 'A -20%' }).click();
  await expect(page.getByText(/已保存/)).toBeVisible();
  await page.getByRole('button', { name: /交卷并查看解析/ }).click();
  await expect(
    page.getByText('首次作答：0/0 题正确；重复作答：1/1 题正确。'),
  ).toBeVisible();
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
