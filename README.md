# 墨卷 · Ink Scroll

**简体中文** · [繁體中文](README.zh-TW.md) · [English](README.en.md)

[![Status](https://img.shields.io/badge/status-alpha--playable-c96442?labelColor=141413)](#-路线图)
[![Live](https://img.shields.io/badge/▶_在线玩-chunyuhu.com%2Fink__scroll-c96442?labelColor=141413)](https://chunyuhu.com/ink_scroll/)
[![e2e](https://github.com/Chunyu-Hugh/ink_scroll/actions/workflows/e2e.yml/badge.svg)](https://github.com/Chunyu-Hugh/ink_scroll/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-5e5d59?labelColor=141413)](LICENSE)
[![Tests](https://img.shields.io/badge/e2e-141%20passing-6b8e6e?labelColor=141413)](docs/TEST-REPORT.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-6b8e6e?labelColor=141413)](CONTRIBUTING.md)

> 光照之处，墨色生辉

浏览器端交互水墨画装置。纯 HTML/CSS/JS，零依赖、零构建，单文件即可运行。

一幅**墨色立轴**覆在一幅**彩色山水**之上。你手里那盏光落在哪里，哪里的墨就化开、显色、活过来。

**29 种交互方式**，分档：**13 种什么都不用**、**5 种只用摄像头**、**9 种插个装置**（手柄/MIDI/HID 摇杆/蓝牙/NFC/手机/串口/打印标记）、
**2 种本机跑个小脚本**（OSC、外设桥）。

---

## ✨ 交互一览

### 🟢 无需任何设备（开箱即玩）

| 模式 | 怎么玩 |
|---|---|
| **自动展卷** | 什么都不用做：画卷自己缓缓展开，光在画上游走（展厅/展台的招徕循环） |
| **指针 · 触屏** | 鼠标、触控板、手指、压感笔。拖动揭示，**双指捏合**改光圈，**双击**换场景，**长按**留痕；Wacom 的**笔压 = 笔锋粗细** |
| **声音 · 吟诵** | 对着麦克风哼一声：**音高 → 左右**，**音色亮度 → 上下**，**响度 → 光圈大小**，**拍手 → 泼墨** |
| **倾斜 · 掌中** | 手机/平板倾斜即移光（进入时自动取零点，`C` 重设） |
| **键盘 · 无鼠标** | 方向键 / WASD 带惯性移动光圈，`Shift` 加速，`Space` 泼墨——**完全不用鼠标**（无障碍主干、演示、展台） |
| **多指 · 大屏** | 触摸大屏上**每一根手指都是一盏灯**（最多 6 盏），双指捏合改光圈 |
| **笔锋 · 压感** | Wacom / iPad / USI 笔：**压感 = 光圈大小**，按得越重越亮 |
| **凝视 · 停留** | 光标停在某处**不动 1.4 秒** → 泼墨 + 换画（不用点击，手抖也能用） |
| **吐纳 · 呼吸** | 只取麦克风的**低频包络**：吸气光圈张开、呼气收拢（不看音高，嘈杂环境更稳） |
| **语音 · 题字** | 说「山水 / 竹林 / 雪 / 花鸟 / 星空」换画，说「大 / 小 / 留痕 / 泼墨」调画 |
| **摇一摇** | 摇手机 → 泼墨 + 振动（手机自带加速度计，不需要摄像头） |
| **拍手 · 节拍** | 拍一下手泼墨、连拍两下换画（只要麦克风） |
| **环境光** | 房间越暗，光圈越大（`AmbientLightSensor`，桌面 Chrome 少见） |

### 📷 只用摄像头

| 模式 | 怎么玩 |
|---|---|
| **动影 · 皮影** | **零模型、零下载**：靠帧差，**身影掠过绢面**就显出颜色——皮影戏 |
| **手势 · 空手** | MediaPipe Hands：手心移动移光，食指收成细光束，握拳收光，✌️ 换场景 |
| **面庞 · 头姿** | MediaPipe FaceMesh：**转头移光**，**张嘴放大**。不需要打印任何标记 |
| **眨眼 · 眼睛** | 同一个 FaceMesh：**每眨一次眼泼一次墨**（EAR 眼宽高比，阈值 0.19/0.26） |
| **手电筒** | 手机闪光灯对准摄像头，最亮点即光圈 |

### 🔧 需要一点准备

| 模式 | 需要 |
|---|---|
| **眼动 · 眼镜** | 打印一张 ArUco 标记贴在眼镜上 + 5 点校准（亚像素精度，详见下文） |
| **手机 · 众光** | 跑 `python3 server.py`，观众扫码把自己手机变成一盏灯；**可多人同时在场** |
| **IR · 追踪器** | OpenMV / Pixy2 + WebSerial（桌面 Chromium） |
| **手柄** | 任意标准手柄（Xbox / PS / Switch Pro）：左摇杆移光，RT/LT 改光圈，A 换场景、B 泼墨、Y 留痕 |
| **MIDI** | 任意 MIDI 控制器：CC1/CC2 移光，CC7 改光圈，音符换场景，鼓垫泼墨 |
| **HID** | WebHID：Joy-Con / Wiimote / 任意 DIY 摇杆。任天堂设备按报告解析，其他走"前 3 字节 = x,y,r"万能协议 |
| **蓝牙** | Web Bluetooth：心率带 / Muse EEG / ESP32。心率直接驱动光圈，任意 notify 特征按 x,y,r 解析 |
| **NFC** | Web NFC（Chrome Android）：把贴纸靠近手机换画 |

### 🖥 本机装个小脚本（最省事的专业接入）

| 模式 | 需要 |
|---|---|
| **OSC · 本地** | `python3 server.py`（零依赖，自带 UDP 9000 的 OSC 入口）→ TouchDesigner / Max / Pure Data / python-osc 直接发 `/spot` |
| **外设桥 · 本地** | 任意本地脚本（Leap / Kinect / RealSense / Tobii / 热像仪 / EEG）`POST /send?room=ext` 就能驱动 —— 外设 SDK 只要会发 HTTP |

## 🖼 内容层

| 内容 | 说明 |
|---|---|
| 5 张水墨画 | `web/scenes/*.jpg`，`cover` 全幅出血 + 预缩放缓存 |
| **3D 视差立轴** | 第 6 张是**程序化**的三层山脊视差 + 雾带：不依赖素材就有景深，随光移动分层错开 |
| **视频层** | `?video=<url>` 把任意 mp4/webm 当彩色层，墨层从当前帧生成 |

### 🎨 除此之外

| | |
|---|---|
| **5 场景** | 山水 · 竹林 · 雪景 · 花鸟 · 星空（AI 生成水墨原画） |
| **4 风格** | **纸本**（墨落宣纸，默认）· 墨线（暗房光束）· 素描 · 暗调 |
| **场景动画** | 飞鸟、飘雪、花瓣、萤火虫、流星……只在光圈内可见 |
| **附加效果** | 留痕 · 回墨呼吸 · 长曝 · 通灵生兽 · 镜影双修 · 天时入卷 · 击节点墨 · 氛围音 · 众声成墨 |
| **分享** | `S` 存一张带题款与「印」的分享卡；`?mode=audio&scene=3` 这样的**深链**打开即自动开卷 |
| **无障碍** | 全键盘可玩、`aria-live` 播报、`prefers-reduced-motion`、`P` 静观暂停 |
| **三语界面** | 简体 · 繁體 · English，自动检测浏览器语言 |

## 🌐 在线玩

**<https://chunyuhu.com/ink_scroll/>** —— 打开就能玩，手机扫码把自己变成一盏灯也行。
"手机 · 众光" 需要中继，本地跑 `python3 server.py`。

## 🚀 快速开始

任何静态服务器都行——绝大多数模式都不需要后端：

```bash
cd web && python3 -m http.server 8888
# 打开 http://localhost:8888
```

想要「手机 · 众光」（观众用手机当光圈），用自带的极简中继（零依赖）：

```bash
python3 server.py 8888
# 大屏 http://localhost:8888   ·   手机扫屏幕上的二维码
```

摄像头和手机陀螺仪都要求 **HTTPS 或 localhost**。局域网演示最省事的办法是 Tailscale：

```bash
python3 server.py 8888 &
tailscale serve --bg 8888
# 访问 https://your-machine.tailXXXXx.ts.net
```

## 🖥 屏幕自适应

同一件作品应该顺着屏幕来：

| 屏幕 | 默认模态 | 为什么 |
|---|---|---|
| 手机 / 平板 | **多指**（每根手指一盏灯） | 触摸屏最自然的是"直接碰"，不需要摄像头也无需授权 |
| 大屏 / 展墙（≥1600px 且高 ≥900） | **自动展卷** | 没人操作时自己展卷招呼路人 |
| 笔记本 / 台式 | **指针** | 光标跟随 + 滚轮/捏合改光圈 |

光圈大小、控制栏、HUD 都按视口与 DPR 换算（`radiusBounds()`、`computeDPR()`），
横竖屏切换、投影、4K 墙都只是同一个公式的不同取值。

## 🎛 OSC / TouchDesigner 接入

```bash
python3 server.py            # 静态服务 + SSE 中继 + UDP 9000 的 OSC 入口
```

TouchDesigner：CHOP → **OSC Out**，Network Port `9000`，Address 用 `/spot`：

| 地址 | 参数 | 作用 |
|---|---|---|
| `/spot` | `f f` 或 `f f f` | x, y（0–1），可选半径 |
| `/spot/x` `/spot/y` `/spot/r` | `f` | 单轴微调 |
| `/scene` | `i` | 0–4 换画 |
| `/style` | `i` | 0 墨线 1 素描 2 暗调 3 纸本 |

任何语言都能发：`curl -X POST 'http://127.0.0.1:8888/osc' -d '{"x":0.4,"y":0.6,"r":0.3}'`

## ⌨️ 快捷键

| 键 | 功能 | 键 | 功能 |
|---|---|---|---|
| `M` | 切换模式 | `H` | 直接进手势模式 |
| `← →` `Space` | 切换场景 | `1 2 3 4` | 风格：墨线/素描/暗调/纸本 |
| `+` `-` / 滚轮 | 光圈大小 | `[` `]` | 摄像头灵敏度 |
| `X` | 镜像翻转 | `R` | 重置平滑 |
| `I` | 留痕 | `O` | 回墨呼吸 |
| `G` | 长曝留痕 | `S` | 存分享卡 PNG |
| `K` | 通灵生兽 | `Y` | 镜影双修 |
| `T` | 天时入卷 | `B` | 击节点墨 |
| `A` | 氛围音 | `U` | 众声成墨（大屏麦克风） |
| `P` | 静观（暂停动画） | `C` | 眼动重新校准 / 倾斜重设零点 |
| `F` | 全屏 | `?` | **全部玩法面板** |
| `Q` `Esc` | 退出 | `Shift+D` | 显示 FPS |

**触屏**：拖动揭示 · 双指捏合改光圈 · 双击换场景 · 长按留痕 · 右下角控制栏可完成全部操作。

## 🏗 架构

```
ink_scroll/
├── web/
│   ├── index.html      # 主应用（单文件：样式 + i18n + 引擎，零构建）
│   ├── phone.html      # 手机控制器（扫码即用，把手机变成一盏灯）
│   └── scenes/         # 5 张 AI 生成场景图（.jpg）
├── server.py           # 极简 SSE 中继 + 静态服务器（stdlib，零依赖）
├── docs/
│   ├── INTERACTIONS.md # 交互系统与注册表契约（加新模态看这里）
│   ├── HARDWARE-TODO.md# 需要外设的方向（给想动手的人）
│   ├── TEST-REPORT.md  # 审核与测试报告
│   └── SELF-IMPROVEMENT.md # 评测器与自我改进循环
├── tools/test.js       # 141 条端到端断言（Playwright，真实浏览器）
└── archive/            # 旧版 Python + OpenCV 原型
```

### 渲染管线

```
1. 摄像头幽灵图层（15%，只在画区域内）
2. 墨层（Sobel / 素描 / 暗调 / 纸本，切换场景时生成一次，≤1.25MP 预算）
3. 光圈裁剪 → 揭示彩色层（原图 + 程序化动画）
4. 光圈环（内侧赤陶 + 外侧中性深线，两种风格下都读得出来）
5. 场景过渡淡入淡出
```

所有输入模态都归一到同一个数据形状 `{x, y, radius}`，渲染层不知道光从哪来——
这也是为什么加一个新交互只需要在 `M` 注册表里加一条。

## 🧪 测试

```bash
node tools/test.js
```

真浏览器、真摄像头（假设备喂一张公有领域肖像 + 一段移动白条视频）、真中继：

- 11 个模态逐个进入，失败路径必须能回落
- 手机↔大屏双端联调（扫码 → 拖动 → 换场景 → 泼墨）
- 三语键集合必须完全对齐（差一个就红）
- 触屏手势、无障碍（role / aria-live / 焦点陷阱 / reduced-motion）、深链、性能预算
- 退出必须释放摄像头

最近一次：**141 / 141 通过**。详见 [docs/TEST-REPORT.md](docs/TEST-REPORT.md)。

## 📐 设计系统

参见 [DESIGN.md](DESIGN.md)。品牌色：羊皮纸 `#f5f4ed` · 赤陶 `#c96442` · 墨黑 `#141413`。
图标是 24×24 内联 stroke SVG（不用 emoji——它在不同系统上会变成方块）。

## ✋ 手势模式细节

按 `H` 进入，用本机摄像头。

- **挪手移光圈**：手的位置直接驱动光圈。
- **手势命令**（右侧大字图例实时高亮当前手势）：🖐 张开 = 正常光圈 · ☝️ 食指 = 聚成细光束 ·
  ✊ 握拳 = 收光（手离开画面才恢复）· ✌️ = 换场景。
- **为什么准**：判定用「指尖到手腕的距离」而不是「指尖高于关节」，所以**手歪着也准**（抗旋转）；
  摄像头画幅按真实比例裁剪铺满，任意分辨率都能让手和光圈对上（`[` `]` 调灵敏度，`X` 镜像）。

## 👓 眼动 · 眼镜模式细节

> **TL;DR**：把"视线追踪"降级成"头部姿态追踪"——给眼镜贴一张 ArUco 标记纸。
> 亚像素精度、零模型下载，追踪库只有 26KB。代价是要打印一张纸 + 戴眼镜。
>
> **不想打印？** 直接用 **面庞 · 头姿**（MediaPipe FaceMesh，转头移光、张嘴放大）——
> 同一个"用头玩"的想法，零准备。

1. 去 [chev.me/arucogen](https://chev.me/arucogen/) 生成一张 **Original ArUco**、ID 0、50mm 的标记并打印
2. 贴在眼镜鼻梁上方或镜框左上角，朝向摄像头
3. 进入「眼动 · 眼镜」，依次把头/视线转向 5 个圆点并点击（每点 2 次）
4. 自动拟合 3×3 最小二乘映射 → 光圈开始跟眼镜走；不准就按 `C` 重校准

**设计空间**：标记不必长得像标记——可以是胸针、领针、帽檐内侧、扇骨、画框上的"印章"。
大小 10–80mm 权衡检测距离；多个标记可冗余抗遮挡。
改代码的位置：`CALIB_POINTS`、`CLICKS_PER_DOT`、`new AR.Detector({dictionaryName})`、`spot()` 里的 `a=0.45`。

**精度老实话**：ArUco 检测是 sub-pixel 的，比 iris-geometry 准一个量级。
会变差的场景：标记被遮挡 / 反光 / 校准时只"看"不"转头"（回归会奇异）/ 离摄像头太远（< ~30px）。

## 🔮 路线图

- ✅ **免外设四件套**：自动展卷、指针+触屏（含笔压）、声音、倾斜
- ✅ **零模型动影** + **FaceMesh 头姿**（不需要打印标记的"用头玩"）
- ✅ **手机众光**：`server.py` + `phone.html`，多人同场
- 🚧 外设方向（笔倾斜飞白、游戏手柄、Web MIDI、Wiimote、OSC/TouchDesigner、深度相机、EEG…）
  → 完整清单与可复用库见 **[docs/HARDWARE-TODO.md](docs/HARDWARE-TODO.md)**
- 🚧 更多场景图、更多语言、展厅模式（自动轮播 + 无人自动复位）

## 🤝 加入

骨架已经跑起来了，**真正有意思的部分需要更多人一起玩**。

| 我能 | 怎么做 |
|---|---|
| 提一个新交互方式 | 开 [New Interaction Modality issue](../../issues/new?template=new_modality.md) |
| 报 bug / 提建议 | [Bug report](../../issues/new?template=bug_report.md) · [Feature request](../../issues/new?template=feature_request.md) |
| 闲聊、问问题、晒成品 | [Discussions](../../discussions) |
| 贡献水墨场景图 | 见 [CONTRIBUTING.md](CONTRIBUTING.md) |
| 翻译到其他语言 | 开 issue 提议（三语字典在 `web/index.html` 的 `I18N`） |
| 写代码 | Fork → PR。**核心规则只有一条**：单文件、零构建、零框架 |

行为准则：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · 安全问题：[SECURITY.md](SECURITY.md)

## 📄 License

MIT — 随便改、随便商用。场景图由 AI 生成。

联系：[Hugh](https://github.com/Chunyu-Hugh)
