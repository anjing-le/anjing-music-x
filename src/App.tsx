import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { checkForUpdate, fitWindow, getAppVersion, isDesktop, relaunchApp, signIn } from "./desktop";
import Modal from "./components/Modal";
import PencilIcon from "./components/PencilIcon";
import "./styles.css";

type UpdateState = "idle" | "checking" | "current" | "available" | "downloading" | "installing" | "ready" | "failed";
type Confirmation = "clear" | "logout" | "restart" | "install" | null;

async function closeUpdate(resource: Update | null) {
  if (!resource) return;
  try { await resource.close(); } catch { /* An installed update may already have been released by the native side. */ }
}

const readableBytes = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [version, setVersion] = useState("—");
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [downloaded, setDownloaded] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState<number | undefined>();
  const [toast, setToast] = useState("");
  const [restarting, setRestarting] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const openNoteButtonRef = useRef<HTMLButtonElement>(null);
  const settingsTriggerRef = useRef<HTMLElement | null>(null);
  const updateResourceRef = useRef<Update | null>(null);
  const updateRequestRef = useRef(0);
  const updateBusyRef = useRef(false);
  const installingRef = useRef(false);
  const mountedRef = useRef(false);
  const windowFitQueueRef = useRef<Promise<void>>(Promise.resolve());
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const updateBusy = ["checking", "downloading", "installing"].includes(updateState);

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      updateRequestRef.current += 1;
      if (!installingRef.current) {
        const resource = updateResourceRef.current;
        updateResourceRef.current = null;
        void closeUpdate(resource);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.title = "安静音乐 · anjing music x";
    getAppVersion().then((result) => { if (!cancelled) setVersion(result); }).catch(() => { if (!cancelled) setVersion("未知"); });
    return () => { cancelled = true; if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    windowFitQueueRef.current = windowFitQueueRef.current.catch(() => {}).then(async () => {
      if (!cancelled) await fitWindow(authenticated);
    }).catch(() => { if (!cancelled) notify("窗口尺寸未能调整，可以手动缩放。"); });
    return () => { cancelled = true; };
  }, [authenticated, notify]);

  useEffect(() => {
    if (!authenticated) passwordRef.current?.focus();
  }, [authenticated]);

  useEffect(() => {
    if (noteOpen) noteRef.current?.focus();
  }, [noteOpen]);

  const openSettings = useCallback((trigger?: HTMLElement | null) => {
    settingsTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSettingsOpen(true);
  }, []);

  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(() => {
      if (!authenticated) passwordRef.current?.focus();
      else if (settingsTriggerRef.current?.isConnected) settingsTriggerRef.current.focus();
    });
  };

  const openNote = () => {
    setNoteOpen(true);
    requestAnimationFrame(() => noteRef.current?.focus());
  };

  const closeNote = () => {
    setNoteOpen(false);
    requestAnimationFrame(() => openNoteButtonRef.current?.focus());
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key === "," && !confirmation) {
        event.preventDefault();
        openSettings();
      }
      if (authenticated && event.key.toLowerCase() === "n" && !settingsOpen && !confirmation) {
        event.preventDefault();
        setNoteOpen(true);
        noteRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [authenticated, settingsOpen, confirmation, openSettings]);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    setLoginError("");
    try {
      if (await signIn(password)) {
        setAuthenticated(true);
        setPassword("");
        setPasswordVisible(false);
      } else {
        setLoginError("密码不正确，请再试一次。");
        passwordRef.current?.select();
      }
    } catch {
      setLoginError("暂时无法进入，请重试。");
    } finally {
      setSigningIn(false);
    }
  };

  const handleCheck = async () => {
    if (updateBusyRef.current) return;
    updateBusyRef.current = true;
    const request = ++updateRequestRef.current;
    const previous = updateResourceRef.current;
    updateResourceRef.current = null;
    setUpdateState("checking");
    setUpdateError("");
    setUpdate(null);
    try {
      await closeUpdate(previous);
      const result = await checkForUpdate();
      if (!mountedRef.current || request !== updateRequestRef.current) {
        await closeUpdate(result);
        return;
      }
      updateResourceRef.current = result;
      setUpdate(result);
      setUpdateState(result ? "available" : "current");
    } catch (error) {
      if (!mountedRef.current || request !== updateRequestRef.current) return;
      setUpdateError(error instanceof Error ? error.message : "无法连接更新服务，请稍后重试。");
      setUpdateState("failed");
    } finally {
      if (request === updateRequestRef.current) updateBusyRef.current = false;
    }
  };

  const handleInstall = async () => {
    const resource = updateResourceRef.current;
    if (!resource || updateBusyRef.current) return;
    updateBusyRef.current = true;
    installingRef.current = true;
    const request = ++updateRequestRef.current;
    setDownloaded(0);
    setDownloadTotal(undefined);
    setUpdateError("");
    setUpdateState("downloading");
    try {
      await resource.downloadAndInstall((event) => {
        if (!mountedRef.current || request !== updateRequestRef.current) return;
        if (event.event === "Started") setDownloadTotal(event.data.contentLength);
        else if (event.event === "Progress") setDownloaded((total) => total + event.data.chunkLength);
        else if (event.event === "Finished") setUpdateState("installing");
      }, { timeout: 120_000 });
      if (mountedRef.current && request === updateRequestRef.current) setUpdateState("ready");
    } catch (error) {
      if (!mountedRef.current || request !== updateRequestRef.current) return;
      setUpdateError(error instanceof Error ? error.message : "更新未能完成，请重试。");
      setUpdateState("failed");
    } finally {
      installingRef.current = false;
      if (updateResourceRef.current === resource) updateResourceRef.current = null;
      await closeUpdate(resource);
      if (request === updateRequestRef.current) updateBusyRef.current = false;
    }
  };

  const handleRestart = async () => {
    if (restarting) return;
    setRestarting(true);
    try { await relaunchApp(); }
    catch (error) {
      setUpdateError(error instanceof Error ? error.message : "未能重启，请关闭后重新打开客户端。");
      setUpdateState("failed");
    } finally { setRestarting(false); }
  };

  const logout = () => {
    setNote("");
    setNoteOpen(false);
    setAuthenticated(false);
    setConfirmation(null);
    setSettingsOpen(false);
    setLoginError("");
    setToast("");
  };

  const copyNote = async () => {
    try { await navigator.clipboard.writeText(note); notify("便笺已复制。"); }
    catch { notify("复制失败，请选中文字后复制。"); }
  };

  const updateHeading: Record<UpdateState, string> = {
    idle: isDesktop ? "保持一点新鲜" : "桌面客户端内可用",
    checking: "正在检查更新…",
    current: "已是最新版本",
    available: `发现新版本 ${update?.version ?? ""}`,
    downloading: "正在下载更新…",
    installing: "正在安装更新…",
    ready: "更新已安装，重启后生效",
    failed: "更新暂时未完成",
  };
  const progress = downloadTotal ? Math.min(100, Math.round(downloaded / downloadTotal * 100)) : undefined;

  return (
    <div className={`app-shell ${authenticated ? "workspace-shell" : "login-shell"}`}>
      {!authenticated ? (
        <main className="login-layout">
          <div className="login-brand"><span className="brand-mark wax-sage"><PencilIcon name="music" size={23} /></span><span>anjing music <small>x</small></span></div>
          <section className="login-card paper-card paper-outline" aria-labelledby="login-heading">
            <div className="login-heading"><p className="eyebrow">安静音乐</p><h1 id="login-heading">给音乐，留一点时间。</h1><p className="supporting-text">用密码打开你的工作台</p></div>
            <form onSubmit={handleSignIn}>
              <label htmlFor="password" className="field-label">密码</label>
              <div className={`password-field paper-outline ${loginError ? "field-invalid" : ""}`}>
                <input ref={passwordRef} id="password" name="password" type={passwordVisible ? "text" : "password"}
                  value={password} autoComplete="off" required disabled={signingIn}
                  placeholder="输入密码" aria-invalid={Boolean(loginError)} aria-describedby="login-help login-error"
                  onChange={(event) => { setPassword(event.target.value); setLoginError(""); }} />
                <button type="button" className="icon-button" aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                  aria-pressed={passwordVisible} onClick={() => setPasswordVisible((shown) => !shown)}>
                  <PencilIcon name={passwordVisible ? "eyeOff" : "eye"} size={19} />
                </button>
              </div>
              <p id="login-error" className="field-error" role="alert">{loginError || "\u00a0"}</p>
              <button className="button button-primary paper-outline login-submit" type="submit" disabled={signingIn}>
                <span>{signingIn ? "正在进入…" : "进入工作台"}</span><PencilIcon name="arrowRight" size={20} />
              </button>
            </form>
            <div id="login-help" className="login-help"><p>演示密码 <code>anjing</code></p><p>本地演示入口，暂无账户系统。</p></div>
          </section>
          <div className="login-bottom"><span>v{version}{!isDesktop && " · 浏览器预览"}</span><button type="button" className="text-button" onClick={(event) => openSettings(event.currentTarget)}><PencilIcon name="settings" size={16} />设置</button></div>
        </main>
      ) : (
        <>
          <header className="app-toolbar pencil-divider">
            <div className="app-brand"><span className="brand-mark wax-sage"><PencilIcon name="music" size={21} /></span><span className="brand-name">安静音乐 <small>x</small></span></div>
            <div className="toolbar-actions"><span className="session-status"><span />本地工作台</span><button type="button" className="icon-button" aria-label="打开设置" title={`设置 (${modifier} ,)`} onClick={(event) => openSettings(event.currentTarget)}><PencilIcon name="settings" /></button></div>
          </header>
          <main className="workspace-main">
            <div className="workspace-heading"><div><p className="eyebrow">ANJING MUSIC</p><h1>工作台</h1></div><button ref={openNoteButtonRef} type="button" className="button button-quiet paper-outline" onClick={openNote}><PencilIcon name="notebook" size={18} /><span>{note ? "打开便笺" : "写一张便笺"}</span></button></div>
            {noteOpen ? (
              <section className="note-card paper-card paper-outline" aria-labelledby="note-heading">
                <div className="note-toolbar pencil-divider"><div className="note-title"><PencilIcon name="pencil" size={19} /><h2 id="note-heading">随手记</h2></div><button type="button" className="icon-button" aria-label="收起便笺" onClick={closeNote}><PencilIcon name="close" size={18} /></button></div>
                <label htmlFor="note" className="visually-hidden">便笺内容</label>
                <textarea ref={noteRef} id="note" value={note} placeholder="写下一点想法…" spellCheck={false} onChange={(event) => setNote(event.target.value)} />
                <div className="note-footer pencil-divider"><span className="note-count">{[...note].length} 字</span><div><button type="button" className="text-button" disabled={!note} onClick={copyNote}><PencilIcon name="copy" size={17} />复制</button><button type="button" className="text-button danger-text" disabled={!note} onClick={() => setConfirmation("clear")}><PencilIcon name="trash" size={17} />清空</button></div></div>
              </section>
            ) : (
              <section className="empty-workspace paper-card paper-outline" aria-labelledby="empty-heading"><div className="empty-mark wax-yellow"><PencilIcon name="pencil" size={32} /></div><h2 id="empty-heading">从一张白纸开始</h2><p>{note ? "你留下的想法，还在这里。" : "先留下一点想法。"}</p><button type="button" className="button button-primary paper-outline" onClick={openNote}><PencilIcon name={note ? "notebook" : "pencil"} size={18} />{note ? "继续写便笺" : "写一张便笺"}</button></section>
            )}
            <div className="workspace-footnote"><span><PencilIcon name="info" size={14} />便笺仅在本次会话中保留</span><span className="shortcut-hint"><kbd>{modifier}</kbd><kbd>N</kbd><span>打开便笺</span></span></div>
          </main>
          <footer className="app-footer"><span>v{version}{!isDesktop && " · 浏览器预览"}</span><button type="button" className="text-button" onClick={() => note ? setConfirmation("logout") : logout()}><PencilIcon name="logout" size={16} />退出</button></footer>
        </>
      )}

      {settingsOpen && <Modal title="设置" eyebrow="留一点空间给自己" onClose={closeSettings} className="settings-modal">
        <section className="settings-section" aria-labelledby="update-heading">
          <div className="settings-section-label"><h3 id="update-heading">应用更新</h3><span className="version-label">v{version}</span></div>
          <div className={`update-card paper-outline ${updateState === "failed" ? "update-failed" : ""}`} aria-busy={updateBusy}>
            <div className={`update-icon ${updateState === "ready" || updateState === "current" ? "wax-sage" : "wax-yellow"}`}><PencilIcon name={updateState === "ready" || updateState === "current" ? "check" : updateState === "available" || updateState === "downloading" ? "download" : "refresh"} size={23} /></div>
            <div className="update-copy"><p className="update-title" role="status">{updateHeading[updateState]}</p><p className="update-detail">{updateState === "failed" ? updateError : updateState === "downloading" ? `${readableBytes(downloaded)}${downloadTotal ? ` / ${readableBytes(downloadTotal)}` : ""}` : updateState === "installing" ? "完成后可重启客户端。" : updateState === "ready" ? "重启会结束当前会话。" : !isDesktop ? "在 macOS 或 Windows 客户端中检查更新。" : "从 GitHub Releases 获取更新。"}</p></div>
            {(updateState === "downloading" || updateState === "installing") && <div className="update-progress"><progress aria-label={updateState === "installing" ? "正在安装更新" : "下载更新进度"} max={100} value={updateState === "installing" ? 100 : progress} /><span>{updateState === "installing" ? "安装中" : progress === undefined ? "下载中" : `${progress}%`}</span></div>}
          </div>
          {update?.body && <details className="release-notes"><summary>更新说明</summary><p>{update.body}</p></details>}
          <div className="update-actions">
            {updateState === "available" ? <button type="button" className="button button-primary paper-outline" onClick={() => { if (note) setConfirmation("install"); else void handleInstall(); }}><PencilIcon name="download" size={18} />下载并安装</button> : updateState === "ready" ? <button type="button" className="button button-primary paper-outline" disabled={restarting} onClick={() => { if (note) setConfirmation("restart"); else void handleRestart(); }}><PencilIcon name="restart" size={18} />{restarting ? "正在重启…" : "重启并完成更新"}</button> : <button type="button" className="button button-quiet paper-outline" onClick={handleCheck} disabled={updateBusy || !isDesktop}><PencilIcon name="refresh" size={18} />{updateBusy ? "请稍候…" : updateState === "failed" ? "重新检查" : "检查更新"}</button>}
          </div>
          {!isDesktop && <p className="preview-note"><PencilIcon name="info" size={14} />更新检查与安装仅在桌面客户端中可用。</p>}
        </section>
        <section className="settings-about pencil-divider"><span className="brand-name">安静音乐 <small>x</small></span><span>慢慢来，也很好。</span></section>
      </Modal>}

      {confirmation && <Modal title={confirmation === "clear" ? "清空这张便笺？" : confirmation === "install" ? "开始安装更新？" : confirmation === "restart" ? "重启客户端？" : "退出工作台？"} onClose={() => setConfirmation(null)} className="confirm-modal">
        <p className="confirmation-copy">{confirmation === "clear" ? "便笺内容将被清空，无法恢复。" : confirmation === "install" ? "更新可能结束当前会话，便笺不会保留。可以先取消并复制内容。" : "当前便笺会随会话结束而清除。可以先取消并复制内容。"}</p>
        <div className="confirmation-actions"><button type="button" className="button button-quiet paper-outline" onClick={() => setConfirmation(null)}>取消</button><button type="button" className={`button paper-outline ${confirmation === "restart" || confirmation === "install" ? "button-primary" : "button-danger"}`} onClick={() => {
          if (confirmation === "clear") { setNote(""); setConfirmation(null); requestAnimationFrame(() => noteRef.current?.focus()); }
          else if (confirmation === "install") { setConfirmation(null); void handleInstall(); }
          else if (confirmation === "restart") { setConfirmation(null); void handleRestart(); }
          else logout();
        }}>{confirmation === "clear" ? "清空便笺" : confirmation === "install" ? "下载并安装" : confirmation === "restart" ? "重启" : "退出"}</button></div>
      </Modal>}
      <div className={`toast paper-outline ${toast ? "toast-visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
