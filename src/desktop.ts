import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Update } from '@tauri-apps/plugin-updater';

export type { Update } from '@tauri-apps/plugin-updater';
export const isDesktop = isTauri();

export async function fitWindow(authenticated: boolean): Promise<void> {
  if (!isDesktop) return;
  const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
  const window = getCurrentWindow();
  await window.setMinSize(new LogicalSize(authenticated ? 820 : 420, authenticated ? 600 : 340));
  await window.setSize(new LogicalSize(authenticated ? 1080 : 520, authenticated ? 720 : 360));
  await window.center();
}

export async function getAppVersion(): Promise<string> {
  if (!isDesktop) return __APP_VERSION__;
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
}

// This public prototype password is only an entry gate, not account security.
export async function signIn(password: string): Promise<boolean> {
  return isDesktop ? invoke<boolean>('sign_in', { password }) : password === 'anjing';
}

export async function checkForUpdate(): Promise<Update | null> {
  if (!isDesktop) throw new Error('请在桌面客户端检查更新');
  const { check } = await import('@tauri-apps/plugin-updater');
  return check({ timeout: 20_000 });
}

export async function relaunchApp(): Promise<void> {
  if (!isDesktop) throw new Error('请在桌面客户端重启');
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
