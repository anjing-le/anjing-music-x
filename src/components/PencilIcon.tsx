import { useId, type ReactNode } from "react";

export type IconName =
  | "music" | "pencil" | "notebook" | "settings" | "arrowRight"
  | "eye" | "eyeOff" | "close" | "copy" | "trash" | "logout"
  | "download" | "refresh" | "check" | "restart" | "info"
  | "search" | "heart" | "star" | "library" | "clock" | "arrowLeft"
  | "play" | "pause" | "next" | "previous" | "queue" | "repeat" | "repeatOne"
  | "shuffle" | "volume" | "volumeOff" | "lyrics" | "chevronUp";

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
  search: <><circle cx="10.5" cy="10.5" r="6.8" /><path d="M16 16l5 5" /></>,
  heart: <><path d="M12 20s-9-5.4-9-11a4.6 4.6 0 019-1.2A4.6 4.6 0 0121 9c0 5.6-9 11-9 11z" /></>,
  star: <><path d="M12 3l2.9 5.8 6.4.9-4.6 4.5 1.1 6.3-5.8-3-5.8 3 1.1-6.3-4.6-4.5 6.4-.9L12 3z" /></>,
  library: <><path d="M4 4h4v16H4zM11 4h4v16h-4zM18 5l3-1 3 15-3 1-3-15z" transform="translate(-1 0)" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  arrowLeft: <><path d="M20 12H5M10 6l-6 6 6 6" /></>,
  play: <><path d="M8 4.8l11 7.2-11 7.2V4.8z" /></>,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  next: <><path d="M4 5l11 7-11 7V5zM20 5v14" /></>,
  previous: <><path d="M20 5L9 12l11 7V5zM4 5v14" /></>,
  queue: <><path d="M3 5h18M3 10h18M3 15h10M3 20h10M18 14l4 3-4 3v-6z" /></>,
  repeat: <><path d="M4 8a3 3 0 013-3h13M16 2l4 3-4 3M20 16a3 3 0 01-3 3H4M8 16l-4 3 4 3" /></>,
  repeatOne: <><path d="M4 8a3 3 0 013-3h13M16 2l4 3-4 3M20 16a3 3 0 01-3 3H4M8 16l-4 3 4 3M11 10l2-1v6M11 15h4" /></>,
  shuffle: <><path d="M3 6h3c4 0 7 12 11 12h4M17 14l4 4-4 4M3 18h3c1.6 0 3.1-1.8 4.5-4M13.5 9c1.2-1.7 2.3-3 3.5-3h4M17 2l4 4-4 4" /></>,
  volume: <><path d="M3 9h4l5-4v14l-5-4H3V9zM16 8a6 6 0 010 8M19 5a10 10 0 010 14" /></>,
  volumeOff: <><path d="M3 9h4l5-4v14l-5-4H3V9zM17 9l5 6M22 9l-5 6" /></>,
  lyrics: <><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5" /></>,
  chevronUp: <><path d="M5 15l7-7 7 7" /></>,
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
