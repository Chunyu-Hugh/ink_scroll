# 墨卷 · Ink Scroll

[简体中文](README.md) · **繁體中文** · [English](README.en.md)

[![Status](https://img.shields.io/badge/status-alpha--playable-c96442?labelColor=141413)](#-路線圖)
[![Live](https://img.shields.io/badge/▶_線上玩-chunyuhu.com%2Fink__scroll-c96442?labelColor=141413)](https://chunyuhu.com/ink_scroll/)
[![e2e](https://github.com/Chunyu-Hugh/ink_scroll/actions/workflows/e2e.yml/badge.svg)](https://github.com/Chunyu-Hugh/ink_scroll/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-5e5d59?labelColor=141413)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-6b8e6e?labelColor=141413)](CONTRIBUTING.zh-TW.md)
[![Discussions](https://img.shields.io/badge/💬-Discussions-7b8fa8?labelColor=141413)](../../discussions)

> 光照之處，墨色生輝

瀏覽器端互動水墨畫裝置。純 HTML/CSS/JS，零依賴建構，單檔案即可執行。

---

用攝像頭手電筒或手勢控制光圈，揭示隱藏在中國風水墨畫下的彩色動畫世界。墨線靜止，光圈內萬物生動。

> 🚧 **專案狀態:** Alpha — 骨架已搭好，正在向「標準社群專案」打磨。**歡迎一起來玩**：開 [issue](../../issues/new/choose) 提想法、去 [Discussions](../../discussions) 閒聊、看 [路線圖](#-路線圖) 找你想做的方向。

## ✨ 特性

**21 種互動方式，分三檔：** 11 種什麼都不用（機器自帶的鍵盤/觸摸/麥克風/攝像頭/陀螺儀）、7 種插個裝置、1 種本機跑個小腳本（OSC）。

### 🟢 無需任何裝置

| 模式 | 怎麼玩 |
|---|---|
| **自動展卷** | 什麼都不用做：畫卷自己緩緩展開，光在畫上遊走（展廳招徠循環） |
| **指標 · 觸屏** | 滑鼠、觸控板、手指、壓感筆。拖動揭示、**雙指捏合**改光圈、**雙擊**換場景、**長按**留痕；Wacom 的**筆壓＝筆鋒粗細** |
| **聲音 · 吟誦** | 對著麥克風哼一聲：**音高→左右**，**音色亮度→上下**，**響度→光圈大小**，**拍手→潑墨** |
| **傾斜 · 掌中** | 手機/平板傾斜即移光（進入時自動取零點，`C` 重設） |

### 📷 只用攝像頭

| 模式 | 怎麼玩 |
|---|---|
| **動影 · 皮影** | **零模型、零下載**：靠帧差，**身影掠過絹面**就顯出顏色 |
| **手勢 · 空手** | MediaPipe Hands：手心移動移光，食指收成細光束，握拳收光，✌️ 換場景 |
| **面龐 · 頭姿** | MediaPipe FaceMesh：**轉頭移光**、**張嘴放大**，不需列印任何標記 |
| **手電筒** | 手機閃光燈對準攝像頭，最亮點即光圈 |

### 🔧 需要一點準備

| 模式 | 需要 |
|---|---|
| **眼動 · 眼鏡** | 列印一張 ArUco 標記貼在眼鏡上 + 5 點校準（亞像素精度，詳見下文） |
| **手機 · 眾光** | 執行 `python3 server.py`，觀眾掃碼把自已手機變成一盞燈；**可多人同場** |
| **IR · 追蹤器** | OpenMV / Pixy2 + WebSerial（桌面 Chromium） |

### 🎨 除此之外

| | |
|---|---|
| **5 場景** | 山水、竹林、雪景、花鳥、星空 — AI 生成水墨畫 |
| **4 風格** | **紙本**（墨落宣紙，預設）· 墨線（暗房光束）· 素描 · 暗調 |
| **場景動畫** | 飛鳥、飄雪、花瓣、螢火蟲、流星……僅光圈內可見 |
| **附加效果** | 留痕 · 回墨呼吸 · 長曝 · 通靈生獸 · 鏡影雙修 · 天時入卷 · 擊節點墨 · 氛圍音 · 眾聲成墨 |
| **分享** | `S` 存一張帶題款與「印」的分享卡；`?mode=audio&scene=3` 這類**深鏈**開啟即自動開卷 |
| **無障礙** | 全鍵盤可玩、`aria-live` 播報、`prefers-reduced-motion`、`P` 靜觀暫停 |
| **三語介面** | 簡體 · 繁體 · English，自動偵測瀏覽器語言 |

## 🧪 測試與文件

```bash
node tools/test.js        # 86 條端對端斷言，真實瀏覽器
```

真實瀏覽器、真實攝像頭（假設備餵一張公有領域肖像與一段移動白條影片）、真實中繼：
11 個模式、手機↔大屏雙端聯調、三語鍵集合對齊、觸屏手勢、無障礙、深鏈與效能預算。
最近一次：**146 / 146 全綠**。

- [docs/INTERACTIONS.md](docs/INTERACTIONS.md) — 互動系統與註冊表契約（加新模式先看這）
- [docs/TEST-REPORT.md](docs/TEST-REPORT.md) — 稽核：發現了什麼、怎麼修的
- [docs/HARDWARE-TODO.md](docs/HARDWARE-TODO.md) — 需要外設的方向清單
- [docs/SELF-IMPROVEMENT.md](docs/SELF-IMPROVEMENT.md) — 評測器與自我改進循環

## 🛠 技術堆疊

**純瀏覽器端，零後端依賴。**

| 層 | 技術 |
|---|---|
| 渲染 | Canvas 2D API |
| 手勢 | [MediaPipe Hands](https://ai.google.dev/edge/mediapipe) (CDN) |
| 眼動 | [js-aruco2](https://github.com/damianofalcioni/js-aruco2) — 純 JS ArUco 標記偵測 (~26KB)，亞像素精度 + 自寫 3 參數線性回歸 |
| 攝像頭 | `getUserMedia` API |
| 邊緣偵測 | Sobel 運算元（手寫 JS 實作） |
| 字型 | Noto Serif SC / TC + EB Garamond (Google Fonts) |
| 圖片 | Grok (`grok-imagine-image`) 生成 |

舊版 Python + OpenCV 原型見 `archive/`。

## 🌐 線上玩

**<https://chunyuhu.com/ink_scroll/>** —— 打開就能玩，手機掃碼把自己變成一盞燈也行。
「手機 · 眾光」需要中繼，本地跑 `python3 server.py`。

## 🚀 快速開始

任何靜態檔案伺服器即可 —— 大多數模式都不需要後端：

```bash
cd web && python3 -m http.server 8888
# 打開：http://localhost:8888
```

想要「手機 · 眾光」（觀眾用手機當光圈），改用自帶的零依賴中繼：

```bash
python3 server.py 8888
# 大屏 http://localhost:8888   ·   手機掃描螢幕上的 QR
```

攝像頭與手機陀螺儀都需要 HTTPS（localhost 除外）。推薦 Tailscale：

```bash
tailscale serve --bg 8888
# 然後存取：https://your-machine.tailXXXXx.ts.net
```

## ⌨️ 快捷鍵

| 鍵 | 功能 |
|---|---|
| M | 切換模式 |
| ← → | 切換場景 |
| 1 / 2 / 3 | 風格：墨線 / 素描 / 暗調 |
| `[` `]` | 靈敏度 - / + |
| + / - 或滾輪 | 光圈大小 |
| R | 重設平滑 |
| C | 眼動模式下重新校準 |
| X | 鏡像翻轉 |
| F | 全螢幕 |
| Shift + D | 顯示 / 隱藏 FPS |
| Q / Esc | 退出 |

## 🏗 架構

```
web/
├── index.html        # 主應用 (~1770 行，零建構，含 i18n 字典)
└── scenes/           # 5 張 AI 生成場景圖
    ├── shanshui.jpg
    ├── bamboo.jpg
    ├── snow.jpg
    ├── flowers.jpg
    └── stars.jpg
```

### 渲染管線

```
1. 攝像頭幽靈圖層（15% 透明，畫區域內）
2. 墨線遮罩（Sobel 邊緣，場景切換時生成一次）
3. 光圈裁切 → 揭示彩色層（原圖 + 程序化動畫）
4. 赤陶色光圈環
5. 場景過渡淡入淡出
```

## 📐 設計系統

參見 [DESIGN.md](DESIGN.md)。

品牌色：羊皮紙 `#f5f4ed` · 赤陶 `#c96442` · 墨黑 `#141413`

## 👓 關於眼動 · 眼鏡模式

> **TL;DR：把「視線追蹤」問題降級成「頭部姿態追蹤」——給眼鏡貼一張 ArUco 標記紙**，亞像素級精度，零模型下載，整個追蹤函式庫只有 26KB。代價是要列印一張紙 + 戴眼鏡。

### 為什麼這麼做

經典的瀏覽器視線追蹤方案（WebGazer / iris-geometry / 深度模型）都有同一個問題：**精度有限**（典型 ~3–5° 誤差）+ **頭一動就崩**。這個專案是裝置藝術，需要光圈跟得準、使用者能正常移動頭部。

觀察：**人看東西時本來就主要靠轉頭**——眼球的微移只在很小範圍內偏離頭朝向。所以追蹤「頭朝向」已經能解決 95% 的「看哪揭哪」需求。

ArUco 標記是電腦視覺裡**專門為高精度追蹤設計的**：黑白方格 2D 碼，sub-pixel 偵測、對距離和角度都穩健、函式庫只要 26KB。把它貼在眼鏡上 → 追蹤它 = 追蹤頭部姿態 = 看起來像視線控制。

### 用的是什麼

| 層 | 做法 |
|---|---|
| 標記偵測 | [js-aruco2](https://github.com/damianofalcioni/js-aruco2) — 純 JS，~26KB，jsDelivr CDN，預設 ARUCO 字典，sub-pixel 精度 |
| 視線特徵 | ArUco 標記 4 個角點 → 取中心，歸一化到攝像頭座標 `(nx, ny) ∈ [0,1]²` |
| 螢幕座標映射 | 5 校準點（4 角 + 中心）× 每點 2 次點擊 → 10 組 `(nx, ny, 螢幕 x, y)` → 閉式 3×3 最小二乘擬合 |
| 鏡像處理 | App 鏡像翻轉開關不影響偵測：內部維護一個永不翻轉的副攝像頭畫布給 ArUco 用 |

**無 license key、無第三方 SDK、無模型下載（26KB JS 函式庫取代了之前的 ~3.6MB 模型）、無 WASM、無 SharedArrayBuffer**。程式碼全在 [`web/index.html`](web/index.html) 裡搜 `enterGaze` / `loadArUco` / `markerCenter` / `fitLinear` 這幾個函式。

### 怎麼準備（一種思路，5 分鐘搞定）

> 我這版用的是**最樸素的方案：一張 50mm 標記貼眼鏡鼻樑上**。技術問題就解決了——剩下全是**設計的空間**，見下一節。

1. **產生一張 ArUco 標記**：去 [chev.me/arucogen](https://chev.me/arucogen/)，字典選 **「Original ArUco」**，ID 選 0（任意都行），尺寸 **50mm**，**Save as PNG / Print**
2. **列印 + 剪下來**（普通 A4 紙即可）
3. **貼到眼鏡上**：眼鏡架正中（鼻樑上方）或鏡框左上角都行，**貼得牢靠 + 朝向攝像頭**
4. **保留這張眼鏡**——下次進眼動模式直接戴上就行

### 怎麼校準

1. 戴上眼鏡，**面對攝像頭**，**光線均勻**
2. 進入「眼動 · 眼鏡」模式（首次會從 jsDelivr 下 26KB 的 js-aruco2，1 秒內）
3. 出現 5 個圓點（4 角 + 中心）→ **自然地把頭/視線轉向每個圓點**再點擊，每點 2 次
4. 10 次點完，自動擬合 → 光圈開始跟眼鏡走
5. 覺得不準了，**按 `C` 重新校準**

### 🎨 設計空間：把它藏好的藝術

這是專案裡**最適合大家一起玩的部分**：技術不限制你了，**剩下的是怎麼把這塊標記藏得讓觀眾看不出來**。我提供一種樸素思路，歡迎你做得更好。

**可自訂的軸：**

| 軸 | 取值 | 取捨 |
|---|---|---|
| 大小 | 10mm – 80mm | 越大偵測距離越遠；10mm 大概要靠攝像頭 ~30cm 內，80mm 能從 1m+ 偵測到 |
| 數量 | 1 個起步 | 多個能冗餘抗遮擋；同時改一下程式碼（預設只用 `markers[0]`，改成所有角點平均） |
| 位置 | 鼻樑 / 鏡框角 / 鏡腿 / 帽簷 / 服裝 | 越往臉兩側越隱蔽，但頭轉角度大時容易出攝像頭視野 |
| 字典 | `ARUCO` (預設，5×5 1024 個 ID) / `ARUCO_MIP_36h12` (更穩健) | 預設夠用；只在嫌偵測易抖時換 |

**幾個把「標記」偽裝成別的玩法：**

- 👓 **眼鏡款式**：貼在眼鏡腿後面（戴上去看不見 marker，但側面攝像頭能掃到——配合斜側機位）
- 💍 **首飾款**：胸針、領針、耳釘、髮夾、戒指上的「圖案」 — marker 不必長得像 marker
- 🎩 **道具款**：帽簷內側（脫帽 = 關閉追蹤？）、領帶、扇子的扇骨 — 實際上控的「不是你頭」而是「你手裡/身上的東西」
- 🖌 **裝飾款**：水墨牆上的「印章」、畫框上的紋飾 — marker 直接長在場景裡
- 🎭 **多 marker 陣列**：4 個小 marker 排成菱形當裝飾圖案，互相冗餘、單個被擋仍可工作

**改程式碼的位置：**

| 想改 | 改 `web/index.html` 裡的 |
|---|---|
| 校準點數量/位置 | `CALIB_POINTS` 常數（預設 4 角 + 中心 5 點） |
| 每點點擊次數 | `CLICKS_PER_DOT`（預設 2） |
| ArUco 字典 | `new AR.Detector({dictionaryName:'ARUCO_MIP_36h12'})` |
| 多 marker 自動平均 | `M.gaze.spot` 裡把 `markers[0]` 改成對所有 markers 角點平均 |
| 平滑強度 | `spot` 裡那個 `const a=0.45`（越大越緊跟、越抖；越小越平滑、越拖） |

**想 PR / 曬你的眼鏡設計 / 提新玩法 → [Discussions](../../discussions) 或 [開 issue](../../issues/new?template=new_modality.md)**。這是裝置藝術作品，**形式 = 內容的一部分**。

### 精度老實話

ArUco 偵測本身是 sub-pixel 的（**比 iris-geometry 準一個量級**），所以光圈應該跟得相當緊。

可能會變差的情境：
- **標記被遮擋** — 頭側太多、被頭髮擋住、被手擋住 → 偵測不到，光圈會停在最後一次的位置
- **標記反光 / 攝像頭髒** — 攝像頭看不清黑白方格 → 偵測失敗
- **校準時只是「看」而沒轉頭** — ArUco 追的是頭部姿態，光看不轉頭的話 5 個校準點都幾乎在同位置，回歸會奇異（finishCalibration 會報錯重來）
- **離攝像頭太遠** — 標記在攝像頭裡太小（< ~30px），ArUco 偵測不到

### 我沒做的事（未來可能升級）

- **多個標記 + 單應變換** — 4 個標記一組 → 8 個角點 → 擬合 homography，對透視更穩健
- **同時追蹤頭部姿態 + 實際眼球**（FaceMesh iris 作精修）— 轉頭 + 眼球微動都覆蓋
- **產生專用標記**（在頁面裡直接畫出來供你列印）— 免去去 chev.me 那一步

想 PR 這些？開 issue 聊。

## 🔮 路線圖

> **更新：** 免外設四件套（自動展卷 / 指標+觸屏 / 聲音 / 傾斜）、零模型動影、FaceMesh 頭姿、
> 以及手機眾光中繼都**已實作並由測試覆蓋**。剩下的是外設清單 —— 見
> [docs/HARDWARE-TODO.md](docs/HARDWARE-TODO.md)。下方保留最初的研究筆記。

**原始構想：IR 手電筒 + Wii Remote** — Johnny Lee 那種裝置藝術裡的經典做法。Wiimote 內建 IR 攝像頭硬體 blob tracking，100Hz、亞像素、對環境光免疫。當前的 webcam 模式只是該願景的過渡實作。

下面是為這個「光圈揭示」作品調研過的所有可行輸入方式。✅ = 純瀏覽器 · ⚠️ = 需 native bridge

### 🟢 純瀏覽器候選

| 類別 | 方式 | 映射 | 關鍵 API |
|---|---|---|---|
| 指向 | **IR webcam + IR LED 手電** | 現有亮點偵測直接複用 | (no change) |
| | **Wiimote (WebHID)** | IR 攝像頭 → XY，加速度 → 半徑 | `wiimote-webhid` |
| | Joy-Con (WebHID) | 搖桿 + 陀螺儀 | `joy-con-webhid` (Tomayac) |
| | **Wacom 數位板** | 筆位置 + **筆壓 = 半徑** | HTML5 Pointer Events |
| | 雷射筆 + webcam | HSV 偵測紅/綠點 | DIY |
| | AR 標記 (ArUco/AprilTag) | 列印紙標記當「燈籠」 | `js-aruco2` |
| | 遊戲手把 (Xbox/PS) | 搖桿 + 扳機 | Web Gamepad API |
| | SpaceMouse 6DoF | 6 軸推桿 | `spacemouse-webhid` |
| 身體 | **MediaPipe Pose 全身** | 手腕座標 + 肩寬 = 半徑 | `@mediapipe/tasks-vision` |
| | MediaPipe FaceMesh | 鼻尖 + 張嘴 = 半徑 | 同上 |
| | WebGazer 視線追蹤 | 看哪揭哪 | `WebGazer.js` |
| 手機 | **手機當魔杖** | 陀螺儀 + WebRTC，QR Code 配對 | DeviceOrientation API + PeerJS |
| | 手機當觸控板 | 遠端觸控 | 同上 + `touchmove` |
| 音訊 | 音量 → 半徑 | 吹 / 吼 / 拍手 | Web Audio `AnalyserNode` |
| | **呼吸偵測** | 吸氣放大、呼氣收縮 | Web Audio band-pass |
| | 哨音音高 | 音高對應 X 軸 | `pitchy` |
| | 語音指令 | 「揭示」、「放大」 | Web Speech API (Chromium) |
| 專業 | Web MIDI | nanoKONTROL / Launchpad 推桿 | Web MIDI API |
| | OSC over WebSocket | TouchDesigner / Max 推資料 | `osc-js` |
| 生理 | rPPG 心率 | 心跳脈動光圈 | `heartbeat-js` |
| | Muse EEG (BLE) | α 波 → 越靜畫卷開越大 | `web-muse` |
| 其他 | Pixy2 / OpenMV (Web Serial) | 板載 blob 追蹤 | Web Serial API |

### 🟡 需 native bridge

| 方式 | 優勢 |
|---|---|
| Kinect v2 / Azure Kinect | 全身骨架 + 深度 (Azure EOL) |
| Intel RealSense / OAK-D | 深度遮罩做手掌剪影 |
| Leap Motion / Ultraleap | 手部骨架精度最高 |
| Tobii 眼動儀 | 真正的高精度視線 |
| FLIR Lepton 熱像儀 | 全黑環境也能用 |

### ⭐ 最貼合本專案氣質的 5 個方向

每個方向下面都列了需要的技術堆疊，方便想動手的同學心裡有數。「難點」是實作時最容易卡的那一步。

#### ① IR webcam + IR LED 手電

兌現 Johnny Lee 原始願景的最短路徑。**程式碼零修改**——把環境可見光過濾掉之後，現有的亮點偵測立刻變成 IR 追蹤。

- **技術堆疊:** 現有 `getUserMedia` + `spF()` 直接複用
- **硬體:** 一個舊 webcam（拆 IR-cut filter）+ 一片沖洗過的底片當 IR-pass + 一個 IR LED 手電（亞馬遜 ~$10）
- **難點:** 拆機不可逆；要找合適厚度的 IR-pass 濾片
- **狀態:** 尋找願意拆 webcam 的人

#### ② Wacom 筆壓 = 半徑

水墨畫 + 筆壓，主題與機制天然閉環。**純前端，無新依賴**——HTML5 Pointer Events 直接給你筆壓值。

- **技術堆疊:** `pointermove` 事件 + `e.pressure` (0–1)
- **硬體:** 任何 Wacom / XP-Pen / Huion / iPad+Apple Pencil
- **難點:** iPad Safari 的 PointerEvent.pressure 歷史上不穩定，需要測試
- **狀態:** 準備動手的人來 PR

#### ③ 呼吸 + 全身姿態

吸氣放大、呼氣收縮；手腕座標驅動光圈位置。**全沉浸雙模態、手不離身、純瀏覽器。**

- **技術堆疊:**
  - 呼吸: Web Audio `AudioContext` + `BiquadFilterNode`（0.1–0.5 Hz 帶通）+ `AnalyserNode` RMS 包絡
  - 姿態: `@mediapipe/tasks-vision` 的 `PoseLandmarker`（CDN），複用現有 `wkCvs` 攝像頭畫面
- **硬體:** 筆電麥克風 + 攝像頭（已有）
- **難點:** 畫廊噪音環境下呼吸訊噪比；MediaPipe Pose 比 Hands 重一些 (~30fps on M1)
- **狀態:** 我自己想做的下一個

#### ④ 手機當魔杖（WebRTC + QR 配對）

觀眾掃碼把自己的手機變成魔杖，揮動手機控制光圈。**畫廊場景最實用**——觀眾自備硬體。

- **技術堆疊:**
  - 大螢幕: 現有頁面 + WebRTC `RTCDataChannel`
  - 手機端: 同源 mobile-friendly 子頁面，讀 `deviceorientation` (`alpha/beta/gamma`)
  - 配對: PeerJS 公共 broker (省去自建信令) + `qrcode-generator` 生成 QR Code
- **硬體:** 觀眾的手機 + 大螢幕端的電腦
- **難點:** iOS 14+ 要 `DeviceOrientationEvent.requestPermission()`，必須由使用者手勢觸發；首次連線的 ICE 協商時機
- **狀態:** 尋找熟悉 WebRTC 的同學一起做

#### ⑤ OSC from TouchDesigner

讓策展人/營運在不動程式碼的情況下，用 TouchDesigner 的 patch 即時調光圈位置、半徑、場景切換。**裝置藝術圈標準做法。**

- **技術堆疊:**
  - 瀏覽器端: WebSocket client + `osc-js` 解碼 OSC bundle
  - TD 端: WebSocket DAT 節點，發送 `/spot/x`、`/spot/y`、`/spot/r`、`/scene/next` 等位址
  - 可選: 同一介面也能接 Max/MSP / SuperCollider / Pure Data
- **硬體:** 裝 TouchDesigner 的電腦（免費個人版即可）
- **難點:** OSC 是無連線的，丟封包要自己處理；建議加平滑
- **狀態:** 我會畫一個最小 TD patch 當 demo

---

## 🤝 加入

骨架已經寫好（一個 ~1370 行的 `web/index.html`、5 張場景、3 種互動模式、3 種語言介面跑起來了），但**真正有意思的部分需要更多人一起玩**——上面那張路線圖表裡任何一行，只要有人想做，我都可以陪著 review。

### 不寫程式碼也能貢獻

| 我能 | 怎麼做 |
|---|---|
| 提一個新互動方式 | 開 [New Interaction Modality issue](../../issues/new?template=new_modality.md) |
| 報 bug | 開 [Bug report](../../issues/new?template=bug_report.md) |
| 提小改進 | 開 [Feature request](../../issues/new?template=feature_request.md) |
| 閒聊、問問題、曬成品 | [Discussions](../../discussions) |
| 貢獻水墨場景圖 | 見 [CONTRIBUTING.zh-TW.md → 場景圖](CONTRIBUTING.zh-TW.md#-場景圖) |
| 翻譯到其他語言 | 開 issue 提議 |

### 寫程式碼貢獻

Fork → PR。詳細約定見 [CONTRIBUTING.zh-TW.md](CONTRIBUTING.zh-TW.md)。**核心規則只有一條**：保持「單檔案、零建構、零框架」。新增 CDN 單檔案函式庫 OK，新增 webpack 不 OK。

行為準則：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
安全問題：[SECURITY.zh-TW.md](SECURITY.zh-TW.md)

不吝賜教。

## 📄 License

MIT — 隨便改、隨便商用。

有問題聯絡：[Hugh](https://github.com/Chunyu-Hugh)

詳見 [LICENSE](LICENSE)。
