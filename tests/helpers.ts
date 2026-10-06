import { expect, type Locator, type Page } from '@playwright/test';

export async function signIn(page: Page) {
  await page.getByLabel('密码', { exact: true }).fill('anjing');
  await page.getByRole('button', { name: '进入音乐', exact: true }).click();
  await expect(page.getByRole('heading', { name: '推荐', exact: true })).toBeVisible();
}

export async function enterMusic(page: Page) {
  await page.goto('/');
  await signIn(page);
}

export const playerBar = (page: Page) => page.locator('footer[aria-label="播放器"]');
export const musicNavigation = (page: Page) => page.getByRole('navigation', { name: '音乐导航' });
export const musicAudio = (page: Page) => page.getByTestId('music-audio');

export async function readAudio(page: Page) {
  await expect(musicAudio(page)).toHaveCount(1);
  return musicAudio(page).evaluate(node => {
    const audio = node as HTMLAudioElement;
    return {
      src: audio.currentSrc || audio.src,
      srcAttribute: audio.getAttribute('src'),
      currentTime: audio.currentTime,
      duration: audio.duration,
      paused: audio.paused,
      muted: audio.muted,
      volume: audio.volume,
      ended: audio.ended,
      errorCode: audio.error?.code ?? 0,
    };
  });
}

export async function expectPlaying(page: Page, source: string) {
  await expect.poll(async () => (await readAudio(page)).src).toContain(source);
  // The bundled PCM fixtures contain 22 seconds of real audio, independently
  // of the duration text declared in the catalog or displayed by the UI.
  await expect.poll(async () => (await readAudio(page)).duration).toBeCloseTo(22, 2);
  await expect.poll(async () => (await readAudio(page)).paused).toBe(false);
  await expect.poll(async () => (await readAudio(page)).currentTime, {
    timeout: 5_000, intervals: [100, 250],
  }).toBeGreaterThan(0.15);
  await expect(playerBar(page).getByRole('button', { name: '暂停播放', exact: true })).toBeVisible();
}

export async function setRangeFraction(slider: Locator, fraction: number) {
  await expect(slider).toBeEnabled();
  const minimum = Number(await slider.getAttribute('min') ?? 0);
  const maximum = Number(await slider.getAttribute('max') ?? 100);
  const step = Number(await slider.getAttribute('step') ?? 1);
  expect(Number.isFinite(step) && step > 0).toBe(true);
  const steps = Math.round((maximum - minimum) * fraction / step);
  // Drive the real range control through keyboard input rather than changing
  // media properties, React state, timestamps or dispatching fabricated events.
  await slider.focus();
  await slider.press('Home');
  for (let index = 0; index < steps; index++) await slider.press('ArrowRight');
  return minimum + steps * step;
}
