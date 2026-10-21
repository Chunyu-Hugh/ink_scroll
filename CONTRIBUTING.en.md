# Contributing

[简体中文](CONTRIBUTING.md) · [繁體中文](CONTRIBUTING.zh-TW.md) · **English**

Welcome. Ink Scroll is an **art installation + open experiment** — a single-file HTML app with zero dependencies. All ideas that make the "spotlight reveals ink" core more compelling are welcome.

---

## 🌱 Ways to contribute

You don't need to write code to contribute.

| I can | How |
|---|---|
| Propose a new interaction modality | Open a [New Interaction Modality issue](../../issues/new?template=new_modality.md) |
| Report a bug | Open a [Bug report](../../issues/new?template=bug_report.md) |
| Suggest a feature | Open a [Feature request](../../issues/new?template=feature_request.md) |
| Chat, ask questions, show off your install | Visit [Discussions](../../discussions) |
| Change code | Fork → edit → PR (see below) |
| Edit README / docs | Open a PR directly |
| Contribute a scene image (`web/scenes/`) | See the "Scene images" section |
| Translate to another language | Open an issue to discuss how to organize it |

---

## 🛠 Local development

Zero deps, zero build.

```bash
git clone git@github.com:hunao1995/ink_scroll.git
cd ink_scroll/web
python3 -m http.server 8888
# Open http://localhost:8888
```

Camera APIs require HTTPS (localhost is exempt). For development, Tailscale `tailscale serve --bg 8888` is the fastest path.

---

## 📝 Code style

The whole project lives in one `web/index.html` (~1370 lines). **Keep it that way** — single-file, zero-deps is part of the product, not tech debt.

Specifics:

- **No build tools** (webpack / vite / parcel are all no-go)
- **No frameworks** (React / Vue / Svelte are all no-go)
- **CDN single-file libs are OK** (e.g. MediaPipe, osc-js) when justified
- **Match existing style**: terse, short variable names internally, comments rare and meaningful
- **New interaction modality**: add an entry to the `M` object (mode dispatch table) implementing `{icon, nameKey, init, spot, cln, ex, needCam}`
- **New scene image**: 512×512+ PNG, ink-painting style, dropped into `web/scenes/`, registered in the `sceneFiles` array
- **i18n**: any new user-facing string must land in the `I18N` dictionary across all three locales. HUD fields refresh per frame, so mode/scene/style names follow language switches automatically.

---

## 🎨 Scene images

New scene images are very welcome. Requirements:

- Chinese ink-painting / brush style (matching the existing `shanshui / bamboo / snow / flowers / stars` scenes)
- 512×512 pixels or larger, PNG, file size < 1MB
- Monochrome or low-saturation — Sobel edge detection works best on high-contrast monochrome
- You hold copyright, or the source is CC0 / CC-BY (cite the source in the PR)

---

## 🔀 PR workflow

1. Fork & create a branch: `git checkout -b modality/wacom-pressure`
2. Keep the change small and explainable. One PR per concern.
3. Test it in a browser — there are no unit tests in this project.
4. **Attach a GIF / screenshot** showing the effect in your PR description.
5. I (@hunao1995) will review as soon as I can.

---

## 💬 Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). TL;DR: **be rigorous about the work, kind to people**.

---

## 🙏 Acknowledgments

Every merged contributor is credited in the README. First-time contributors especially welcome — tell me where you get stuck and I'll help you through.

Don't hold back your insights.
