# Anjing Music X

安静的音乐客户端。独立的 public 仓库，面向 macOS（Apple Silicon / Intel）与 Windows x64，通过 GitHub Releases 分发与更新，不上 App Store。

## 当前目标

产品形态参考 QQ 音乐的桌面播放器：侧栏导航、顶部搜索、主内容区和固定底部播放栏，使用统一的「纸白 × 铅笔 × 蜡笔」UI。

首版保留推荐、全部歌曲、我喜欢、最近播放、歌单详情和正在播放视图。播放链包含播放/暂停、上下首、拖动进度、音量/静音、播放模式、队列删除与失败重试；歌词入口显示当前曲目的歌词或纯音乐状态。收藏和最近播放在本机保存，页面切换保持同一个播放器。

客户端随包提供 6 首自制的 22 秒合成示例音乐与 3 张精选歌单。顶部可导入本机 WAV、FLAC、MP3、M4A、OGG，读取真实媒体时长，进入全部歌曲、搜索、收藏和最近播放。具体编码是否可播放由系统 WebView 决定，读取失败会显示错误。导入文件保存在本机 IndexedDB，缓存上限 500 MB；满额停止导入，可逐首移除本地副本，原文件和云盘不受影响。旧私有网站的谱面、个人注记和历史仍留在原仓库。

参考来源：[QQ 音乐官网](https://y.qq.com/)、[官方客户端下载页](https://y.qq.com/download/download.html)，以及本机 QQMusic 11.9.0 的桌面窗口结构。这里复刻的是精简的播放器形态。

临时演示密码是 `anjing`。客户端源码公开，固定密码只能作为进入界面的门槛，不是账号系统或数据访问控制。登录状态只保留在当前运行内，刷新或重启后需重新进入。

## 本地运行

需要 Node.js 22.22+、Rust stable，以及 [Tauri 官方环境要求](https://v2.tauri.app/start/prerequisites/)。

```sh
npm ci
npm run dev        # 浏览器预览 http://127.0.0.1:1426
npm run desktop    # 原生桌面客户端
npm run verify     # TypeScript、前端构建、版本一致性
npm run test:e2e   # 登录、搜索、真实媒体与播放器交互验收
```

浏览器预览提供演示登录与 UI；更新检查和安装需要在原生桌面客户端执行。

## UI

- 纸白与铅笔灰为主体，主操作使用蛋黄黄，危险操作使用珊瑚红；单个组件只使用少量强调色。
- 小纹理在构建前生成，运行时复用浏览器资源缓存，没有随机重绘或空闲动画。正文与输入使用系统字体，标题与短按钮使用可选择的真实手写字体。
- 卡片、按钮、输入、工具条、弹窗使用共用样式。保留键盘焦点、减少动态效果偏好和无障碍语义。
- 素材来源和再生成方式见 scripts/；字体许可随 public/fonts/ 保存。

## 私人曲库与录音

当前免费方案是飞书私人云盘保存音频，下载到本机后通过顶部入口导入客户端。云文档可作为曲目目录；文档分享页面不是永久音频直链。飞书自动登录、同步和后台下载尚未接入，固定演示密码不承担云盘鉴权。

截至 2026-10-06，飞书基础版未认证组织免费共享容量为 15 GB、单文件上限 20 MB；认证后容量和单文件上限不同，实际以账号页面为准。免费额度用满后停止上传，不开通付费服务。较长 WAV 可能超过单文件上限，应先核对账号限制，不能用“无损”字样掩盖另一次有损编码。[官方容量说明](https://www.feishu.cn/hc/en-US/articles/360033241654-upload-or-import-local-files-and-folders)、[格式与文件大小限制](https://www.feishu.cn/hc/en-US/articles/360049067549-size-and-format-requirements-for-uploading-or-previewing-files)。

macOS 的 `scripts/capture-qqmusic-macos.swift` 使用 ScreenCaptureKit，只录 QQ 音乐应用的播放输出，保存 48 kHz 双声道 Float32 PCM WAV/CAF。没有麦克风或屏幕画面输出；需要已有系统音频采集权限，权限不足会停止，不自动修改系统设置。最多录制 600 秒，不覆盖已有文件，全静音会判为失败。

```sh
mkdir -p qa-artifacts/audio-capture
swiftc -parse-as-library scripts/capture-qqmusic-macos.swift -o qa-artifacts/audio-capture/QQMusicAudioCapture
qa-artifacts/audio-capture/QQMusicAudioCapture --list-apps
# 先在 QQ 音乐开始播放，再运行；录音结束后手动暂停播放。
qa-artifacts/audio-capture/QQMusicAudioCapture --duration 30 --output "$HOME/Music/qqmusic-sample.wav"
```

录音保存的是实际播放结果，不能恢复原始母带或完整全景声对象信息。个人音频放在仓库外，或仅放入已忽略的 `qa-artifacts/`；不提交到此公开仓库。Windows 录音工具尚未实现。

## GitHub OTA

采用 Tauri updater 的独立产品签名。`latest.json` 来自本仓库 GitHub Releases，含 macOS arm64/x64 与 Windows x64 下载地址和签名。流程是检查 → 阅读版本说明 → 主动安装 → 进度/失败反馈 → 重启。

签名私钥必须保存在仓库外，并配置到 GitHub Actions Secrets 的 `TAURI_SIGNING_PRIVATE_KEY`，密码为 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`（本次原型使用空密码）。客户端仅包含公钥。更新验签不能关闭。[官方说明](https://v2.tauri.app/plugin/updater/)

本次已创建独立密钥并配置 GitHub Secret；本地私钥位于 `~/.local/share/anjing-music-x/updater.key`，目录权限 700、文件权限 600，请单独备份，不能提交到仓库。手动运行 release workflow 会先生成完整三平台的草稿 Release；发布草稿后才会进入 stable OTA。

平台代码签名与 OTA 签名相互独立。当前原型 macOS 使用 ad-hoc 签名，Windows 尚未配置 Authenticode；正式系统信任体验需要后续配置平台证书，仍可使用 GitHub 分发。

## 验收状态

0.2.2 精简了登录页文案，仅显示品牌、密码框、进入按钮与设置图标；登录窗口为 520×360，密码、键盘交互和播放器布局保持原样。

0.2.1 已实现本地导入、持久化和逐首移除副本。TypeScript、前端构建与版本一致性通过；10 项 E2E 通过，覆盖真实音频播放、重载恢复、收藏/最近记录、重复导入、损坏文件批次拒绝以及移除当前曲目的队列与缓存行为。自制 WAV、FLAC、MP3、M4A/AAC、OGG/Vorbis 均在 Chromium 中完成真实解码与播放，不能据此保证所有编码在两种系统 WebView 中可用。

本机 macOS Apple Silicon 0.2.1 app 已构建并通过 ad-hoc 签名完整性检查。真实 QQ 音乐播放输出已完成内录、私人飞书上传、下载和 SHA-256 一致性验证；回下载的 WAV 在此 macOS app 中导入、播放到 19 秒，关闭重启后仍保留，并再次播放到 13 秒。Windows 原生导入与持久化尚未实测，飞书自动同步尚未接入。

播放器界面使用真实 HTMLAudio，窗口为 1080×720，最小 820×600；仅内容区滚动，底部播放器保持可见。

播放器源码提交为 `a40cdf4`。本地 TypeScript、构建与版本校验通过；[GitHub CI](https://github.com/anjing-le/anjing-music-x/actions/runs/37459932786) 的 7 项真实媒体与 UI 交互测试全部通过，macOS 和 Windows 的构建、Rust 格式、检查与测试也通过。测试覆盖暂停后的曲尾跳转、自然续播、进度、收藏持久化、队列删除及音频加载失败恢复。

macOS 0.2.0 打包客户端已实际运行，验证了登录、播放时间推进、自然切歌、暂停与进度跳转、中文搜索、收藏、队列和歌词入口。1080×720 与 820×600 的布局经过检查；底部播放器持续可见，内容区独立滚动。

[三平台打包流程](https://github.com/anjing-le/anjing-music-x/actions/runs/37460485929) 已生成 `v0.2.0` 草稿：macOS Apple Silicon / Intel 的 app 与 DMG、Windows x64 NSIS 安装包，以及独立签名与三平台 `latest.json`。汇总步骤用客户端公钥验证实际更新包签名后才创建草稿，草稿不进入 stable OTA。

尚无正式发布版本。Windows 真机运行、从旧版升级到新版的完整 OTA 和平台证书签名尚未验证。
