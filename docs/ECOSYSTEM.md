# 生态接入图谱 · What can drive Ink Scroll

墨卷对外只有 **一条数据契约**：`{x, y, r, scene, style, cmd}`。谁能把数据变成
OSC / HTTP / postMessage 三者之一，谁就能驱动它。这一页是能接的软件清单。

> 状态列：✅ = 我们实测过；○ = 协议层面必然可用（未逐个装过）；— = 需要桥

## 1. AV / 演出 / 投影映射（OSC 原生，最主流）

| 软件 | 平台 | 通道 | 状态 |
|---|---|---|---|
| **TouchDesigner** | Win/mac | OSC Out CHOP → 9000 → `/spot` | ✅ 报文形状 7/7 实测 |
| **Resolume Arena / Avenue** | Win/mac | 内置 OSC Out → 9000 | ○ |
| **VDMX** | mac | OSC 插件 | ○ |
| **MadMapper** | Win/mac | OSC 输入 | ○ |
| **Millumin** | mac | OSC | ○ |
| **Pixera (AV Stumpfl)** | Win | OSC | ○ |
| **disguise (d3)** | Win | OSC（需启用） | ○ |
| **Hippotizer** | Win | OSC | ○ |
| **Smode** | Win | OSC | ○ |
| **Ventuz** | Win | OSC | ○ |
| **Notch** | Win | 经 TD/Unreal 转 OSC | — |
| **QLab** | mac | OSC（原生，演出控制） | ○ |
| **Modul8 / ArKaos** | mac/win | 有限 OSC / MIDI | — |
| **WATCHOUT** | Win | 无 OSC（只能时间线） | — |

## 2. 创意编程 / 生成艺术

| 软件 | 通道 | 状态 |
|---|---|---|
| **Max/MSP** | `udpsend` / `MXJ` → 9000（`odot` 库更省事） | ○ |
| **Pure Data** | `netsend -u -b` / `oscparse` | ○ |
| **vvvv** | `OSCEncoder` / `OSCClient` | ○ |
| **Processing** | `oscP5` 或直接 HTTP `loadStrings` | ○ |
| **openFrameworks** | `ofxOsc` / `ofxHttp` | ○ |
| **p5.js** | `postMessage` 或 `window.InkScroll` | ✅ 有断言 |
| **Hydra** | 同 p5（postMessage） | ○ |
| **Cables.gl** | 导出页 iframe + postMessage | ○ |
| **three.js** | `window.InkScroll.spot()` | ○ |
| **Houdini** | Python（`requests`）或 CHOP OSC | ○ |
| **Cinder / openrndr** | OSC | ○ |
| **Blender** | bpy → HTTP；或 NodeOSC 插件 → 9000 | ✅ 真机 4.2.3 实测 |
| **Rhino / Grasshopper** | GhPython → HTTP（Firefly 可接 Arduino） | ○ |
| **Cinema 4D / After Effects** | Python/JSX 脚本 → HTTP | ○ |
| **Figma** | 插件 `fetch` → HTTP（非实时，适合预演） | ○ |

## 3. 游戏引擎（3D 场景里的"光"）

| 引擎 | 通道 | 状态 |
|---|---|---|
| **Unreal** | 官方 OSC 插件 → 9000 | ○ |
| **Unity** | extOSC / Klak OSC → 9000 | ○ |
| **Godot** | `godot-osc` 插件 | ○ |
| **three.js / Babylon.js** | 网页内 postMessage | ○ |

## 4. 音乐 / 声音（音频分析驱动光圈）

| 软件 | 通道 | 状态 |
|---|---|---|
| **Ableton Live** | Max for Live（Connection Kit / TDAbleton）→ OSC | ○ |
| **Bitwig** | DrivenByMoss → OSC | ○ |
| **Reaper** | **原生 OSC**（Preferences → Control/OSC/web） | ○ |
| **Ardour** | 原生 OSC | ○ |
| **SuperCollider** | `OSCdef` / `NetAddr` | ○ |
| **Sonic Pi** | `osc_send` | ○ |
| **Traktor / Serato** | 无 OSC（走 MIDI → 桥） | — |

## 5. 演出控制 / 无需写代码

| 工具 | 用途 | 状态 |
|---|---|---|
| **Chataigne** | 可视化把任意输入映射成 OSC | ○ |
| **OSC/Pilot** | 触摸面板当前端 | ○ |
| **TouchOSC / Lemur** | 平板当调光台 | ○ |
| **Bitfocus Companion** | Stream Deck 按钮 → OSC | ○ |
| **Node-RED** | `node-red-contrib-osc` 编排一切 | ○ |
| **n8n / Zapier** | HTTP webhook → `/send?room=ext` | ○ |
| **Home Assistant** | 自动化触发 HTTP | ○ |

## 6. 硬件 / 嵌入式（观众与空间）

| 硬件 | 通道 | 状态 |
|---|---|---|
| **Arduino / ESP32 / Teensy** | `OSC` 库（UDP）或 HTTP | ○ |
| **Raspberry Pi** | `python-osc` / `requests` | ○ |
| **DMX / Art-Net 灯具** | QLC+ / OLA 做桥 → OSC | — |
| **Philips Hue** | 桥 HTTP（反向：灯跟着光圈变色） | ○ |
| **Leap Motion / Kinect / RealSense / Tobii** | 本地 SDK → `/send?room=ext` | ○（bridge 模式已就绪） |
| **心率带 / Muse EEG / Flic 按钮** | Web Bluetooth / HTTP | ○（ble 模式已就绪） |
| **MIDI 控制器 / 手柄 / HID** | 浏览器直连 | ✅ 已实现并有断言 |

## 7. 观众侧（"做大"的关键）

| 方式 | 通道 | 状态 |
|---|---|---|
| **观众手机当光圈** | `server.py` + 扫码 | ✅ 端到端实测 |
| **直播弹幕 / 聊天** | Twitch/YouTube → 桥 → HTTP | — |
| **Slack / Discord / Telegram 机器人** | HTTP | ○ |
| **NFC 贴纸 / 二维码卡** | 手机 NFC | ✅ nfc 模式 |
| **AI agent 当"导演"** | 任何 LLM 脚本 → HTTP（发 scene/x/y） | ○ |

## 8. 缺口（想接但需要写桥）

- **WATCHOUT / Modul8 / ArKaos**：没有可用 OSC，需要 MIDI→OSC 桥
- **Traktor / Serato**：同上（MIDI 桥）
- **After Effects 实时**：AE 不是实时引擎，只能"导出关键帧 → 脚本回放"
- **深度相机 / 眼动仪**：SDK 是本地库，必须用 `bridge` 模式转发

## 9. 想把项目做大，优先做这四件事

1. **发布协议规范页**（`docs/INTERACTIONS.md` 已有一半）+ 一个 `osc-spec` 单页
2. **两个可安装适配器**：TouchDesigner `.tox` 组件、Blender add-on（比脚本更容易被采纳）
3. **模板包**：Ableton Live Set、TD 工程、Resolume 预设、Chataigne 工程 —— 每个都是"点开就能用"
4. **"Drive it from anything" 文档**：六种语言的 5 行示例（Python / JS / C# / Max / PD / shell）

> 判断标准很简单：**别人接进来要不要读我们的源码？** 不要，才叫生态。
