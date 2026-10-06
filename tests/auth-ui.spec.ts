import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/');
  await page.getByLabel('密码', { exact: true }).fill('anjing');
  await page.getByRole('button', { name: '进入工作台', exact: true }).click();
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible();
}

test('wrong password stays outside; correct password enters; reload resets session', async ({ page }) => {
  await page.goto('/');
  const password = page.getByLabel('密码', { exact: true });
  await expect(password).toBeFocused();
  await password.fill('wrong-password');
  await password.press('Enter');
  await expect(page.getByRole('alert')).toContainText('密码不正确');
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await password.fill('anjing');
  await password.press('Enter');
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '进入工作台' })).toBeVisible();
});

test('password visibility preserves the editable value', async ({ page }) => {
  await page.goto('/');
  const password = page.getByLabel('密码', { exact: true });
  await password.fill('anjing');
  await page.getByRole('button', { name: '显示密码' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('anjing');
  await page.getByRole('button', { name: '隐藏密码' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('settings traps keyboard focus, disables browser OTA and restores focus', async ({ page }) => {
  await enter(page);
  const settings = page.getByRole('button', { name: '打开设置' });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: '设置', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '检查更新' })).toBeDisabled();
  await expect(dialog).toContainText('桌面客户端');
  for (let index = 0; index < 4; index++) await page.keyboard.press('Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
});

test('note remains editable; cancel preserves it; clear and logout require explicit actions', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: '写一张便笺', exact: true }).first().click();
  const note = page.getByRole('textbox', { name: '便笺内容' });
  await expect(note).toBeFocused();
  await note.fill('今天想弹一首歌 🎵');
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(note).toHaveValue('今天想弹一首歌 🎵');
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '退出工作台？' })).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(note).toHaveValue('今天想弹一首歌 🎵');
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.getByRole('button', { name: '清空便笺', exact: true }).click();
  await expect(note).toHaveValue('');
  await expect(note).toBeFocused();
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入工作台' })).toBeVisible();
});

test('minimum workspace size retains layout and local assets load without errors', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 560 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const failedAssets: string[] = [];
  page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === 'http://127.0.0.1:1426') failedAssets.push(response.url()); });
  await enter(page);
  await page.getByRole('button', { name: '写一张便笺', exact: true }).first().click();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.getByRole('button', { name: '打开设置' }).click();
  await expect(page.getByRole('dialog', { name: '设置', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
