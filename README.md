# Anjing Music X

安静的音乐客户端。独立的 public 仓库，面向 macOS（Apple Silicon / Intel）与 Windows x64，通过 GitHub Releases 分发与更新，不上 App Store。

## 当前目标

产品形态参考 QQ 音乐的桌面播放器：侧栏导航、顶部搜索、主内容区和固定底部播放栏，使用统一的「纸白 × 铅笔 × 蜡笔」UI。

首版保留推荐、全部歌曲、我喜欢、最近播放、歌单详情和正在播放视图。播放链包含播放/暂停、上下首、拖动进度、音量/静音、播放模式、队列删除与失败重试；歌词入口显示当前曲目的歌词或纯音乐状态。收藏和最近播放在本机保存，页面切换保持同一个播放器。

当前使用 6 首自制的 22 秒合成示例音乐与 3 张精选歌单，封面和音频随客户端打包；用于验收真实播放链，后续通过 src/music/catalog.ts 替换曲库。侧栏仅保留一处演示曲库标记。旧私有网站的谱面、个人注记和历史仍留在原仓库。

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

## GitHub OTA

采用 Tauri updater 的独立产品签名。`latest.json` 来自本仓库 GitHub Releases，含 macOS arm64/x64 与 Windows x64 下载地址和签名。流程是检查 → 阅读版本说明 → 主动安装 → 进度/失败反馈 → 重启。

签名私钥必须保存在仓库外，并配置到 GitHub Actions Secrets 的 `TAURI_SIGNING_PRIVATE_KEY`，密码为 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`（本次原型使用空密码）。客户端仅包含公钥。更新验签不能关闭。[官方说明](https://v2.tauri.app/plugin/updater/)

本次已创建独立密钥并配置 GitHub Secret；本地私钥位于 `~/.local/share/anjing-music-x/updater.key`，目录权限 700、文件权限 600，请单独备份，不能提交到仓库。手动运行 release workflow 会先生成完整三平台的草稿 Release；发布草稿后才会进入 stable OTA。

平台代码签名与 OTA 签名相互独立。当前原型 macOS 使用 ad-hoc 签名，Windows 尚未配置 Authenticode；正式系统信任体验需要后续配置平台证书，仍可使用 GitHub 分发。

## 验收状态

0.2.0 已实现播放器界面与真实 HTMLAudio 播放，移除了首版基础容器中的便笺。当前窗口为 1080×720，最小 820×600；仅内容区滚动，底部播放器保持可见。

播放器源码提交为 `a40cdf4`。本地 TypeScript、构建与版本校验通过；[GitHub CI](https://github.com/anjing-le/anjing-music-x/actions/runs/37459932786) 的 7 项真实媒体与 UI 交互测试全部通过，macOS 和 Windows 的构建、Rust 格式、检查与测试也通过。测试覆盖暂停后的曲尾跳转、自然续播、进度、收藏持久化、队列删除及音频加载失败恢复。

macOS 0.2.0 打包客户端已实际运行，验证了登录、播放时间推进、自然切歌、暂停与进度跳转、中文搜索、收藏、队列和歌词入口。1080×720 与 820×600 的布局经过检查；底部播放器持续可见，内容区独立滚动。

[三平台打包流程](https://github.com/anjing-le/anjing-music-x/actions/runs/37460485929) 已生成 `v0.2.0` 草稿：macOS Apple Silicon / Intel 的 app 与 DMG、Windows x64 NSIS 安装包，以及独立签名与三平台 `latest.json`。汇总步骤用客户端公钥验证实际更新包签名后才创建草稿，草稿不进入 stable OTA。

尚无正式发布版本。Windows 真机运行、从旧版升级到新版的完整 OTA 和平台证书签名尚未验证。
