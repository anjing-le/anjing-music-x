import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { fitWindow, getAppVersion, signIn } from "./desktop";
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
      } else { setLoginError("密码不正确"); passwordRef.current?.select(); }
    } catch { setLoginError("暂时无法进入"); }
    finally { setSigningIn(false); }
  };
  const logout = () => { setAuthenticated(false); setSettingsOpen(false); setLoginError(""); };

  return (
    <div className={"app-shell " + (authenticated ? "music-shell" : "login-shell")}>
      {authenticated ? <MusicWorkspace onOpenSettings={openSettings} onLogout={logout} /> : (
        <main className="login-layout">
          <div className="login-brand"><span className="brand-mark wax-sage"><PencilIcon name="music" size={23} /></span><span id="login-brand-name">anjing music <small>x</small></span></div>
          <section className="login-card paper-card paper-outline" aria-labelledby="login-brand-name">
            <form onSubmit={handleSignIn}>
              <label htmlFor="password" className="visually-hidden">密码</label>
              <div className={"password-field paper-outline " + (loginError ? "field-invalid" : "")}>
                <input ref={passwordRef} id="password" name="password" type={passwordVisible ? "text" : "password"}
                  value={password} autoComplete="off" required disabled={signingIn}
                  placeholder="密码" aria-invalid={Boolean(loginError)} aria-describedby={loginError ? "login-error" : undefined}
                  onChange={event => { setPassword(event.target.value); setLoginError(""); }} />
                <button type="button" className="icon-button" aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                  aria-pressed={passwordVisible} onClick={() => setPasswordVisible(value => !value)}>
                  <PencilIcon name={passwordVisible ? "eyeOff" : "eye"} size={19} />
                </button>
              </div>
              <p id="login-error" className="field-error" role="alert" hidden={!loginError}>{loginError}</p>
              <button className="button button-primary paper-outline login-submit" type="submit" disabled={signingIn}>
                <span>{signingIn ? "正在进入…" : "进入音乐"}</span><PencilIcon name="arrowRight" size={20} />
              </button>
            </form>
          </section>
          <div className="login-bottom"><button type="button" className="icon-button" aria-label="设置" title="设置" onClick={openSettings}><PencilIcon name="settings" size={19} /></button></div>
        </main>
      )}
      <SettingsDialog open={settingsOpen} onClose={closeSettings} version={version} />
    </div>
  );
}
