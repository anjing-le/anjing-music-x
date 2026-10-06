import { useEffect, useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { checkForUpdate, isDesktop, relaunchApp } from "../desktop";
import Modal from "./Modal";
import PencilIcon from "./PencilIcon";

type UpdateState = "idle" | "checking" | "current" | "available" | "downloading" | "installing" | "ready" | "failed";

async function closeUpdate(resource: Update | null) {
  if (!resource) return;
  try { await resource.close(); } catch { /* An installed update may already have been released by the native side. */ }
}

const readableBytes = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function SettingsDialog({open, onClose, version}: {open: boolean; onClose: () => void; version: string}) {
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [downloaded, setDownloaded] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState<number | undefined>();
  const [restarting, setRestarting] = useState(false);
  const updateResourceRef = useRef<Update | null>(null);
  const updateRequestRef = useRef(0);
  const updateBusyRef = useRef(false);
  const installingRef = useRef(false);
  const mountedRef = useRef(false);
  const updateBusy = ["checking", "downloading", "installing"].includes(updateState);

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

  return (<>
      {open && <Modal title="设置" eyebrow="留一点空间给自己" onClose={onClose} className="settings-modal">
        <section className="settings-section" aria-labelledby="update-heading">
          <div className="settings-section-label"><h3 id="update-heading">应用更新</h3><span className="version-label">v{version}</span></div>
          <div className={`update-card paper-outline ${updateState === "failed" ? "update-failed" : ""}`} aria-busy={updateBusy}>
            <div className={`update-icon ${updateState === "ready" || updateState === "current" ? "wax-sage" : "wax-yellow"}`}><PencilIcon name={updateState === "ready" || updateState === "current" ? "check" : updateState === "available" || updateState === "downloading" ? "download" : "refresh"} size={23} /></div>
            <div className="update-copy"><p className="update-title" role="status">{updateHeading[updateState]}</p><p className="update-detail">{updateState === "failed" ? updateError : updateState === "downloading" ? `${readableBytes(downloaded)}${downloadTotal ? ` / ${readableBytes(downloadTotal)}` : ""}` : updateState === "installing" ? "完成后可重启客户端。" : updateState === "ready" ? "重启会结束当前会话。" : !isDesktop ? "在 macOS 或 Windows 客户端中检查更新。" : "从 GitHub Releases 获取更新。"}</p></div>
            {(updateState === "downloading" || updateState === "installing") && <div className="update-progress"><progress aria-label={updateState === "installing" ? "正在安装更新" : "下载更新进度"} max={100} value={updateState === "installing" ? 100 : progress} /><span>{updateState === "installing" ? "安装中" : progress === undefined ? "下载中" : `${progress}%`}</span></div>}
          </div>
          {update?.body && <details className="release-notes"><summary>更新说明</summary><p>{update.body}</p></details>}
          <div className="update-actions">
            {updateState === "available" ? <button type="button" className="button button-primary paper-outline" onClick={() => { void handleInstall(); }}><PencilIcon name="download" size={18} />下载并安装</button> : updateState === "ready" ? <button type="button" className="button button-primary paper-outline" disabled={restarting} onClick={() => { void handleRestart(); }}><PencilIcon name="restart" size={18} />{restarting ? "正在重启…" : "重启并完成更新"}</button> : <button type="button" className="button button-quiet paper-outline" onClick={handleCheck} disabled={updateBusy || !isDesktop}><PencilIcon name="refresh" size={18} />{updateBusy ? "请稍候…" : updateState === "failed" ? "重新检查" : "检查更新"}</button>}
          </div>
          {!isDesktop && <p className="preview-note"><PencilIcon name="info" size={14} />更新检查与安装仅在桌面客户端中可用。</p>}
        </section>
        <section className="settings-about pencil-divider"><span className="brand-name">安静音乐 <small>x</small></span><span>慢慢来，也很好。</span></section>
      </Modal>}

  </>);
}
