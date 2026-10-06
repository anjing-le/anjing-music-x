import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import PencilIcon from "./PencilIcon";

export default function Modal({ title, eyebrow, onClose, children, className = "" }: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `${title.replace(/\s/g, "-")}-dialog-title`;
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const dialog = ref.current;
    if (!dialog) return;
    const targets = [...dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
    )].filter((target) => target.getClientRects().length > 0 && !target.closest('[inert]'));
    if (!targets.length) { event.preventDefault(); dialog.focus(); return; }
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
      event.preventDefault(); first.focus();
    }
  };

  return (
    <dialog ref={ref} tabIndex={-1} className={`paper-modal paper-outline ${className}`} aria-labelledby={titleId} onKeyDown={trapFocus}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-content">
        <header className="modal-heading">
          <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div>
          <button type="button" className="icon-button" aria-label={`关闭${title}`} onClick={onClose}>
            <PencilIcon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
