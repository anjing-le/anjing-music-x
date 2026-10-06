import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Window as NativeWindow } from '@tauri-apps/api/window';
import { isDesktop } from '../desktop';
import PencilIcon from './PencilIcon';
import './windowChrome.css';

type Action = 'minimize' | 'maximize' | 'close';

export default function WindowChrome() {
  const isMac = /Mac/.test(navigator.platform);
  const [maximized, setMaximized] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState('');
  const windowRef = useRef<NativeWindow | null>(null);
  const epoch = useRef(0);
  const stateRequest = useRef(0);
  const operationPending = useRef(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((message: string) => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setError(message);
    errorTimer.current = setTimeout(() => setError(''), 4500);
  }, []);

  const refreshState = useCallback(async (window: NativeWindow, currentEpoch: number) => {
    if (epoch.current !== currentEpoch) return;
    const request = ++stateRequest.current;
    try {
      const result = await window.isMaximized();
      if (epoch.current === currentEpoch && request === stateRequest.current) setMaximized(result);
    } catch {
      if (epoch.current === currentEpoch && request === stateRequest.current) showError('无法读取窗口状态。');
    }
  }, [showError]);

  useEffect(() => {
    if (!isDesktop) return;
    const currentEpoch = ++epoch.current;
    let unlisten: (() => void) | null = null;
    const stopListening = (stop: () => void) => {
      try {
        void Promise.resolve(stop()).catch(() => {
          // The UI is already unmounted when cleanup runs, so leave a concise
          // diagnostic without updating a stale component.
          console.warn('Window resize listener could not be released.');
        });
      } catch { console.warn('Window resize listener could not be released.'); }
    };
    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      if (epoch.current !== currentEpoch) return;
      const window = getCurrentWindow();
      windowRef.current = window;
      setReady(true);
      void refreshState(window, currentEpoch);
      void window.onResized(() => { void refreshState(window, currentEpoch); }).then((stop) => {
        if (epoch.current !== currentEpoch) stopListening(stop);
        else unlisten = stop;
      }).catch(() => {
        if (epoch.current === currentEpoch) showError('无法监听窗口状态。');
      });
    }).catch(() => {
      if (epoch.current === currentEpoch) showError('窗口控制暂时无法使用。');
    });
    return () => {
      ++epoch.current;
      ++stateRequest.current;
      windowRef.current = null;
      if (unlisten) stopListening(unlisten);
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, [refreshState, showError]);

  const perform = async (action: Action) => {
    const window = windowRef.current;
    if (!window || operationPending.current) return;
    const currentEpoch = epoch.current;
    operationPending.current = true;
    setPending(action);
    try {
      if (action === 'minimize') await window.minimize();
      else if (action === 'close') await window.close();
      else { await window.toggleMaximize(); await refreshState(window, currentEpoch); }
    } catch {
      if (epoch.current === currentEpoch) showError(action === 'minimize' ? '无法最小化窗口。' : action === 'close' ? '无法关闭窗口。' : '无法调整窗口大小。');
    } finally {
      operationPending.current = false;
      if (epoch.current === currentEpoch) setPending(null);
    }
  };

  const handleDrag = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.defaultPrevented || (event.target instanceof Element && event.target.closest('button'))) return;
    event.preventDefault();
    if (event.detail === 2) { void perform('maximize'); return; }
    const window = windowRef.current;
    if (!window) { showError('窗口控制尚未就绪。'); return; }
    const currentEpoch = epoch.current;
    void window.startDragging().catch(() => {
      if (epoch.current === currentEpoch) showError('无法拖动窗口。');
    });
  };

  if (!isDesktop) return null;
  const actions: Action[] = isMac ? ['close', 'minimize', 'maximize'] : ['minimize', 'maximize', 'close'];
  const labels: Record<Action, string> = { close: '关闭窗口', minimize: '最小化窗口', maximize: maximized ? '还原窗口' : '最大化窗口' };

  return <header className={`window-chrome ${isMac ? 'window-chrome-mac' : 'window-chrome-windows'}`} onMouseDown={handleDrag} aria-label="窗口标题栏">
    <div className="window-chrome-controls" aria-label="窗口控制">
      {actions.map((action) => <button key={action} type="button" className={`window-chrome-button window-chrome-${action}`} aria-label={labels[action]} title={labels[action]} disabled={!ready || pending !== null}
        onMouseDown={(event) => event.stopPropagation()} onClick={() => { void perform(action); }}>
        <PencilIcon name={action === 'close' ? 'close' : action === 'minimize' ? 'minimize' : maximized ? 'restore' : 'maximize'} size={15} />
      </button>)}
    </div>
    {error && <div className="window-chrome-error paper-outline" role="alert">{error}</div>}
  </header>;
}
