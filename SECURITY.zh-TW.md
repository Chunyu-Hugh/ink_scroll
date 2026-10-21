# 安全政策

[简体中文](SECURITY.md) · **繁體中文** · [English](SECURITY.en.md)

## 專案性質

`ink_scroll` 是純前端、零後端的瀏覽器裝置藝術作品。沒有伺服器、沒有使用者帳戶、沒有資料收集。**所有攝像頭/麥克風資料只在瀏覽器本機處理，從不離開你的裝置。**

## 第三方依賴

| 資源 | 來源 | 用途 |
|---|---|---|
| Noto Serif SC / TC | Google Fonts CDN | 中文字型 |
| EB Garamond | Google Fonts CDN | 西文字型 |
| MediaPipe Hands | jsDelivr CDN | 手勢辨識 |

載入 CDN 資源時會向 Google / jsDelivr 發出 HTTP 請求；如果你需要完全離線，請把這些資源下載到本機並改 `<script src>`。

## 瀏覽器權限

頁面會請求以下瀏覽器權限（取決於所選模式）：

- **攝像頭** `getUserMedia` — 手電筒模式 + 手勢模式
- **全螢幕** `requestFullscreen` — 按 F 鍵時
- **本機儲存** `localStorage` — 僅用於儲存所選語言偏好
- **未來可能** WebHID（Wiimote 模式）、麥克風（呼吸/音訊模式）、DeviceOrientation（手機魔杖）

所有權限提示由瀏覽器原生顯示，可以拒絕。攝像頭被拒絕後會自動進入滑鼠模式。

## 通報漏洞

如果你發現安全問題（XSS、CDN 投毒、未授權資料外洩等），請**不要**直接開 public issue。請透過以下方式聯絡：

- GitHub: 給 [@hunao1995](https://github.com/hunao1995) 發私訊
- 或在 GitHub repo 的 Security 分頁下建立 [private advisory](../../security/advisories/new)

我會在 7 天內回應。
