# Anjing Hand 字体来源

本地 UI 字体由官方 LXGW WenKai Regular 生成静态字符子集；内部字体名称已改为 Anjing Hand，保留原版权、设计者与 SIL OFL 1.1 许可。这里只重命名和裁剪字符，未修改字形设计。运行时无需请求字体 CDN。

- 上游：[LXGW WenKai](https://github.com/lxgw/LxgwWenKai)
- 固定提交：`a22e2a064f471fffd194af2a69072944bbe218dc`
- 原字体：[LXGWWenKai-Regular.ttf](https://raw.githubusercontent.com/lxgw/LxgwWenKai/a22e2a064f471fffd194af2a69072944bbe218dc/fonts/TTF/LXGWWenKai-Regular.ttf)
- 原字体 SHA-256：`39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009`
- 原许可：[OFL.txt](https://raw.githubusercontent.com/lxgw/LxgwWenKai/a22e2a064f471fffd194af2a69072944bbe218dc/OFL.txt)；随字体原样附带
- 子集：`src/**/*.ts`、`src/**/*.tsx` 中的汉字和标点，另含可打印 ASCII；共 338 个 Unicode 字符，清单为 `glyphs.txt`
- 产物：`anjing-hand.woff2`，75704 字节
- 产物 SHA-256：`19dd9ff637a10689798c4b772475953379b1fa825c54973a1d1e81a6f9f0154e`
- 生成工具：fontTools 4.66.1、Brotli 1.2.0
- 重新生成：`uv run scripts/fetch-font.py`；新增静态 UI 文字后执行。用户输入和子集外字符使用界面的系统字体后备。
