# Security Policy

[简体中文](SECURITY.md) · [繁體中文](SECURITY.zh-TW.md) · **English**

## Project nature

`ink_scroll` is a pure frontend, zero-backend browser art piece. No server, no user accounts, no data collection. **All camera and microphone data is processed locally in the browser and never leaves your device.**

## Third-party dependencies

| Resource | Source | Purpose |
|---|---|---|
| Noto Serif SC / TC | Google Fonts CDN | Chinese typography |
| EB Garamond | Google Fonts CDN | Latin typography |
| MediaPipe Hands | jsDelivr CDN | Hand gesture recognition |

Loading CDN resources triggers HTTP requests to Google / jsDelivr. For fully offline operation, download these to local files and rewrite the `<script src>` and `<link href>` references.

## Browser permissions

The page requests the following permissions, depending on the selected mode:

- **Camera** `getUserMedia` — flashlight mode + hand gesture mode
- **Fullscreen** `requestFullscreen` — when you press F
- **localStorage** — used only to remember your selected language
- **Possibly in the future** WebHID (Wiimote mode), microphone (breath / audio modes), DeviceOrientation (phone-as-wand)

All permission prompts are native to the browser and may be denied. If the camera permission is denied, the page automatically falls back to mouse mode.

## Reporting vulnerabilities

If you find a security issue (XSS, CDN poisoning, unauthorized data exfiltration, etc.), please **do not** open a public issue. Reach out via:

- GitHub: DM [@hunao1995](https://github.com/hunao1995)
- Or file a [private security advisory](../../security/advisories/new) on the GitHub repo

I aim to respond within 7 days.
