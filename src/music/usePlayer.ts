import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from './catalog';

export type PlayMode = 'sequence' | 'repeat-one' | 'shuffle';
export type Player = {
  currentTrack: Track | null;
  queue: Track[];
  playing: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  mode: PlayMode;
  error: string | null;
  playTracks(list: Track[], startIndex?: number): void;
  toggle(): void;
  next(): void;
  previous(): void;
  seek(seconds: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  cycleMode(): void;
  removeFromQueue(id: string): void;
  clearError(): void;
};

const bounded = (value: number, low: number, high: number) =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low;

function playbackError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return '浏览器暂未允许播放，请点击播放按钮重试。';
  }
  if (error instanceof DOMException && error.name === 'NotSupportedError') {
    return '无法播放这个音频格式，请换一首或重试。';
  }
  return '音频暂时无法播放，请检查文件或点击播放重试。';
}

export function usePlayer(): Player {
  const audio = useRef<HTMLAudioElement | null>(null);
  const request = useRef(0);
  // Native `ended` sets paused=true too; retain the user's explicit play intent.
  const intentRef = useRef(false);
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const modeRef = useRef<PlayMode>('sequence');
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, volumeState] = useState(0.65);
  const [muted, mutedState] = useState(false);
  const [mode, modeState] = useState<PlayMode>('sequence');
  const [error, setError] = useState<string | null>(null);
  const nextRef = useRef<(ended?: boolean) => void>(() => {});

  const play = useCallback(async () => {
    const element = audio.current;
    if (!element || indexRef.current < 0) return;
    intentRef.current = true;
    const token = ++request.current;
    setError(null);
    setLoading(true);
    try {
      await element.play();
      if (token === request.current) setLoading(false);
    } catch (cause) {
      if (token !== request.current) return;
      intentRef.current = false;
      setLoading(false);
      setPlaying(false);
      setError(playbackError(cause));
    }
  }, []);

  const select = useCallback((index: number, autoplay = true) => {
    const element = audio.current;
    const track = queueRef.current[index];
    if (!element || !track) return;
    ++request.current;
    intentRef.current = autoplay;
    element.pause();
    indexRef.current = index;
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    setLoading(autoplay);
    setError(null);
    element.src = track.src;
    element.load();
    if (autoplay) void play();
  }, [play]);

  const next = useCallback((ended = false) => {
    const list = queueRef.current;
    const index = indexRef.current;
    if (!list.length || index < 0) return;
    if (ended && modeRef.current === 'repeat-one') { select(index); return; }
    if (modeRef.current === 'shuffle' && list.length > 1) {
      const jump = 1 + Math.floor(Math.random() * (list.length - 1));
      select((index + jump) % list.length);
      return;
    }
    if (ended && index === list.length - 1) {
      intentRef.current = false;
      setPlaying(false);
      setLoading(false);
      return;
    }
    select((index + 1) % list.length);
  }, [select]);
  nextRef.current = next;

  useEffect(() => {
    const element = new Audio();
    element.preload = 'metadata';
    element.volume = 0.65;
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('data-testid', 'music-audio');
    document.body.appendChild(element);
    audio.current = element;
    const time = () => setCurrentTime(Number.isFinite(element.currentTime) ? element.currentTime : 0);
    const metadata = () => setDuration(Number.isFinite(element.duration) ? element.duration : 0);
    const start = () => { setPlaying(true); setLoading(false); };
    const pause = () => setPlaying(false);
    const waiting = () => { if (!element.paused) setLoading(true); };
    const failed = () => {
      ++request.current;
      intentRef.current = false;
      element.pause();
      setPlaying(false);
      setLoading(false);
      setError(element.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
        ? '无法播放这个音频格式，请换一首或重试。'
        : '音频加载失败，请检查文件或点击播放重试。');
    };
    const ended = () => {
      if (intentRef.current) nextRef.current(true);
      else { setPlaying(false); setLoading(false); }
    };
    element.addEventListener('timeupdate', time);
    element.addEventListener('loadedmetadata', metadata);
    element.addEventListener('durationchange', metadata);
    element.addEventListener('playing', start);
    element.addEventListener('pause', pause);
    element.addEventListener('waiting', waiting);
    element.addEventListener('error', failed);
    element.addEventListener('ended', ended);
    return () => {
      ++request.current;
      intentRef.current = false;
      element.pause();
      element.removeEventListener('timeupdate', time);
      element.removeEventListener('loadedmetadata', metadata);
      element.removeEventListener('durationchange', metadata);
      element.removeEventListener('playing', start);
      element.removeEventListener('pause', pause);
      element.removeEventListener('waiting', waiting);
      element.removeEventListener('error', failed);
      element.removeEventListener('ended', ended);
      element.removeAttribute('src');
      element.load();
      element.remove();
      if (audio.current === element) audio.current = null;
    };
  }, []);

  const playTracks = useCallback((list: Track[], startIndex = 0) => {
    if (!list.length) return;
    const requested = list[Math.floor(bounded(startIndex, 0, list.length - 1))]?.id;
    const ids = new Set<string>();
    const unique = list.filter((track) => {
      if (ids.has(track.id)) return false;
      ids.add(track.id);
      return true;
    }).slice(0, 100);
    queueRef.current = unique;
    setQueue(unique);
    select(Math.max(0, unique.findIndex((track) => track.id === requested)));
  }, [select]);

  const toggle = useCallback(() => {
    const element = audio.current;
    if (!element || indexRef.current < 0) return;
    if (element.paused || element.error) {
      if (element.error) element.load();
      if (element.ended) element.currentTime = 0;
      void play();
    } else {
      ++request.current;
      intentRef.current = false;
      element.pause();
      setLoading(false);
    }
  }, [play]);

  const previous = useCallback(() => {
    const element = audio.current;
    if (!element || !queueRef.current.length) return;
    if (element.currentTime > 3) {
      element.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    select((indexRef.current - 1 + queueRef.current.length) % queueRef.current.length);
  }, [select]);

  const seek = useCallback((seconds: number) => {
    const element = audio.current;
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return;
    element.currentTime = bounded(seconds, 0, element.duration);
    setCurrentTime(element.currentTime);
  }, []);

  const setVolume = useCallback((value: number) => {
    const normalized = bounded(value, 0, 1);
    if (audio.current) audio.current.volume = normalized;
    volumeState(normalized);
  }, []);

  const toggleMute = useCallback(() => {
    if (!audio.current) return;
    audio.current.muted = !audio.current.muted;
    mutedState(audio.current.muted);
  }, []);

  const cycleMode = useCallback(() => {
    const modes: PlayMode[] = ['sequence', 'repeat-one', 'shuffle'];
    modeRef.current = modes[(modes.indexOf(modeRef.current) + 1) % modes.length];
    modeState(modeRef.current);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    const list = queueRef.current;
    const removed = list.findIndex((track) => track.id === id);
    if (removed < 0) return;
    const currentId = list[indexRef.current]?.id;
    const wasPlaying = Boolean(audio.current && !audio.current.paused);
    const remaining = list.filter((track) => track.id !== id);
    queueRef.current = remaining;
    setQueue(remaining);
    if (currentId !== id) {
      indexRef.current = remaining.findIndex((track) => track.id === currentId);
      return;
    }
    if (remaining.length) {
      select(removed % remaining.length, wasPlaying);
      return;
    }
    ++request.current;
    intentRef.current = false;
    audio.current?.pause();
    audio.current?.removeAttribute('src');
    audio.current?.load();
    indexRef.current = -1;
    setCurrentTrack(null);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    setLoading(false);
    setError(null);
  }, [select]);

  return { currentTrack, queue, playing, loading, currentTime, duration, volume, muted, mode, error,
    playTracks, toggle, next: () => next(false), previous, seek, setVolume, toggleMute, cycleMode,
    removeFromQueue, clearError: () => setError(null) };
}
