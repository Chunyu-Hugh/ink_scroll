# 贡献指南

**简体中文** · [繁體中文](CONTRIBUTING.zh-TW.md) · [English](CONTRIBUTING.en.md)

欢迎！墨卷是一个**艺术装置 + 开放实验场**——单文件 HTML、零依赖、欢迎一切让"光圈揭示水墨"这个核心变得更有趣的想法。

---

## 🌱 怎么参与

不需要写代码也能贡献。

| 我能做什么 | 怎么做 |
|---|---|
| 提一个新的交互方式 | 开 [New Interaction Modality issue](../../issues/new?template=new_modality.md) |
| 报告 bug | 开 [Bug report](../../issues/new?template=bug_report.md) |
| 提功能想法 | 开 [Feature request](../../issues/new?template=feature_request.md) |
| 闲聊、问问题、晒成品 | 去 [Discussions](../../discussions) |
| 改代码 | Fork → 改 → PR（见下） |
| 改 README/文档 | 直接 PR |
| 贡献场景图 (`web/scenes/`) | 见"场景图"章节 |
| 翻译到其它语言 | 开 issue 提议，我们一起看怎么组织 |

---

## 🛠 本地开发

零依赖，零构建。

```bash
git clone git@github.com:Chunyu-Hugh/ink_scroll.git
cd ink_scroll/web
python3 -m http.server 8888
# 打开 http://localhost:8888
```

摄像头功能需要 HTTPS（localhost 例外）。开发用 Tailscale `tailscale serve --bg 8888` 最快。

---

## 📝 代码风格

整个项目就一个 `web/index.html`（~1370 行）。**保持这个约束**——单文件、零依赖是产品的一部分，不是技术债。

具体约定：

- **不引入构建工具**（webpack/vite/parcel 全部 no）
- **不引入框架**（React/Vue/Svelte 全部 no）
- **可以引入 CDN 单文件库**（如 MediaPipe、osc-js），但要明确写为何需要
- **风格延续现有代码**：超紧凑、单字母变量在内部 OK、注释少而精
- **新交互方式**：在 `M` 注册表里加一条，遵循
  `{icon, nameKey, group, needCam, needMic, init, spot, cln, ex, meter}` 接口。
  完整契约、失败回落要求和 checklist 见 **[docs/INTERACTIONS.md](docs/INTERACTIONS.md)**
- **加完必须能测**：在 `tools/test.js` 的「每一种交互模态」段补一条断言，
  然后 `node tools/test.js` 必须全绿（它用真实浏览器 + 假摄像头/麦克风）
- **新场景图**：512×512+ PNG，水墨风格，放到 `web/scenes/`，在 `sceneFiles` 数组注册
- **i18n**：新加的所有面向用户的字符串要进 `I18N` 字典三个语言都填一份。HUD 字段每帧刷新所以模式名/场景名/风格名能自动跟随语言切换

---

## 🎨 场景图

新场景图欢迎！要求：

- 中国风水墨/书画风格（与现有 `shanshui/bamboo/snow/flowers/stars` 一致）
- 512×512 像素以上，PNG 格式，文件大小 < 1MB
- 单色或低饱和度——边缘检测 (Sobel) 对高对比单色效果最好
- 你拥有版权 或 来源是 CC0/CC-BY，在 PR 里注明来源

---

## 🔀 PR 流程

1. Fork & 创建分支：`git checkout -b modality/wacom-pressure`
2. 改动尽量小、可解释。一个 PR 一件事。
3. 在浏览器里实测——单元测试在这个项目里不存在
4. 跑 `node tools/test.js`（95 条端到端断言，需要 Playwright 的 Chromium），全绿再提
5. PR 描述里**贴一张 GIF/截图**展示效果
6. 我（@Chunyu-Hugh）会尽快 review

---

## 💬 行为准则

参见 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。简而言之：**对作品认真，对人友善**。

---

## 🙏 致谢

每个被合并的贡献者会被加到 README 致谢区。第一次贡献者特别欢迎——告诉我哪里阻塞你了，我帮你过坎。

不吝赐教。
