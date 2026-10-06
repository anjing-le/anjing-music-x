# Anjing Music X

安静的音乐客户端。独立的 public 仓库，面向 macOS（Apple Silicon / Intel）与 Windows x64，通过 GitHub Releases 分发与更新，不上 App Store。

## 当前目标

当前阶段实现跨平台客户端基础、固定密码入口、统一的「纸白 × 铅笔 × 蜡笔」UI 和 GitHub OTA。首版音乐业务尚未确定，不把旧网站的曲谱、个人注记或 Git 历史带入这个公开仓库。

临时演示密码是 `anjing`。客户端源码公开，固定密码只能作为进入界面的门槛，不是账号系统或数据访问控制。登录状态只保留在当前运行内，刷新或重启后需重新进入。

## 本地运行

需要 Node.js 22.22+、Rust stable，以及 [Tauri 官方环境要求](https://v2.tauri.app/start/prerequisites/)。

```sh
npm ci
npm run dev        # 浏览器预览 http://127.0.0.1:1426
npm run desktop    # 原生桌面客户端
npm run verify     # TypeScript、前端构建、版本一致性
npm run test:e2e   # 登录、键盘与基础交互验收
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

平台代码签名与 OTA 签名相互独立。当前原型 macOS 使用 ad-hoc 签名，Windows 尚未配置 Authenticode；正式系统信任体验需要后续配置平台证书，仍可使用 GitHub 分发。

## 验收状态

已完成固定密码入口、工作台空状态、可编辑临时便笺、设置弹窗和 OTA 交互。便笺仅为基础内容容器，复制、确认清空、收起和退出可用；音乐核心业务仍待确定。

已验证 TypeScript/前端构建、版本一致性、macOS 原生 cargo check / fmt / test、浏览器密码错误与正确进入、弹窗焦点恢复、清空确认和 680×560 最小布局。纹理固定 seed 重生成哈希一致，中文标题字体本地子集约 59 KB。

GitHub CI、原生打包运行和实际更新需要分别验证。尚无正式发布版本，Windows 真机运行、从旧版升级到新版的完整 OTA、平台证书签名尚未验证。
