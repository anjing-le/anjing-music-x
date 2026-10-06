import { useEffect, useRef, type ReactNode } from "react";
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

  return (
    <dialog ref={ref} className={`paper-modal paper-outline ${className}`} aria-labelledby={titleId}
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
