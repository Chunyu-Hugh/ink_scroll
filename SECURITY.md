# 安全策略

**简体中文** · [繁體中文](SECURITY.zh-TW.md) · [English](SECURITY.en.md)

## 项目性质

`ink_scroll` 是纯前端、零后端的浏览器装置艺术作品。没有服务器、没有用户账户、没有数据收集。**所有摄像头/麦克风数据只在浏览器本地处理，从不离开你的设备。**

## 第三方依赖

| 资源 | 来源 | 用途 |
|---|---|---|
| Noto Serif SC / TC | Google Fonts CDN | 中文字体 |
| EB Garamond | Google Fonts CDN | 西文字体 |
| MediaPipe Hands | jsDelivr CDN | 手势识别 |

加载 CDN 资源时会向 Google / jsDelivr 发出 HTTP 请求；如果你需要完全离线，请把这些资源下载到本地并改 `<script src>`。

## 浏览器权限

页面会请求以下浏览器权限（取决于所选模式）：

- **摄像头** `getUserMedia` — 闪光灯模式 + 手势模式
- **全屏** `requestFullscreen` — 按 F 键时
- **本地存储** `localStorage` — 仅用于保存所选语言偏好
- **未来可能** WebHID（Wiimote 模式）、麦克风（呼吸/音频模式）、DeviceOrientation（手机魔杖）

所有权限提示由浏览器原生展示，可以拒绝。摄像头拒绝后会自动进入鼠标模式。

## 报告漏洞

如果你发现安全问题（XSS、CDN 投毒、未授权数据外泄等），请**不要**直接开 public issue。请通过以下方式联系：

- GitHub: 给 [@hunao1995](https://github.com/hunao1995) 发私信
- 或在 GitHub repo 的 Security 标签下创建 [private advisory](../../security/advisories/new)

我会在 7 天内响应。
