import { useEffect, useRef, useState } from 'react';
import type { Track } from './catalog';
import { importLocalAudio, localAudioTrack, readLocalAudio, removeLocalAudio } from './localLibrary';

export function useLocalLibrary() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const busy = useRef(false);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const current = ++generation.current;
    readLocalAudio().then((records) => {
      if (current !== generation.current) return;
      const restored = records.map(localAudioTrack);
      for (const track of restored) urls.current.add(track.src);
      setTracks(restored);
    }).catch((cause) => {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : '本地音乐缓存暂时无法读取。');
    }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => {
      ++generation.current;
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    };
  }, []);

  const importFiles = async (files: File[]) => {
    if (!files.length || busy.current || loading) return;
    const current = generation.current;
    busy.current = true;
    setImporting(true); setError(''); setNotice('');
    try {
      const result = await importLocalAudio(files);
      if (current !== generation.current) return;
      const added = result.inserted.map(localAudioTrack);
      for (const track of added) urls.current.add(track.src);
      setTracks((existing) => [...added.reverse(), ...existing]);
      setNotice(added.length ? `已导入 ${added.length} 首本地音乐${result.duplicates ? `，跳过 ${result.duplicates} 个已有文件` : ''}。` : '所选文件已在本地曲库中。');
      // Request persistent origin storage where the platform supports it; a
      // refusal does not turn a successful IndexedDB commit into an import error.
      void navigator.storage?.persist?.().catch(() => {});
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : '导入失败，原文件未改动。');
    } finally {
      busy.current = false;
      if (current === generation.current) setImporting(false);
    }
  };

  const removeTrack = async (id: string, beforeRelease: () => void): Promise<boolean> => {
    if (busy.current || loading) return false;
    const current = generation.current;
    const track = tracks.find((item) => item.id === id);
    if (!track) return false;
    busy.current = true; setRemoving(id); setError(''); setNotice('');
    try {
      await removeLocalAudio(id);
      if (current !== generation.current) return false;
      // Stop/switch the live media element before releasing its Blob URL.
      beforeRelease();
      setTracks((existing) => existing.filter((item) => item.id !== id));
      URL.revokeObjectURL(track.src); urls.current.delete(track.src);
      setNotice('已移除本地副本。');
      return true;
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : '未能移除本地副本，请重试。');
      return false;
    } finally {
      busy.current = false;
      if (current === generation.current) setRemoving(null);
    }
  };

  return { tracks, loading, importing, removing, notice, error, importFiles, removeTrack, clearNotice: () => { setNotice(''); setError(''); } };
}
