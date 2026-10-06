export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  src: string;
  lyrics: { time: number; text: string }[];
};

export type Playlist = {
  id: string;
  title: string;
  description: string;
  cover: string;
  trackIds: string[];
};

const demoTrack = (id: string, title: string, cover: string): Track => ({
  // Original synthesized demo pieces; the workspace labels the demo library once.
  id, title, artist: '安静', album: '纸上的小旋律',
  duration: 22, cover: `/covers/${cover}.png`, src: `/audio/${id}.wav`,
  lyrics: [{ time: 0, text: '纯音乐' }],
});

export const tracks: Track[] = [
  demoTrack('paper-morning', '纸上晨光', 'morning'),
  demoTrack('afternoon-window', '午后的小窗', 'window'),
  demoTrack('passing-breeze', '风从这里经过', 'breeze'),
  demoTrack('slow-home', '慢慢归途', 'home'),
  demoTrack('rain-on-paper', '纸上的雨滴', 'rain'),
  demoTrack('little-lamp', '留一盏小灯', 'lamp'),
];

export const playlists: Playlist[] = [
  { id: 'quiet-morning', title: '安静的早晨', description: '给新一天留一点轻盈',
    cover: '/covers/morning.png', trackIds: ['paper-morning', 'passing-breeze', 'afternoon-window'] },
  { id: 'window-afternoon', title: '窗边的午后', description: '小窗、微风和落在纸上的雨',
    cover: '/covers/window.png', trackIds: ['afternoon-window', 'rain-on-paper', 'passing-breeze'] },
  { id: 'on-the-way-home', title: '慢慢回家', description: '让一天在柔和的旋律里收尾',
    cover: '/covers/home.png', trackIds: ['slow-home', 'little-lamp', 'paper-morning'] },
];
