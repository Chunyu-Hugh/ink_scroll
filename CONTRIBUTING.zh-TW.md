# 貢獻指南

[简体中文](CONTRIBUTING.md) · **繁體中文** · [English](CONTRIBUTING.en.md)

歡迎！墨卷是一個**藝術裝置 + 開放實驗場**——單檔案 HTML、零依賴、歡迎一切讓「光圈揭示水墨」這個核心變得更有趣的想法。

---

## 🌱 怎麼參與

不需要寫程式碼也能貢獻。

| 我能做什麼 | 怎麼做 |
|---|---|
| 提一個新的互動方式 | 開 [New Interaction Modality issue](../../issues/new?template=new_modality.md) |
| 回報 bug | 開 [Bug report](../../issues/new?template=bug_report.md) |
| 提功能想法 | 開 [Feature request](../../issues/new?template=feature_request.md) |
| 閒聊、問問題、曬成品 | 去 [Discussions](../../discussions) |
| 改程式碼 | Fork → 改 → PR（見下） |
| 改 README/文件 | 直接 PR |
| 貢獻場景圖 (`web/scenes/`) | 見「場景圖」章節 |
| 翻譯到其他語言 | 開 issue 提議，我們一起看怎麼組織 |

---

## 🛠 本機開發

零依賴，零建構。

```bash
git clone git@github.com:hunao1995/ink_scroll.git
cd ink_scroll/web
python3 -m http.server 8888
# 打開 http://localhost:8888
```

攝像頭功能需要 HTTPS（localhost 例外）。開發用 Tailscale `tailscale serve --bg 8888` 最快。

---

## 📝 程式碼風格

整個專案就一個 `web/index.html`（~1370 行）。**保持這個約束**——單檔案、零依賴是產品的一部分，不是技術債。

具體約定：

- **不引入建構工具**（webpack/vite/parcel 全部 no）
- **不引入框架**（React/Vue/Svelte 全部 no）
- **可以引入 CDN 單檔案函式庫**（如 MediaPipe、osc-js），但要明確寫為何需要
- **風格延續現有程式碼**：超緊湊、單字母變數在內部 OK、註解少而精
- **新互動方式**：在 `M` 物件（mode dispatch table）裡加一個新 entry，遵循 `{icon, nameKey, init, spot, cln, ex, needCam}` 介面
- **新場景圖**：512×512+ PNG，水墨風格，放到 `web/scenes/`，在 `sceneFiles` 陣列註冊
- **i18n**：新加的所有面向使用者的字串要進 `I18N` 字典三個語言都填一份。HUD 欄位每幀刷新所以模式名/場景名/風格名能自動跟隨語言切換

---

## 🎨 場景圖

新場景圖歡迎！要求：

- 中國風水墨/書畫風格（與現有 `shanshui/bamboo/snow/flowers/stars` 一致）
- 512×512 像素以上，PNG 格式，檔案大小 < 1MB
- 單色或低飽和度——邊緣偵測 (Sobel) 對高對比單色效果最好
- 你擁有版權 或 來源是 CC0/CC-BY，在 PR 裡註明來源

---

## 🔀 PR 流程

1. Fork & 建立分支：`git checkout -b modality/wacom-pressure`
2. 改動盡量小、可解釋。一個 PR 一件事。
3. 在瀏覽器裡實測——單元測試在這個專案裡不存在
4. PR 描述裡**貼一張 GIF/截圖**展示效果
5. 我（@hunao1995）會盡快 review

---

## 💬 行為準則

參見 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。簡而言之：**對作品認真，對人友善**。

---

## 🙏 致謝

每個被合併的貢獻者會被加到 README 致謝區。第一次貢獻者特別歡迎——告訴我哪裡阻塞你了，我幫你過坎。

不吝賜教。
