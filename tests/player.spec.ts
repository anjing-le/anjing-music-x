import { expect, test } from '@playwright/test';
import { playlists, tracks } from '../src/music/catalog';
import {
  enterMusic, expectPlaying, musicAudio, musicNavigation,
  playerBar, readAudio, setRangeFraction, signIn,
} from './helpers';

const [firstTrack, secondTrack] = tracks;

test('search and transport control real media; navigation and lyrics preserve its audio element', async ({ page }) => {
  await enterMusic(page);
  const search = page.getByLabel('搜索歌曲、歌手或专辑', { exact: true });
  const table = page.getByRole('table');
  const audio = musicAudio(page);
  const controls = playerBar(page);

  await test.step('search a title, then an artist and play the matching list', async () => {
    await search.fill('纸上的雨滴');
    await expect(page.getByRole('heading', { name: '搜索结果', exact: true })).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table.getByRole('button', { name: '播放 纸上的雨滴', exact: true })).toBeVisible();
    await search.fill('安静');
    await expect(table.getByRole('row')).toHaveCount(7);
    await table.getByRole('button', { name: `播放 ${firstTrack.title}`, exact: true }).click();
    await expectPlaying(page, firstTrack.src);
  });

  await test.step('pause and seek the actual loaded audio, then move between songs', async () => {
    await controls.getByRole('button', { name: '暂停播放', exact: true }).click();
    await expect.poll(async () => (await readAudio(page)).paused).toBe(true);
    const target = await setRangeFraction(page.getByLabel('播放进度', { exact: true }), 0.25);
    await expect.poll(async () => (await readAudio(page)).currentTime).toBeCloseTo(target, 1);
    await page.getByLabel('播放进度', { exact: true }).press('End');
    await expect.poll(async () => (await readAudio(page)).ended).toBe(true);
    await expect.poll(async () => (await readAudio(page)).currentTime).toBeCloseTo(22, 2);
    expect((await readAudio(page)).src).toContain(firstTrack.src);
    expect((await readAudio(page)).paused).toBe(true);
    await expect(controls.getByRole('button', { name: '播放音乐', exact: true })).toBeVisible();
    await controls.getByRole('button', { name: '上一首', exact: true }).click();
    await expect.poll(async () => (await readAudio(page)).currentTime).toBeLessThan(0.25);
    expect((await readAudio(page)).src).toContain(firstTrack.src);
    expect((await readAudio(page)).paused).toBe(true);
    await controls.getByRole('button', { name: '播放音乐', exact: true }).click();
    await expectPlaying(page, firstTrack.src);
    await controls.getByRole('button', { name: '下一首', exact: true }).click();
    await expectPlaying(page, secondTrack.src);
    // Returning from the beginning must navigate to the previous item, rather
    // than trigger the separate "rewind the current song after 3s" behavior.
    await page.getByLabel('播放进度', { exact: true }).press('Home');
    await controls.getByRole('button', { name: '上一首', exact: true }).click();
    await expectPlaying(page, firstTrack.src);
  });

  await test.step('volume and mute change the media properties without losing volume', async () => {
    const volume = await setRangeFraction(page.getByLabel('音量', { exact: true }), 0.25);
    await expect.poll(async () => (await readAudio(page)).volume).toBeCloseTo(volume, 2);
    await controls.getByRole('button', { name: '静音', exact: true }).click();
    await expect.poll(async () => (await readAudio(page)).muted).toBe(true);
    expect((await readAudio(page)).volume).toBeCloseTo(volume, 2);
    await controls.getByRole('button', { name: '取消静音', exact: true }).click();
    await expect.poll(async () => (await readAudio(page)).muted).toBe(false);
    expect((await readAudio(page)).volume).toBeCloseTo(volume, 2);
  });

  await test.step('page navigation and lyrics keep the same continuously playing element', async () => {
    const original = await audio.elementHandle();
    if (!original) throw new Error('The native audio element was not mounted');
    const before = (await readAudio(page)).currentTime;
    for (const name of ['全部歌曲', '我喜欢', '最近播放', '推荐']) {
      await musicNavigation(page).getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      expect(await audio.evaluate((node, previous) => node === previous, original)).toBe(true);
      expect((await readAudio(page)).paused).toBe(false);
    }
    await expect.poll(async () => (await readAudio(page)).currentTime).toBeGreaterThan(before + 0.2);
    await controls.getByRole('button', { name: '打开歌词', exact: true }).click();
    await expect(page.getByRole('heading', { name: firstTrack.title, exact: true })).toBeVisible();
    await expect(page.getByLabel('歌词', { exact: true })).toContainText('纯音乐');
    expect(await audio.evaluate((node, previous) => node === previous, original)).toBe(true);
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await expect(page.getByRole('heading', { name: '推荐', exact: true })).toBeVisible();
    expect((await readAudio(page)).paused).toBe(false);
    await original.dispose();
  });
});

test('favorites persist across logout and reload while login sessions do not', async ({ page }) => {
  await enterMusic(page);
  await page.getByRole('table').getByRole('button', { name: `喜欢 ${firstTrack.title}`, exact: true }).click();
  const showFavorites = async () => {
    await musicNavigation(page).getByRole('button', { name: '我喜欢', exact: true }).click();
    await expect(page.getByRole('heading', { name: '我喜欢', exact: true })).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(table.getByRole('button', { name: `取消喜欢 ${firstTrack.title}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  };
  await showFavorites();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入音乐', exact: true })).toBeVisible();
  await expect(musicAudio(page)).toHaveCount(0);
  await signIn(page);
  await showFavorites();
  await page.reload();
  await expect(page.getByRole('button', { name: '进入音乐', exact: true })).toBeVisible();
  await signIn(page);
  await showFavorites();
  await page.getByRole('table').getByRole('button', { name: `取消喜欢 ${firstTrack.title}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: '还没有喜欢的歌曲', exact: true })).toBeVisible();
});

test('a playlist establishes its own queue; real ended playback advances; removing current songs remains coherent', async ({ page }) => {
  await enterMusic(page);
  const playlist = playlists[0];
  const ordered = playlist.trackIds.map(id => tracks.find(track => track.id === id)!);
  await page.getByRole('button', { name: `打开歌单 ${playlist.title}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: playlist.title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '播放全部', exact: true }).click();
  await expectPlaying(page, ordered[0].src);
  await playerBar(page).getByRole('button', { name: '打开播放队列', exact: true }).click();
  const queue = page.getByRole('dialog', { name: '播放队列', exact: true });
  await expect(queue).toBeVisible();
  const queueSongs = queue.getByRole('button', { name: /^播放队列歌曲 / });
  expect(await queueSongs.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))))
    .toEqual(ordered.map(track => `播放队列歌曲 ${track.title}`));

  const search = page.getByLabel('搜索歌曲、歌手或专辑', { exact: true });
  await search.fill('安静');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(queue).toBeVisible();
  await search.press('Escape');
  await expect(queue).toHaveCount(0);
  await expect(playerBar(page).getByRole('button', { name: '打开播放队列', exact: true })).toBeFocused();
  await playerBar(page).getByRole('button', { name: '打开播放队列', exact: true }).click();
  await musicNavigation(page).getByRole('button', { name: '推荐', exact: true }).click();

  // Seek close to the real media end through pointer input, then let its
  // remaining audio play. A native `ended` event must advance to the next song.
  const progress = page.getByLabel('播放进度', { exact: true });
  const box = await progress.boundingBox();
  if (!box) throw new Error('The playback progress control has no visible bounds');
  await progress.click({ position: { x: box.width * 0.94, y: box.height / 2 } });
  expect((await readAudio(page)).currentTime).toBeGreaterThan(20);
  await expectPlaying(page, ordered[1].src);
  await queue.getByRole('button', { name: `从队列移除 ${ordered[1].title}`, exact: true }).click();
  await expect(queueSongs).toHaveCount(2);
  await expectPlaying(page, ordered[2].src);
  await expect(queue.getByRole('button', { name: `播放队列歌曲 ${ordered[1].title}`, exact: true })).toHaveCount(0);
  await queue.getByRole('button', { name: `从队列移除 ${ordered[0].title}`, exact: true }).click();
  await expect(queueSongs).toHaveCount(1);
  expect((await readAudio(page)).src).toContain(ordered[2].src);
  expect((await readAudio(page)).paused).toBe(false);
  await playerBar(page).getByRole('button', { name: '打开歌词', exact: true }).click();
  await expect(page.getByRole('heading', { name: ordered[2].title, exact: true })).toBeVisible();
  await queue.getByRole('button', { name: `从队列移除 ${ordered[2].title}`, exact: true }).click();
  await expect(queueSongs).toHaveCount(0);
  await expect.poll(async () => (await readAudio(page)).paused).toBe(true);
  await expect.poll(async () => (await readAudio(page)).srcAttribute).toBeNull();
  await expect(playerBar(page).getByRole('button', { name: '尚未选择歌曲', exact: true })).toBeDisabled();
  await expect(page.getByLabel('播放进度', { exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: '推荐', exact: true })).toBeVisible();
  await expect(musicNavigation(page).getByRole('button', { name: '推荐', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(playerBar(page).getByRole('button', { name: '打开歌词', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await queue.getByRole('button', { name: '关闭播放队列', exact: true }).click();
  await expect(queue).toHaveCount(0);
});

test('the 820×600 layout does not overflow; a failed resource never fakes playback and another song recovers', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 600 });
  const exceptions: string[] = [];
  const failedAssets: string[] = [];
  let failedRequests = 0;
  page.on('pageerror', error => exceptions.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (response.status() >= 400 && url.origin === new URL(page.url()).origin && url.pathname !== firstTrack.src) {
      failedAssets.push(url.pathname);
    }
  });
  await page.route(`**${firstTrack.src}`, async route => {
    failedRequests += 1;
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'deliberate media failure' });
  }, { times: 1 });
  await enterMusic(page);
  await expect(playerBar(page)).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('table').getByRole('button', { name: `播放 ${firstTrack.title}`, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/无法播放|加载失败/);
  expect(failedRequests).toBe(1);
  await expect.poll(async () => (await readAudio(page)).errorCode).toBeGreaterThan(0);
  expect((await readAudio(page)).paused).toBe(true);
  expect((await readAudio(page)).currentTime).toBe(0);
  await expect(playerBar(page).getByRole('button', { name: '播放音乐', exact: true })).toBeVisible();
  await page.getByRole('table').getByRole('button', { name: `播放 ${secondTrack.title}`, exact: true }).click();
  await expectPlaying(page, secondTrack.src);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect((await readAudio(page)).errorCode).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.waitForLoadState('networkidle');
  expect(exceptions).toEqual([]);
  expect(failedAssets).toEqual([]);
});
