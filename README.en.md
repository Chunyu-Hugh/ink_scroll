# 墨卷 · Ink Scroll

[简体中文](README.md) · [繁體中文](README.zh-TW.md) · **English**

[![Status](https://img.shields.io/badge/status-alpha-c96442?labelColor=141413)](#-roadmap)
[![License: MIT](https://img.shields.io/badge/license-MIT-5e5d59?labelColor=141413)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-6b8e6e?labelColor=141413)](CONTRIBUTING.en.md)
[![Discussions](https://img.shields.io/badge/💬-Discussions-7b8fa8?labelColor=141413)](../../discussions)

> *Where light falls, ink comes alive*

A browser-based interactive ink-painting installation. Pure HTML/CSS/JS — single file, zero build steps, no backend.

---

Control a spotlight with your webcam flashlight or hand gestures to reveal a living, animated world hidden beneath traditional Chinese ink paintings. The ink lines stay still; inside the spotlight, the world comes alive.

> 🚧 **Project status:** Alpha — the skeleton is in place, polishing toward a "standard community project." **Come play** — open an [issue](../../issues/new/choose), chat in [Discussions](../../discussions), or pick a direction from the [Roadmap](#-roadmap).

## ✨ Features

| | |
|---|---|
| 🔦 **Flashlight** | Point a phone flashlight at the webcam; brightest spot becomes the spotlight |
| ✋ **Hand Gesture** | The display's own webcam: move your hand to move the spotlight + gestures (open/index/fist/✌️), with a large on-screen legend that highlights your current gesture. Press `H` |
| 👓 **Gaze · Glasses** | Wear glasses with an ArUco marker stuck on them — drive the spotlight by turning your head/gaze. Sub-pixel precision, no model download, requires printing one paper marker (see below) |
| 🖱 **Mouse** | Trackpad / cursor follows naturally, no camera needed |
| 🏔 **5 Scenes** | Mountains, bamboo, snow, blossoms, starry sky — AI-generated |
| 🎬 **Animations** | Birds, snowflakes, petals, fireflies, shooting stars — visible only inside the spotlight |
| 🎨 **3 Styles** | Ink edges (Sobel), sketch, dark |
| 📐 **Sensitivity** | `[ ]` keys adjust the camera-to-canvas mapping |
| 🌐 **3 Languages** | 简 · 繁 · English, auto-detected from your browser |

## 🛠 Tech Stack

**Pure frontend, no backend.**

| Layer | Tech |
|---|---|
| Rendering | Canvas 2D API |
| Gesture | [MediaPipe Hands](https://ai.google.dev/edge/mediapipe) (via CDN) |
| Eye gaze | [js-aruco2](https://github.com/damianofalcioni/js-aruco2) — pure-JS ArUco marker detection (~26 KB), sub-pixel precision + hand-rolled 3-parameter linear regression |
| Camera | `getUserMedia` API |
| Edge detection | Sobel operator (hand-rolled in JS) |
| Fonts | Noto Serif SC / TC + EB Garamond (Google Fonts) |
| Imagery | Grok (`grok-imagine-image`) generated |

The original Python + OpenCV prototype is in `archive/`.

## 🚀 Quick Start

Any static file server works.

```bash
cd web && python3 -m http.server 8888
# Open: http://localhost:8888
```

Camera APIs require HTTPS (localhost is exempt). For dev, Tailscale is the fastest path:

```bash
tailscale serve --bg 8888
# Then: https://your-machine.tailXXXXx.ts.net
```

## ⌨️ Shortcuts

| Key | Action |
|---|---|
| M | Switch mode |
| H | Hand-gesture mode (local webcam) |
| ← → | Switch scene |
| 1 / 2 / 3 | Style: edges / sketch / dark |
| `[` `]` | Sensitivity − / + |
| + / − or wheel | Spotlight radius |
| R | Reset smoothing |
| C | Recalibrate gaze (in Eye Gaze mode) |
| X | Mirror flip |
| F | Fullscreen |
| Shift + D | Toggle FPS readout |
| Q / Esc | Quit |

## 🏗 Architecture

```
web/
├── index.html        # Main app (~1770 lines, zero build, includes i18n dict)
└── scenes/           # 5 AI-generated scene images
    ├── shanshui.png
    ├── bamboo.png
    ├── snow.png
    ├── flowers.png
    └── stars.png
```

### Render pipeline

```
1. Camera "ghost" layer (15% opacity, clipped to image bounds)
2. Ink mask (Sobel edges, generated once per scene change)
3. Spotlight clip → reveal the color layer (original image + procedural animation)
4. Terracotta spotlight ring
5. Scene crossfade transition
```

## 📐 Design System

See [DESIGN.md](DESIGN.md).

Brand colors: parchment `#f5f4ed` · terracotta `#c96442` · ink black `#141413`

## ✋ About Hand Gestures · Webcam Mode

Turn your hand into a wand using the display computer's **own webcam** — no phone needed. Press `H` to enter.

- **Move your hand → move the spotlight**: hand position drives the light directly.
- **Gestures** (a **large legend on the right** highlights the gesture you're making):

| Gesture | Action |
|---|---|
| 🖐️ Open | Normal spotlight |
| ☝️ Index | Tight beam |
| ✊ Fist | Light off (spotlight disappears; idle attract only resumes once your hand leaves frame) |
| ✌️ Victory | Change scene |

### Accuracy
- Keep your hand in frame, decently lit, palm toward the camera.
- "Extended" is judged by **tip-to-wrist distance**, not tip-above-knuckle, so it stays accurate when your hand is tilted (rotation-invariant).
- The camera frame is **cropped to its true aspect and fit to the reveal area**, so hand and spotlight line up at any resolution (`[` `]` sensitivity, `X` mirror).
- The legacy `@mediapipe/hands` runs on the lite model + an overlap guard to avoid jank; migrate to MediaPipe Tasks for smoother tracking (see Roadmap).

## 👓 About Gaze · Glasses Mode

> **TL;DR: downgrade the "eye tracking" problem to a "head-pose tracking" problem by sticking an ArUco marker on your glasses.** Sub-pixel precision, no model download, the whole tracking library is 26 KB. The cost: print one piece of paper and wear glasses.

### Why this approach

Every browser eye-tracking method (WebGazer / iris geometry / deep gaze models) has the same two problems: **limited accuracy** (typically ~3–5° error) and **head movement breaks it**. This project is an art installation — we want the spotlight to follow precisely, and users should be free to move their head.

Observation: **when people "look at" something, they mostly turn their head**. Eyeball-only movement only ranges a few degrees off the head direction. So tracking *head pose* already solves ~95% of the "look-and-reveal" intent.

ArUco markers were **designed for high-precision tracking** in computer vision: black-and-white 2D fiducials, sub-pixel detection, robust across distances and angles, with a tiny (26 KB) JS library. Stick one on glasses → tracking it = tracking head pose = looks like gaze control.

### What's under the hood

| Layer | How it works |
|---|---|
| Marker detection | [js-aruco2](https://github.com/damianofalcioni/js-aruco2) — pure JS, ~26 KB, via jsDelivr CDN, default ARUCO dictionary, sub-pixel precision |
| Gaze feature | Average of the marker's 4 corners → center, normalized to camera coords `(nx, ny) ∈ [0,1]²` |
| Screen mapping | 5 calibration dots (4 corners + center) × 2 clicks each → 10 `(nx, ny, screen_x, screen_y)` samples → closed-form 3×3 least squares fits two linear models |
| Mirror handling | The app's mirror-flip toggle doesn't affect detection: an internal always-unmirrored canvas feeds ArUco |

**No license keys, no third-party SDK, no model download (a 26 KB JS file replaces the previous ~3.6 MB model), no WASM, no SharedArrayBuffer.** All the code lives in [`web/index.html`](web/index.html) — search for `enterGaze`, `loadArUco`, `markerCenter`, `fitLinear`.

### Setup (one approach, ~5 minutes)

> My version uses the most boring possible recipe — **one 50 mm marker on the bridge of a pair of glasses**. That gets the tracking working; the rest is **design space** (see below).

1. **Generate an ArUco marker**: visit [chev.me/arucogen](https://chev.me/arucogen/), pick dictionary **"Original ArUco"**, ID 0 (any works), size **50 mm**, then **Save as PNG / Print**
2. **Print and cut it out** (plain A4 paper is fine)
3. **Stick it on your glasses**: bridge (above the nose) or one corner of the frame both work — **firmly attached and facing the camera**
4. **Keep these glasses around** — next time you enter Gaze mode you just put them on

### Calibration walkthrough

1. Put on the glasses, **face the camera**, **even lighting**
2. Pick "Gaze · Glasses" mode (first run pulls 26 KB of js-aruco2 from jsDelivr — under a second)
3. 5 dots appear (4 corners + center) → **naturally turn your head/gaze toward each one** and click, 2 clicks per dot
4. After 10 clicks the regression fits → spotlight follows your glasses
5. Drifting? Press **`C`** to recalibrate

### 🎨 Design space: the art of hiding it

This is the **most community-friendly part of the project**: the tracking already works, so what's left is **how to hide the marker so visitors don't see it**. I shipped a boring baseline — please do better.

**Customizable axes:**

| Axis | Range | Tradeoff |
|---|---|---|
| Size | 10 mm – 80 mm | Bigger = longer detection distance. 10 mm needs the camera within ~30 cm, 80 mm reaches 1 m+ |
| Count | Start with 1 | Multiple markers give redundancy against occlusion (tweak the code: default uses `markers[0]`, switch to averaging all corners across markers) |
| Location | Bridge / frame corner / temple / hat brim / clothing | The farther from the front of the face, the better the disguise — but turning your head will push the marker out of the camera's view sooner |
| Dictionary | `ARUCO` (default, 5×5, 1024 IDs) / `ARUCO_MIP_36h12` (more robust) | Default is fine; switch only if detection feels jittery |

**A few ways to disguise the marker as something else:**

- 👓 **On glasses**: stuck on the back of a temple — visitors can't see it from the front, but a side camera angle can catch it (paired with an angled camera setup)
- 💍 **As jewelry**: brooch, lapel pin, earring, hair clip, ring — a marker doesn't have to *look like* a marker
- 🎩 **As a prop**: inside a hat brim (take the hat off → tracking off), tie clip, the slats of a folding fan — what you're tracking isn't your head but the thing you're holding
- 🖌 **As decoration**: an "ink seal" on a wall, ornament on a picture frame — the marker lives in the scene itself
- 🎭 **Multi-marker array**: 4 small markers arranged as a diamond decorative pattern, redundant under occlusion, individually invisible-looking

**Where to edit in code:**

| To change | Edit in `web/index.html` |
|---|---|
| Number / positions of calibration dots | `CALIB_POINTS` constant (default: 4 corners + center, 5 points) |
| Clicks per dot | `CLICKS_PER_DOT` (default: 2) |
| ArUco dictionary | `new AR.Detector({dictionaryName:'ARUCO_MIP_36h12'})` |
| Average across multiple markers | In `M.gaze.spot`, replace `markers[0]` with a corner-average over all detected markers |
| Smoothing strength | `const a=0.45` inside `spot` (higher = tighter and twitchier; lower = smoother and laggier) |

**Got a design / want to show off your glasses / want to propose another approach? → [Discussions](../../discussions) or [open an issue](../../issues/new?template=new_modality.md).** This is an art installation — **the form is part of the content**.

### Honest accuracy

ArUco detection itself is sub-pixel — **about an order of magnitude tighter than iris-geometry**, so the spotlight should track quite closely.

Things that can still fail:
- **Marker occluded** — head turned too far, hair in the way, hand in the way → no detection, spotlight holds at the last position
- **Marker glare / dirty camera** — camera can't read the black-and-white squares → detection fails
- **Calibration "looking" without turning the head** — ArUco tracks head pose; if you only move your eyes during calibration, all 5 sample points end up at nearly the same marker position and the regression goes singular (`finishCalibration` will error out and prompt a redo)
- **Too far from the camera** — marker too small in frame (< ~30 px), ArUco won't lock on

### Not built yet (future upgrades)

- **Multiple markers + homography** — 4 markers → 8 corner points → fit a homography, more robust to perspective
- **Combine with iris refinement** (FaceMesh on top of the marker baseline) — covers eye micro-movements too
- **In-page marker generator** — render a printable marker right on the page, skip the chev.me detour

PRs welcome — open an issue first.

## 🔮 Roadmap

**Original vision: IR flashlight + Wii Remote** — the classic Johnny-Lee-style installation. The Wiimote's onboard IR camera does hardware blob tracking at 100Hz with sub-pixel precision and is immune to ambient light. The current webcam mode is an interim approximation.

Below is the full survey of input modalities considered for this spotlight-reveal piece. ✅ = pure browser · ⚠️ = native bridge required.

### 🟢 Pure-browser candidates

| Category | Modality | Mapping | Key API / Lib |
|---|---|---|---|
| Pointing | **IR webcam + IR LED wand** | Drops into existing brightness-peak code | (no change) |
| | **Wiimote (WebHID)** | IR camera → XY, accel → radius | `wiimote-webhid` |
| | Joy-Con (WebHID) | Stick + IMU | `joy-con-webhid` (Tomayac) |
| | **Wacom tablet** | Pen XY + **pressure = radius** | HTML5 Pointer Events |
| | Laser pointer + webcam | HSV blob detection (red/green) | DIY |
| | AR markers (ArUco/AprilTag) | Printed paper marker as "lantern" | `js-aruco2` |
| | Gamepad (Xbox/PS) | Stick + trigger | Web Gamepad API |
| | SpaceMouse 6DoF | 6-axis puck | `spacemouse-webhid` |
| Body | **MediaPipe Pose** | Wrist + shoulder span = radius | `@mediapipe/tasks-vision` |
| | MediaPipe FaceMesh | Nose + mouth-open = radius | same |
| | WebGazer eye-tracking | Look-to-reveal | `WebGazer.js` |
| Phone | **Phone-as-wand** | Gyro + WebRTC, QR pairing | DeviceOrientation API + PeerJS |
| | Phone as touchpad | Remote touch input | same + `touchmove` |
| Audio | Volume → radius | Blow / shout / clap | Web Audio `AnalyserNode` |
| | **Breath detection** | Inhale grows, exhale shrinks | Web Audio band-pass |
| | Whistle pitch | Pitch → X-axis | `pitchy` |
| | Voice commands | "reveal", "bigger" | Web Speech API (Chromium) |
| Pro | Web MIDI | nanoKONTROL / Launchpad faders | Web MIDI API |
| | OSC over WebSocket | TouchDesigner / Max push | `osc-js` |
| Bio | rPPG heart-rate | Pulse the spotlight with heartbeat | `heartbeat-js` |
| | Muse EEG (BLE) | α-waves → bigger reveal when calm | `web-muse` |
| Misc | Pixy2 / OpenMV (Web Serial) | Onboard blob tracking | Web Serial API |

### 🟡 Native-bridge required

| Modality | Why |
|---|---|
| Kinect v2 / Azure Kinect | Skeletal + depth (Azure EOL) |
| Intel RealSense / OAK-D | Depth-mask hand silhouette |
| Leap Motion / Ultraleap | Highest-fidelity hand tracking |
| Tobii eye tracker | Production-grade gaze |
| FLIR Lepton thermal | Works in pitch dark |

### ⭐ Best matches for this piece

Each direction below lists the tech stack you'd actually need to learn, plus a "tricky" line calling out where the friction usually lives.

#### ① IR webcam + IR LED wand

The shortest path to Johnny-Lee's original vision. **Zero code change** — filter out the visible spectrum and the existing brightness-peak detector becomes an IR tracker.

- **Stack:** existing `getUserMedia` + `spF()`, reused as-is
- **Hardware:** old webcam (remove the IR-cut filter) + a strip of developed photo film as an IR-pass filter + an IR LED flashlight (~$10 on Amazon)
- **Tricky:** the mod is destructive; finding the right IR-pass thickness takes trial-and-error
- **Status:** looking for someone willing to mod a webcam

#### ② Wacom pen pressure → spotlight radius

Ink-painting meets ink-pen — theme and mechanism close the loop. **Pure browser, no new deps** — HTML5 Pointer Events delivers pressure natively.

- **Stack:** `pointermove` event + `e.pressure` (0–1)
- **Hardware:** any Wacom / XP-Pen / Huion / iPad+Apple Pencil
- **Tricky:** PointerEvent.pressure in iPad Safari has historically been flaky — test before relying on it
- **Status:** PRs welcome

#### ③ Breath + full-body pose

Inhale grows, exhale shrinks; wrist drives spotlight position. **Immersive dual-modal, hands-free, pure browser.**

- **Stack:**
  - Breath: Web Audio `AudioContext` + `BiquadFilterNode` (0.1–0.5 Hz band-pass) + `AnalyserNode` RMS envelope
  - Pose: `@mediapipe/tasks-vision` `PoseLandmarker` (CDN), reusing the existing `wkCvs` camera frame
- **Hardware:** laptop microphone + webcam (already there)
- **Tricky:** breath SNR in a noisy gallery; MediaPipe Pose is heavier than Hands (~30fps on M1)
- **Status:** next on my own short list

#### ④ Phone as a wand (WebRTC + QR pair)

Visitor scans a QR code; their phone becomes a wand. **Best for galleries** — every visitor brings their own hardware.

- **Stack:**
  - Big screen: existing page + WebRTC `RTCDataChannel`
  - Phone side: same-origin mobile sub-page reading `deviceorientation` (`alpha/beta/gamma`)
  - Pairing: PeerJS public broker (avoids running your own signaling) + `qrcode-generator` for the QR
- **Hardware:** visitor's phone + the host computer driving the big screen
- **Tricky:** iOS 14+ requires `DeviceOrientationEvent.requestPermission()`, which must be triggered by a user gesture; first-connection ICE timing
- **Status:** looking for a WebRTC-savvy collaborator

#### ⑤ OSC from TouchDesigner

Lets a curator or operator drive position, radius, and scene live from a TouchDesigner patch — without touching code. **Industry-standard installation pattern.**

- **Stack:**
  - Browser: WebSocket client + `osc-js` to decode OSC bundles
  - TD side: WebSocket DAT node, sending `/spot/x`, `/spot/y`, `/spot/r`, `/scene/next` etc.
  - Optional: the same interface accepts Max/MSP / SuperCollider / Pure Data
- **Hardware:** a computer with TouchDesigner installed (free non-commercial license works)
- **Tricky:** OSC is connectionless, you'll handle packet loss yourself; add smoothing
- **Status:** I'll ship a minimal TD patch as a demo

---

## 🤝 Get involved

The skeleton is in place — ~1370-line `web/index.html`, 5 scenes, 3 working modes, 3-language UI — but **the interesting stuff needs more people in the loop**. Any row of the Roadmap above: if someone wants to take it on, I'll review and pair through it.

### You don't need to code to contribute

| I can | How |
|---|---|
| Propose a new interaction modality | Open [New Interaction Modality issue](../../issues/new?template=new_modality.md) |
| Report a bug | Open [Bug report](../../issues/new?template=bug_report.md) |
| Suggest a small improvement | Open [Feature request](../../issues/new?template=feature_request.md) |
| Chat, ask questions, show off your install | [Discussions](../../discussions) |
| Contribute a new ink scene | See [CONTRIBUTING.en.md → Scene images](CONTRIBUTING.en.md#-scene-images) |
| Translate to another language | Open an issue to discuss |

### If you want to code

Fork → PR. See [CONTRIBUTING.en.md](CONTRIBUTING.en.md) for details. **There's one core rule:** preserve "single file, zero build, zero framework." New CDN single-file libs are fine; new bundlers are not.

Code of Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
Security: [SECURITY.en.md](SECURITY.en.md)

Don't hold back your insights.

## 📄 License

MIT — do whatever you want, commercial use OK.

Questions: [Hugh](https://github.com/Chunyu-Hugh)

See [LICENSE](LICENSE) for details.
