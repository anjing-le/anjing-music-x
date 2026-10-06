import type { Track } from './catalog';

export const LOCAL_AUDIO_LIMIT = 500_000_000;
export const LOCAL_AUDIO_ACCEPT = '.wav,.flac,.mp3,.m4a,.ogg';
const databaseName = 'anjing-music-x-local-audio';
const storeName = 'tracks';
const extensionPattern = /\.(wav|flac|mp3|m4a|ogg)$/i;

export type LocalAudioRecord = {
  id: string;
  fingerprint: string;
  filename: string;
  title: string;
  duration: number;
  size: number;
  addedAt: number;
  blob: Blob;
};

function storageError(cause: unknown): Error {
  return new Error(cause instanceof DOMException && cause.name === 'QuotaExceededError'
    ? '本机可用存储空间不足，本次文件未导入，原文件未改动。'
    : '本地音乐缓存暂时无法读写，请重试。原文件未改动。');
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(databaseName, 1); }
    catch (cause) { reject(storageError(cause)); return; }
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(storeName, { keyPath: 'id' });
      store.createIndex('fingerprint', 'fingerprint', { unique: true });
    };
    request.onerror = () => { settled = true; reject(storageError(request.error)); };
    request.onblocked = () => { settled = true; reject(new Error('本地音乐缓存正被另一个窗口使用，请关闭该窗口后重试。')); };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

function validRecord(value: unknown): value is LocalAudioRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<LocalAudioRecord>;
  return typeof record.id === 'string' && record.id.startsWith('local-')
    && typeof record.fingerprint === 'string' && typeof record.filename === 'string'
    && typeof record.title === 'string' && typeof record.addedAt === 'number'
    && typeof record.duration === 'number' && Number.isFinite(record.duration) && record.duration > 0
    && record.blob instanceof Blob && record.size === record.blob.size;
}

export async function readLocalAudio(): Promise<LocalAudioRecord[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).getAll();
      let result: LocalAudioRecord[] = [];
      let failure: Error | null = null;
      request.onsuccess = () => {
        const records: unknown[] = request.result;
        if (!records.every(validRecord)) { failure = new Error('本地音乐缓存包含无法读取的记录，请保留原文件。'); transaction.abort(); return; }
        result = records.sort((a, b) => b.addedAt - a.addedAt);
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure ?? storageError(transaction.error));
    });
  } finally { database.close(); }
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => {
      clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', metadata);
      audio.removeEventListener('error', failed);
      audio.pause(); audio.removeAttribute('src'); audio.load();
      URL.revokeObjectURL(url);
    };
    const failed = () => {
      cleanup();
      reject(new Error(`无法读取“${file.name}”的音频信息，当前环境可能不支持其编码。本次选择的文件未导入。`));
    };
    const metadata = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) { failed(); return; }
      const duration = audio.duration;
      cleanup(); resolve(duration);
    };
    const timer = setTimeout(() => {
      cleanup(); reject(new Error(`读取“${file.name}”超时，本次选择的文件未导入，请重试。`));
    }, 15_000);
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', metadata);
    audio.addEventListener('error', failed);
    audio.src = url;
    audio.load();
  });
}

export async function importLocalAudio(files: File[]): Promise<{ inserted: LocalAudioRecord[]; duplicates: number }> {
  for (const file of files) {
    if (!extensionPattern.test(file.name)) throw new Error(`“${file.name}”格式不支持，请选择 WAV、FLAC、MP3、M4A 或 OGG。本次选择的文件未导入。`);
    if (!file.size) throw new Error(`“${file.name}”是空文件，本次选择的文件未导入。`);
    if (file.size > LOCAL_AUDIO_LIMIT) throw new Error('本地音乐缓存上限为 500 MB，所选文件过大。原文件未改动。');
  }
  const candidates: LocalAudioRecord[] = [];
  for (const file of files) {
    const duration = await readDuration(file);
    candidates.push({ id: `local-${crypto.randomUUID()}`, fingerprint: JSON.stringify([file.name, file.size, file.lastModified]),
      filename: file.name, title: file.name.replace(extensionPattern, '') || file.name,
      duration, size: file.size, addedAt: Date.now(), blob: file.slice(0, file.size, file.type) });
  }
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      let failure: Error | null = null;
      let inserted: LocalAudioRecord[] = [];
      let duplicates = 0;
      request.onsuccess = () => {
        const existing: unknown[] = request.result;
        if (!existing.every(validRecord)) { failure = new Error('本地音乐缓存暂时无法读取，未导入本次文件。'); transaction.abort(); return; }
        let bytes = existing.reduce((total, record) => total + record.size, 0);
        const known = new Set(existing.map((record) => record.fingerprint));
        for (const record of candidates) {
          if (known.has(record.fingerprint)) { duplicates += 1; continue; }
          bytes += record.size;
          if (bytes > LOCAL_AUDIO_LIMIT) {
            failure = new Error('本地音乐缓存已达 500 MB 上限，本次选择的文件未导入。已有音乐和原文件未删除。');
            transaction.abort(); return;
          }
          known.add(record.fingerprint);
          inserted.push(record);
          store.add(record);
        }
      };
      transaction.oncomplete = () => resolve({ inserted, duplicates });
      transaction.onabort = () => reject(failure ?? storageError(transaction.error));
    });
  } finally { database.close(); }
}

export function localAudioTrack(record: LocalAudioRecord): Track {
  return { id: record.id, title: record.title, artist: '本地音乐', album: '本地导入', duration: record.duration,
    cover: '/app-icon.png', src: URL.createObjectURL(record.blob), lyrics: [] };
}

export async function removeLocalAudio(id: string): Promise<void> {
  if (!id.startsWith('local-')) throw new Error('只能移除已导入的本地副本。');
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(storageError(transaction.error));
    });
  } finally { database.close(); }
}
