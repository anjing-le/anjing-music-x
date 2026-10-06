import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { fitWindow, getAppVersion, isDesktop, signIn } from "./desktop";
import PencilIcon from "./components/PencilIcon";
import SettingsDialog from "./components/SettingsDialog";
import MusicWorkspace from "./music/MusicWorkspace";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [version, setVersion] = useState("—");
  const passwordRef = useRef<HTMLInputElement>(null);
  const settingsTriggerRef = useRef<HTMLElement | null>(null);
  const windowFitQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    getAppVersion().then(value => { if (!cancelled) setVersion(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    windowFitQueueRef.current = windowFitQueueRef.current.catch(() => {}).then(async () => {
      if (!cancelled) await fitWindow(authenticated);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [authenticated]);
  useEffect(() => { if (!authenticated) passwordRef.current?.focus(); }, [authenticated]);

  const openSettings = useCallback(() => {
    settingsTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSettingsOpen(true);
  }, []);
  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(() => {
      if (!authenticated) passwordRef.current?.focus();
      else if (settingsTriggerRef.current?.isConnected) settingsTriggerRef.current.focus();
    });
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "," && !event.altKey && !settingsOpen) {
        event.preventDefault(); openSettings();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [openSettings, settingsOpen]);
  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (signingIn) return;
    setSigningIn(true); setLoginError("");
    try {
      if (await signIn(password)) {
        setAuthenticated(true); setPassword(""); setPasswordVisible(false);
      } else { setLoginError("密码不正确，请再试一次。"); passwordRef.current?.select(); }
    } catch { setLoginError("暂时无法进入，请重试。"); }
    finally { setSigningIn(false); }
  };
  const logout = () => { setAuthenticated(false); setSettingsOpen(false); setLoginError(""); };

  return (
    <div className={"app-shell " + (authenticated ? "music-shell" : "login-shell")}>
      {authenticated ? <MusicWorkspace onOpenSettings={openSettings} onLogout={logout} /> : (
        <main className="login-layout">
          <div className="login-brand"><span className="brand-mark wax-sage"><PencilIcon name="music" size={23} /></span><span>anjing music <small>x</small></span></div>
          <section className="login-card paper-card paper-outline" aria-labelledby="login-heading">
            <div className="login-heading"><p className="eyebrow">安静音乐</p><h1 id="login-heading">给音乐，留一点时间。</h1><p className="supporting-text">用密码打开你的音乐空间</p></div>
            <form onSubmit={handleSignIn}>
              <label htmlFor="password" className="field-label">密码</label>
              <div className={"password-field paper-outline " + (loginError ? "field-invalid" : "")}>
                <input ref={passwordRef} id="password" name="password" type={passwordVisible ? "text" : "password"}
                  value={password} autoComplete="off" required disabled={signingIn}
                  placeholder="输入密码" aria-invalid={Boolean(loginError)} aria-describedby="login-help login-error"
                  onChange={event => { setPassword(event.target.value); setLoginError(""); }} />
                <button type="button" className="icon-button" aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                  aria-pressed={passwordVisible} onClick={() => setPasswordVisible(value => !value)}>
                  <PencilIcon name={passwordVisible ? "eyeOff" : "eye"} size={19} />
                </button>
              </div>
              <p id="login-error" className="field-error" role="alert">{loginError || "\u00a0"}</p>
              <button className="button button-primary paper-outline login-submit" type="submit" disabled={signingIn}>
                <span>{signingIn ? "正在进入…" : "进入音乐"}</span><PencilIcon name="arrowRight" size={20} />
              </button>
            </form>
            <div id="login-help" className="login-help"><p>演示密码 <code>anjing</code></p><p>本地演示入口，暂无账户系统。</p></div>
          </section>
          <div className="login-bottom"><span>v{version}{!isDesktop && " · 浏览器预览"}</span><button type="button" className="text-button" onClick={openSettings}><PencilIcon name="settings" size={16} />设置</button></div>
        </main>
      )}
      <SettingsDialog open={settingsOpen} onClose={closeSettings} version={version} />
    </div>
  );
}
