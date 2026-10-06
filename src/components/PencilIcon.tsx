import { useId, type ReactNode } from "react";

export type IconName =
  | "music" | "pencil" | "notebook" | "settings" | "arrowRight"
  | "eye" | "eyeOff" | "close" | "copy" | "trash" | "logout"
  | "download" | "refresh" | "check" | "restart" | "info";

const drawings: Record<IconName, ReactNode> = {
  music: <><path d="M9 17V5l11-2v12" /><path d="M9 8l11-2" /><ellipse cx="6" cy="17.5" rx="3" ry="2.5" /><ellipse cx="17" cy="15.5" rx="3" ry="2.5" /></>,
  pencil: <><path d="M4 20l1.5-5.5L16.8 3.2a1.8 1.8 0 012.5 0l1.5 1.5a1.8 1.8 0 010 2.5L9.5 18.5 4 20z" /><path d="M14.8 5.2l4 4M5.5 14.5l4 4M4 20l3-1" /></>,
  notebook: <><path d="M6 3h13v18H6a2 2 0 01-2-2V5a2 2 0 012-2zM8 3v18" /><path d="M11 8h5M11 12h5M2 7h4M2 12h4M2 17h4" /></>,
  settings: <><path d="M9.4 3.6l.7-1.1h3.8l.7 1.1.4 2 1.7 1 1.9-.7 1.3.2 1.9 3.3-.5 1.3-1.5 1.3v2l1.5 1.3.5 1.3-1.9 3.3-1.3.2-1.9-.7-1.7 1-.4 2-.7 1.1h-3.8l-.7-1.1-.4-2-1.7-1-1.9.7-1.3-.2-1.9-3.3.5-1.3L4.2 13v-2L2.7 9.7l-.5-1.3 1.9-3.3 1.3-.2 1.9.7 1.7-1 .4-2.0z" transform="translate(0 .25) scale(1 .92)" /><circle cx="12" cy="12" r="3.2" /></>,
  arrowRight: <><path d="M4 12h15M14 6l6 6-6 6" /></>,
  eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <><path d="M3 3l18 18M9 5.9a13 13 0 013-.4c6.4 0 10 6.5 10 6.5a18 18 0 01-3.6 4.2M6 7.2A18 18 0 002 12s3.6 6.5 10 6.5a12 12 0 005-.9M10 10a2.8 2.8 0 004 4" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  copy: <><path d="M9 8h11v13H9zM15 8V3H4v13h5" /></>,
  trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></>,
  logout: <><path d="M10 3H4v18h6M8 12h13M16 7l5 5-5 5" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 16v5h16v-5" /></>,
  refresh: <><path d="M20 8a8 8 0 00-13.5-3L3 8M3 3v5h5M4 16a8 8 0 0013.5 3L21 16M21 21v-5h-5" /></>,
  check: <><path d="M4.5 12.5l5 5L20 6.5" /></>,
  restart: <><path d="M4 8a8.5 8.5 0 111 10M4 3v5h5M12 7v5l3 2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
};

export default function PencilIcon({ name, size = 20, className = "" }: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const patternId = `pencil-${useId().replace(/:/g, "")}`;
  return (
    <svg className={`pencil-icon ${className}`} width={size} height={size} viewBox="0 0 24 24"
      fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="32" height="32">
          <image href="/textures/pencil.png" width="32" height="32" />
        </pattern>
      </defs>
      <g stroke="currentColor" opacity=".8">{drawings[name]}</g>
      <g stroke={`url(#${patternId})`} opacity=".52">{drawings[name]}</g>
    </svg>
  );
}
