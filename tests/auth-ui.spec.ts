import { expect, test } from '@playwright/test';
import { enterMusic, musicAudio, musicNavigation, playerBar } from './helpers';

test('incorrect password is rejected; a correct entry opens music; reload resets the session', async ({ page }) => {
  await page.goto('/');
  const password = page.getByLabel('密码', { exact: true });
  await expect(password).toBeFocused();
  await password.fill('wrong-password');
  await password.press('Enter');
  await expect(page.getByRole('alert')).toContainText('密码不正确');
  await expect(password).toHaveAttribute('aria-invalid', 'true');
  await expect(musicNavigation(page)).toHaveCount(0);
  await password.fill('anjing');
  await password.press('Enter');
  await expect(page.getByRole('heading', { name: '推荐', exact: true })).toBeVisible();
  await expect(musicNavigation(page)).toBeVisible();
  await expect(musicAudio(page)).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('button', { name: '进入音乐', exact: true })).toBeVisible();
  await expect(password).toHaveValue('');
  await expect(password).toBeFocused();
  await expect(musicAudio(page)).toHaveCount(0);
});

test('password visibility preserves editable input and returns to a concealed field', async ({ page }) => {
  await page.goto('/');
  const password = page.getByLabel('密码', { exact: true });
  await password.fill('anjing');
  await page.getByRole('button', { name: '显示密码', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('anjing');
  await password.fill('anjing-edited');
  await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('anjing-edited');
});

test('settings contains keyboard focus, keeps browser OTA disabled and restores the opener', async ({ page }) => {
  await enterMusic(page);
  const settings = page.getByRole('button', { name: '打开设置', exact: true });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: '设置', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '检查更新', exact: true })).toBeDisabled();
  await expect(dialog).toContainText('桌面客户端');
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < 5; index++) {
      await page.keyboard.press(key);
      await expect(dialog.locator(':focus')).toHaveCount(1);
    }
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
  await page.keyboard.press('ControlOrMeta+,');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
  await expect(playerBar(page).getByRole('button', { name: '播放音乐', exact: true })).toBeVisible();
});
