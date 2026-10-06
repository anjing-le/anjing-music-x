import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { enterMusic, musicAudio, musicNavigation, playerBar, readAudio, signIn } from './helpers';

test('local WAV import persists audio, filename, metadata, favorites and recent playback across reload', async ({ page }) => {
  await enterMusic(page);
  const input = page.getByLabel('导入本地音乐文件', { exact: true });
  await expect(page.getByRole('button', { name: '导入本地音乐', exact: true })).toBeEnabled();
  await input.setInputFiles('public/audio/paper-morning.wav');
  await expect(page.getByRole('status')).toContainText('已导入 1 首本地音乐');
  const imported = page.getByRole('button', { name: '播放 paper-morning', exact: true });
  await expect(imported).toBeVisible();
  await expect(imported.locator('..').locator('..')).toContainText('本地音乐');
  await expect(imported.locator('..').locator('..')).toContainText('0:22');
  await imported.click();
  await expect.poll(async () => (await readAudio(page)).src).toMatch(/^blob:/);
  await expect.poll(async () => (await readAudio(page)).duration).toBeCloseTo(22, 2);
  await expect.poll(async () => (await readAudio(page)).paused).toBe(false);
  await expect.poll(async () => (await readAudio(page)).currentTime).toBeGreaterThan(0.15);
  await page.getByRole('button', { name: '喜欢 paper-morning', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '取消喜欢 paper-morning', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await signIn(page);
  await musicNavigation(page).getByRole('button', { name: '我喜欢', exact: true }).click();
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toBeVisible();
  await musicNavigation(page).getByRole('button', { name: '最近播放', exact: true }).click();
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '播放 paper-morning', exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).src).toMatch(/^blob:/);
  await expect.poll(async () => (await readAudio(page)).currentTime).toBeGreaterThan(0.15);
  await playerBar(page).getByRole('button', { name: '暂停播放', exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).paused).toBe(true);
  await musicNavigation(page).getByRole('button', { name: '全部歌曲', exact: true }).click();
  await page.getByLabel('导入本地音乐文件', { exact: true }).setInputFiles('public/audio/paper-morning.wav');
  await expect(page.getByRole('status')).toContainText('所选文件已在本地曲库中');
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toHaveCount(1);
  await page.getByLabel('搜索歌曲、歌手或专辑').fill('paper-morning');
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toBeVisible();
  await expect(musicAudio(page)).toHaveCount(1);
});

test('unsupported or corrupt local files leave the library and original demo playback intact', async ({ page }) => {
  await enterMusic(page);
  const input = page.getByLabel('导入本地音乐文件', { exact: true });
  await expect(page.getByRole('button', { name: '导入本地音乐', exact: true })).toBeEnabled();
  await expect(input).toHaveAttribute('accept', '.wav,.flac,.mp3,.m4a,.ogg');
  await input.setInputFiles({ name: '不是音频.txt', mimeType: 'text/plain', buffer: Buffer.from('text') });
  await expect(page.getByRole('alert')).toContainText('格式不支持');
  await expect(page.getByRole('button', { name: '播放 不是音频', exact: true })).toHaveCount(0);
  await input.setInputFiles([
    { name: '应当撤销.wav', mimeType: 'audio/wav', buffer: await readFile('public/audio/paper-morning.wav') },
    { name: '损坏.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('not a valid MP3') },
  ]);
  await expect(page.getByRole('alert')).toContainText('无法读取');
  await expect(page.getByRole('button', { name: '播放 损坏', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '播放 应当撤销', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '播放 纸上晨光', exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).currentTime).toBeGreaterThan(0.15);
  await expect.poll(async () => (await readAudio(page)).paused).toBe(false);
});

test('removing a local copy clears its queue, current, favorite and recent entries while keeping the source file', async ({ page }) => {
  const source = await readFile('public/audio/paper-morning.wav');
  await enterMusic(page);
  await expect(page.getByRole('button', { name: '导入本地音乐', exact: true })).toBeEnabled();
  await page.getByLabel('导入本地音乐文件', { exact: true }).setInputFiles('public/audio/paper-morning.wav');
  await expect(page.getByRole('status')).toContainText('已导入 1 首本地音乐');
  await page.getByLabel('搜索歌曲、歌手或专辑').fill('paper-morning');
  await page.getByRole('button', { name: '播放 paper-morning', exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).currentTime).toBeGreaterThan(0.15);
  await page.getByRole('button', { name: '喜欢 paper-morning', exact: true }).first().click();
  await page.getByRole('button', { name: '移除本地副本 paper-morning', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: '移除本地副本？', exact: true });
  await confirmation.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toBeVisible();
  await expect.poll(async () => (await readAudio(page)).paused).toBe(false);
  await page.getByRole('button', { name: '移除本地副本 paper-morning', exact: true }).click();
  await confirmation.getByRole('button', { name: '移除本地副本', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已移除本地副本');
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await readAudio(page)).srcAttribute).toBeNull();
  await expect.poll(async () => (await readAudio(page)).paused).toBe(true);
  await page.getByRole('button', { name: '打开播放队列', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '播放队列', exact: true })).toContainText('0 首歌曲');
  await page.getByRole('button', { name: '关闭播放队列', exact: true }).click();
  await musicNavigation(page).getByRole('button', { name: '我喜欢', exact: true }).click();
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toHaveCount(0);
  await musicNavigation(page).getByRole('button', { name: '最近播放', exact: true }).click();
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toHaveCount(0);
  await page.reload(); await signIn(page);
  await musicNavigation(page).getByRole('button', { name: '全部歌曲', exact: true }).click();
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toHaveCount(0);
  expect(await readFile('public/audio/paper-morning.wav')).toEqual(source);
  await expect(page.getByRole('button', { name: '导入本地音乐', exact: true })).toBeEnabled();
  await page.getByLabel('导入本地音乐文件', { exact: true }).setInputFiles('public/audio/paper-morning.wav');
  await expect(page.getByRole('status')).toContainText('已导入 1 首本地音乐');
  await expect(page.getByRole('button', { name: '播放 paper-morning', exact: true })).toBeVisible();
});
