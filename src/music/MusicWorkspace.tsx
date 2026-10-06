import { useEffect, useMemo, useRef, useState } from "react";
import PencilIcon, { type IconName } from "../components/PencilIcon";
import Modal from "../components/Modal";
import { playlists, tracks as demoTracks, type Playlist, type Track } from "./catalog";
import { usePlayer, type Player } from "./usePlayer";
import { useLocalLibrary } from "./useLocalLibrary";
import { LOCAL_AUDIO_ACCEPT } from "./localLibrary";
import "./music.css";

type Section = "recommend" | "all" | "favorites" | "recent" | "playlist";
const storagePrefix = "anjing-music-x:music:";
const modeNames = { sequence: "顺序播放", "repeat-one": "单曲循环", shuffle: "随机播放" };
const modeIcons: Record<Player["mode"], IconName> = { sequence: "repeat", "repeat-one": "repeatOne", shuffle: "shuffle" };
const formatTime = (seconds: number) => {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function readIds(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storagePrefix + key) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length < 160))].slice(0, 100) : [];
  } catch { return []; }
}

function writeIds(key: string, ids: string[]) {
  try { localStorage.setItem(storagePrefix + key, JSON.stringify(ids.slice(0, 100))); } catch { /* Playback remains available if browser storage is unavailable. */ }
}

function TrackTable({ list, favorites, player, onFavorite, onRemoveLocal, busy }: {
  list: Track[];
  favorites: Set<string>;
  player: Player;
  onFavorite: (id: string) => void;
  onRemoveLocal: (track: Track) => void;
  busy: boolean;
}) {
  return <table className={`music-track-table ${list.some((track) => track.id.startsWith('local-')) ? 'music-has-local' : ''}`}>
    <colgroup><col className="number-column" /><col className="title-column" /><col className="artist-column" /><col className="album-column" /><col className="duration-column" /><col className="favorite-column" /></colgroup>
    <thead><tr><th scope="col"><span className="visually-hidden">序号</span></th><th scope="col">歌曲</th><th scope="col">歌手</th><th scope="col">专辑</th><th scope="col">时长</th><th scope="col"><span className="visually-hidden">收藏</span></th></tr></thead>
    <tbody>{list.map((track, index) => {
      const current = player.currentTrack?.id === track.id;
      const liked = favorites.has(track.id);
      return <tr key={track.id} data-current={current} onDoubleClick={(event) => {
        if (!(event.target instanceof Element && event.target.closest("button"))) player.playTracks(list, index);
      }}>
        <td className="track-number">{current && player.playing ? <PencilIcon name="volume" size={14} /> : String(index + 1).padStart(2, "0")}</td>
        <td><button type="button" className="track-song-button" aria-label={`播放 ${track.title}`} onClick={() => player.playTracks(list, index)}><span className="track-cover"><img src={track.cover} alt="" loading="lazy" /><span className="track-cover-play"><PencilIcon name="play" size={16} /></span></span><span className="track-title" title={track.title}>{track.title}</span></button></td>
        <td title={track.artist}>{track.artist}</td><td className="track-album" title={track.album}>{track.album}</td><td className="track-duration">{formatTime(track.duration)}</td>
        <td><div className="track-row-actions"><button type="button" className={`icon-button favorite-button ${liked ? "heart-active" : ""}`} aria-label={`${liked ? "取消喜欢" : "喜欢"} ${track.title}`} aria-pressed={liked} onClick={() => onFavorite(track.id)}><PencilIcon name="heart" size={17} /></button>{track.id.startsWith('local-') && <button type="button" className="icon-button local-remove-button" aria-label={`移除本地副本 ${track.title}`} title="移除本地副本" disabled={busy} onClick={() => onRemoveLocal(track)}><PencilIcon name="trash" size={15} /></button>}</div></td>
      </tr>;
    })}</tbody>
  </table>;
}

export default function MusicWorkspace({ onOpenSettings, onLogout }: { onOpenSettings: () => void; onLogout: () => void }) {
  const player = usePlayer();
  const localLibrary = useLocalLibrary();
  const tracks = useMemo(() => [...localLibrary.tracks, ...demoTracks], [localLibrary.tracks]);
  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const [section, setSection] = useState<Section>("recommend");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => readIds("favorites"));
  const [recent, setRecent] = useState<string[]>(() => readIds("recent"));
  const [queueOpen, setQueueOpen] = useState(false);
  const [nowOpen, setNowOpen] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<Track | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const queueButtonRef = useRef<HTMLButtonElement>(null);
  const nowButtonRef = useRef<HTMLButtonElement>(null);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const current = player.currentTrack;
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

  useEffect(() => { writeIds("favorites", favorites); }, [favorites]);
  useEffect(() => { writeIds("recent", recent); }, [recent]);
  useEffect(() => {
    if (player.playing && current) setRecent((ids) => [current.id, ...ids.filter((id) => id !== current.id)].slice(0, 100));
  }, [current?.id, player.playing]);
  useEffect(() => { if (!current) setNowOpen(false); }, [current?.id]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchRef.current?.focus(); searchRef.current?.select();
      } else if (event.key === "Escape") {
        if (query) { setQuery(""); searchRef.current?.focus(); }
        else if (queueOpen) { setQueueOpen(false); requestAnimationFrame(() => queueButtonRef.current?.focus()); }
        else if (nowOpen) { setNowOpen(false); requestAnimationFrame(() => nowButtonRef.current?.focus()); }
      } else if (event.code === "Space" && !(event.target instanceof Element && event.target.closest("button, input, textarea, select, a, [contenteditable=true]"))) {
        event.preventDefault();
        if (player.currentTrack) player.toggle(); else player.playTracks(tracks);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [query, queueOpen, nowOpen, player, tracks]);

  const toggleFavorite = (id: string) => setFavorites((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [id, ...ids].slice(0, 100));
  const navigate = (nextSection: Section) => { setSection(nextSection); setQuery(""); setNowOpen(false); };
  const openPlaylist = (playlist: Playlist) => { setSelectedPlaylist(playlist); navigate("playlist"); };
  const playlistTracks = selectedPlaylist?.trackIds.flatMap((id) => trackById.get(id) ? [trackById.get(id)!] : []) ?? [];
  const visibleTracks = normalizedQuery ? tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(normalizedQuery))
    : section === "favorites" ? favorites.flatMap((id) => trackById.get(id) ? [trackById.get(id)!] : [])
    : section === "recent" ? recent.flatMap((id) => trackById.get(id) ? [trackById.get(id)!] : [])
    : section === "playlist" ? playlistTracks : section === "recommend" ? demoTracks.slice(0, 4) : tracks;
  const pageTitle = normalizedQuery ? "搜索结果" : section === "favorites" ? "我喜欢" : section === "recent" ? "最近播放" : section === "playlist" ? selectedPlaylist?.title ?? "歌单" : section === "all" ? "全部歌曲" : "推荐";
  const activeLyric = current?.lyrics.reduce((index, line, next) => line.time <= player.currentTime ? next : index, -1) ?? -1;
  const seekDuration = Number.isFinite(player.duration) ? Math.max(0, player.duration) : 0;
  const seekTime = Math.min(seekDuration, Math.max(0, player.currentTime));

  return <div className="music-root" aria-label="安静音乐播放器">
    <aside className="music-sidebar">
      <div className="music-sidebar-brand"><span className="brand-mark wax-sage"><PencilIcon name="music" size={21} /></span><span>安静音乐 <small>x</small></span></div>
      <nav className="music-navigation" aria-label="音乐导航">
        {([
          ["recommend", "推荐", "star"], ["all", "全部歌曲", "library"],
          ["favorites", "我喜欢", "heart"], ["recent", "最近播放", "clock"],
        ] as const).map(([id, title, icon]) => <button key={id} type="button" className="music-nav-button" data-active={section === id && !nowOpen && !normalizedQuery} aria-current={section === id && !nowOpen && !normalizedQuery ? "page" : undefined} onClick={() => navigate(id)}><PencilIcon name={icon} size={19} /><span>{title}</span></button>)}
      </nav>
      <div className="sidebar-playlists"><p>精选歌单</p>{playlists.map((playlist) => <button key={playlist.id} type="button" className="sidebar-playlist-button" data-active={section === "playlist" && selectedPlaylist?.id === playlist.id && !nowOpen && !normalizedQuery} onClick={() => openPlaylist(playlist)}><img src={playlist.cover} alt="" /><span>{playlist.title}</span></button>)}</div>
      <div className="music-sidebar-bottom"><span className="demo-label">演示曲库</span><button type="button" className="icon-button" aria-label="退出登录" title="退出登录" disabled={localLibrary.importing || Boolean(localLibrary.removing)} onClick={onLogout}><PencilIcon name="logout" size={17} /></button></div>
    </aside>

    <div className="music-main">
      <header className="music-topbar">
        <div className="music-search paper-outline"><PencilIcon name="search" size={17} /><label className="visually-hidden" htmlFor="music-search">搜索歌曲、歌手或专辑</label><input ref={searchRef} id="music-search" value={query} placeholder="搜索歌曲、歌手、专辑" autoComplete="off" onChange={(event) => { setQuery(event.target.value); setNowOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape" && query) { event.stopPropagation(); setQuery(""); } }} />{query ? <button type="button" className="icon-button" aria-label="清空搜索" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><PencilIcon name="close" size={15} /></button> : <kbd title={`${modifier} K 搜索`}>{modifier} K</kbd>}</div>
        <div className="music-topbar-actions"><input ref={importInputRef} className="visually-hidden" type="file" tabIndex={-1} accept={LOCAL_AUDIO_ACCEPT} multiple aria-label="导入本地音乐文件" onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (!files.length) return;
          navigate('all');
          void localLibrary.importFiles(files);
        }} /><button type="button" className="button button-quiet paper-outline music-import-button" title="WAV、FLAC、MP3、M4A、OGG · 本机缓存上限 500 MB" disabled={localLibrary.loading || localLibrary.importing || Boolean(localLibrary.removing)} onClick={() => importInputRef.current?.click()}><PencilIcon name="music" size={16} />{localLibrary.importing ? '正在导入…' : '导入本地音乐'}</button><button type="button" className="icon-button music-settings" aria-label="打开设置" title="设置" onClick={onOpenSettings}><PencilIcon name="settings" size={20} /></button></div>
      </header>
      {(localLibrary.notice || localLibrary.error) && <div className={`music-import-notice ${localLibrary.error ? 'music-import-error' : ''}`} role={localLibrary.error ? 'alert' : 'status'}><span>{localLibrary.error || localLibrary.notice}</span><button type="button" className="icon-button" aria-label="关闭导入提示" onClick={localLibrary.clearNotice}><PencilIcon name="close" size={15} /></button></div>}
      <main className={`music-content ${nowOpen && !normalizedQuery ? "music-now-content" : ""}`}>
        {nowOpen && current && !normalizedQuery ? <section className="now-playing-page" aria-labelledby="now-heading">
          <button type="button" className="text-button now-return" onClick={() => { setNowOpen(false); requestAnimationFrame(() => nowButtonRef.current?.focus()); }}><PencilIcon name="arrowLeft" size={17} />返回</button>
          <div className="now-layout"><div className="now-album"><img className="now-cover paper-outline" src={current.cover} alt={`${current.title} 封面`} /><h1 id="now-heading">{current.title}</h1><p>{current.artist}</p><p className="now-album-name">{current.album}</p><button type="button" className={`text-button ${favoriteSet.has(current.id) ? "heart-active" : ""}`} aria-label={`${favoriteSet.has(current.id) ? "取消喜欢" : "喜欢"} ${current.title}`} aria-pressed={favoriteSet.has(current.id)} onClick={() => toggleFavorite(current.id)}><PencilIcon name="heart" size={18} />{favoriteSet.has(current.id) ? "已喜欢" : "喜欢"}</button></div>
            <div className="now-lyrics" aria-label="歌词">{current.lyrics.length ? current.lyrics.map((line, index) => <button type="button" key={`${index}-${line.time}`} data-active={index === activeLyric} onClick={() => player.seek(line.time)} aria-label={`跳到 ${formatTime(line.time)} ${line.text}`}><span>{line.text}</span></button>) : <p>暂无歌词</p>}</div></div>
        </section> : <>
          {section === "playlist" && selectedPlaylist && !normalizedQuery ? <section className="playlist-detail-heading"><img src={selectedPlaylist.cover} alt="" className="playlist-detail-cover" /><div><button type="button" className="text-button" onClick={() => navigate("recommend")}><PencilIcon name="arrowLeft" size={15} />返回推荐</button><h1>{selectedPlaylist.title}</h1><p>{selectedPlaylist.description}</p><span>{playlistTracks.length} 首歌曲</span><button type="button" className="button button-primary paper-outline music-play-all" disabled={!visibleTracks.length} onClick={() => player.playTracks(visibleTracks)}><PencilIcon name="play" size={16} />播放全部</button></div></section>
            : <div className="music-page-heading"><div><h1>{pageTitle}</h1>{section !== "recommend" || normalizedQuery ? <p>{normalizedQuery ? `“${query.trim()}” · ` : ""}{visibleTracks.length} 首歌曲</p> : null}</div>{(section !== "recommend" || normalizedQuery) && <button type="button" className="button button-primary paper-outline music-play-all" disabled={!visibleTracks.length} onClick={() => player.playTracks(visibleTracks)}><PencilIcon name="play" size={16} />播放全部</button>}</div>}
          {section === "recommend" && !normalizedQuery && <section className="recommend-playlists" aria-labelledby="playlist-section-heading"><h2 id="playlist-section-heading">为你精选</h2><div className="playlist-card-grid">{playlists.map((playlist) => <button type="button" className="playlist-card" key={playlist.id} aria-label={`打开歌单 ${playlist.title}`} onClick={() => openPlaylist(playlist)}><span className="playlist-card-cover paper-outline"><img src={playlist.cover} alt="" /><span className="playlist-open-icon wax-yellow"><PencilIcon name="arrowRight" size={18} /></span></span><span className="playlist-card-title">{playlist.title}</span><span className="playlist-card-description">{playlist.description}</span></button>)}</div></section>}
          {visibleTracks.length ? <section className="music-songs" aria-label={section === "recommend" && !normalizedQuery ? "精选歌曲" : pageTitle}>{section === "recommend" && !normalizedQuery && <div className="music-section-heading"><h2>精选歌曲</h2><button type="button" className="button button-primary paper-outline music-play-all" onClick={() => player.playTracks(visibleTracks)}><PencilIcon name="play" size={16} />播放全部</button></div>}<TrackTable list={visibleTracks} favorites={favoriteSet} player={player} onFavorite={toggleFavorite} onRemoveLocal={setRemoveCandidate} busy={localLibrary.importing || Boolean(localLibrary.removing)} /></section>
            : <div className="music-list-empty"><PencilIcon name={section === "favorites" ? "heart" : section === "recent" ? "clock" : "search"} size={32} /><h2>{normalizedQuery ? "没有找到这首歌" : section === "favorites" ? "还没有喜欢的歌曲" : "还没有播放记录"}</h2><p>{normalizedQuery ? "换个歌名、歌手或专辑试试。" : section === "favorites" ? "点歌曲旁的心形，留下一首喜欢。" : "播放过的歌曲会出现在这里。"}</p><button type="button" className="button button-quiet paper-outline" onClick={() => navigate("all")}>浏览全部歌曲</button></div>}
        </>}
      </main>
    </div>

    {queueOpen && <aside className="music-queue paper-card paper-outline" role="dialog" aria-label="播放队列"><header><div><h2>播放队列</h2><span>{player.queue.length} 首歌曲</span></div><button type="button" className="icon-button" aria-label="关闭播放队列" onClick={() => { setQueueOpen(false); requestAnimationFrame(() => queueButtonRef.current?.focus()); }}><PencilIcon name="close" size={18} /></button></header><div className="queue-list">{player.queue.length ? player.queue.map((track, index) => <div className="queue-row" data-current={current?.id === track.id} key={track.id}><button type="button" className="queue-song" aria-label={`播放队列歌曲 ${track.title}`} onClick={() => player.playTracks(player.queue, index)}><img src={track.cover} alt="" /><span><strong>{track.title}</strong><small>{track.artist}</small></span></button><button type="button" className="icon-button" aria-label={`从队列移除 ${track.title}`} onClick={() => player.removeFromQueue(track.id)}><PencilIcon name="close" size={14} /></button></div>) : <p className="queue-empty">播放一首歌，从这里开始。</p>}</div></aside>}

    {player.error && <div className="music-playback-error paper-outline" role="alert"><span>{player.error}</span><button type="button" className="text-button" onClick={() => current ? player.toggle() : player.playTracks(tracks)}>重试</button><button type="button" className="icon-button" aria-label="关闭播放错误提示" onClick={player.clearError}><PencilIcon name="close" size={15} /></button></div>}
    {removeCandidate && <Modal title="移除本地副本？" className="confirm-modal" onClose={() => { if (!localLibrary.removing) setRemoveCandidate(null); }}><p className="confirmation-copy">移除“{removeCandidate.title}”在此客户端的音频缓存及收藏、最近播放记录，原文件与云盘不受影响。</p><div className="confirmation-actions"><button type="button" className="button button-quiet paper-outline" disabled={Boolean(localLibrary.removing)} onClick={() => setRemoveCandidate(null)}>取消</button><button type="button" className="button button-danger paper-outline" disabled={Boolean(localLibrary.removing)} onClick={async () => {
      const id = removeCandidate.id;
      await localLibrary.removeTrack(id, () => { player.removeFromQueue(id); setFavorites((ids) => ids.filter((item) => item !== id)); setRecent((ids) => ids.filter((item) => item !== id)); });
      setRemoveCandidate(null);
    }}>{localLibrary.removing ? '正在移除…' : '移除本地副本'}</button></div></Modal>}

    <footer className="music-player pencil-divider" aria-label="播放器">
      <div className="player-current"><button ref={nowButtonRef} type="button" className="player-current-button" aria-label={current ? `打开正在播放 ${current.title}` : "尚未选择歌曲"} disabled={!current} onClick={() => { setNowOpen((open) => !open); setQuery(""); }}><span className="player-cover">{current ? <img src={current.cover} alt="" /> : <PencilIcon name="music" size={26} />}<span className="player-cover-expand"><PencilIcon name="chevronUp" size={18} /></span></span><span className="player-current-copy"><strong>{current?.title ?? "选择一首歌"}</strong><small>{current?.artist ?? "让旋律慢慢响起"}</small></span></button><button type="button" className={`icon-button ${current && favoriteSet.has(current.id) ? "heart-active" : ""}`} aria-label={current ? `${favoriteSet.has(current.id) ? "取消喜欢" : "喜欢"} ${current.title}` : "喜欢当前歌曲"} disabled={!current} aria-pressed={Boolean(current && favoriteSet.has(current.id))} onClick={() => current && toggleFavorite(current.id)}><PencilIcon name="heart" size={19} /></button></div>
      <div className="player-center"><div className="player-transport"><button type="button" className="icon-button player-mode" aria-label={`${modeNames[player.mode]}，切换播放模式`} title={modeNames[player.mode]} onClick={player.cycleMode}><PencilIcon name={modeIcons[player.mode]} size={18} /></button><button type="button" className="icon-button" aria-label="上一首" disabled={!current} onClick={player.previous}><PencilIcon name="previous" size={22} /></button><button type="button" className="player-play-button wax-yellow" aria-label={player.playing ? "暂停播放" : player.loading ? "正在加载，可点击暂停" : "播放音乐"} aria-busy={player.loading} onClick={() => current ? player.toggle() : player.playTracks(tracks)}><PencilIcon name={player.playing || player.loading ? "pause" : "play"} size={24} /></button><button type="button" className="icon-button" aria-label="下一首" disabled={!current} onClick={player.next}><PencilIcon name="next" size={22} /></button><div className="player-volume"><button type="button" className="icon-button" aria-label={player.muted ? "取消静音" : "静音"} aria-pressed={player.muted} onClick={player.toggleMute}><PencilIcon name={player.muted || player.volume === 0 ? "volumeOff" : "volume"} size={18} /></button><input type="range" min={0} max={1} step={0.01} value={player.muted ? 0 : player.volume} aria-label="音量" style={{ "--range-fill": `${(player.muted ? 0 : player.volume) * 100}%` } as React.CSSProperties} onChange={(event) => { const value = Number(event.target.value); player.setVolume(value); if (value > 0 && player.muted) player.toggleMute(); }} /></div></div>
        <div className="player-progress"><time>{formatTime(player.currentTime)}</time><input type="range" aria-label="播放进度" aria-valuetext={`${formatTime(seekTime)} / ${formatTime(seekDuration)}`} min={0} max={seekDuration || 1} step={0.1} value={seekTime} disabled={!current || seekDuration <= 0} style={{ "--range-fill": `${seekDuration ? seekTime / seekDuration * 100 : 0}%` } as React.CSSProperties} onChange={(event) => player.seek(Number(event.target.value))} /><time>{formatTime(seekDuration)}</time></div>
      </div>
      <div className="player-extras"><button type="button" className="icon-button" aria-label="打开歌词" title="歌词" aria-pressed={nowOpen} disabled={!current} onClick={() => { setNowOpen((open) => !open); setQuery(""); }}><PencilIcon name="lyrics" size={20} /></button><button ref={queueButtonRef} type="button" className="icon-button" aria-label="打开播放队列" title="播放队列" aria-pressed={queueOpen} onClick={() => setQueueOpen((open) => !open)}><PencilIcon name="queue" size={21} /></button></div>
    </footer>
  </div>;
}
