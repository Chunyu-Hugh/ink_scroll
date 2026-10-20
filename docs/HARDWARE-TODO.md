# 外设 TODO · Hardware Wishlist

「墨卷」的核心契约只有一件事：**给我一个 `{x, y, radius}`**。所以任何能产生这两维坐标的设备都可以插进来。

下面按「值得做的顺序」排列。状态列：`ready` = 现在就能做（纯浏览器），`bridge` = 需要一个本地桥，
`native` = 目前没有 Web API。**这一页就是给想动手的人看的，不是给用户看的。**

## A. 浏览器直接可做（无需驱动）

| 装置 | 给什么 | 需要写的代码 | 难点 | 状态 |
|---|---|---|---|---|
| **数位板笔压**（Wacom / XP-Pen / Huion / Apple Pencil） | `pointerType==='pen'`，`pressure` 0–1 | 已内置：指针模式里笔压直接改光圈半径。要做的是**笔倾斜 → 飞白纹理**（`tiltX/tiltY`） | 鼠标恒为 0.5，必须靠 `pointerType` 区分；iPad Safari 需要版本验证 | `ready`（压感已接，倾斜未接） |
| **游戏手柄**（Xbox / PS / Switch Pro） | 双摇杆 + 扳机 | 摇杆 → 速度，扳机 → 半径，`gamepadconnected` 事件 | 各手柄 mapping 不一致，要按 `mapping==='standard'` 分支 | `ready` |
| **Web MIDI**（nanoKONTROL / Launchpad / 推子） | CC 旋钮/推子 → 位置与半径 | `navigator.requestMIDIAccess()` + `onmidimessage` | 仅 Chromium/Edge；iOS 无 | `ready` |
| **Wiimote** | IR 摄像头得到绝对坐标（Johnny Lee 那套） | `wiimote-webhid` 或 `joy-con-webhid` | WebHID 仅 Chromium；需要用户手势授权；配对流程啰嗦 | `ready`（Chromium） |
| **Joy-Con** | 陀螺仪 + 摇杆 | `joy-con-webhid` | 同上；左右手柄事件不同 | `ready`（Chromium） |
| **SpaceMouse / 3Dconnexion** | 6DoF 推杆 | WebHID 读原始报告 | 需要逆向报文格式 | `ready` |
| **OSC（TouchDesigner / Max / Pure Data / Resolume）** | `/spot/x /spot/y /spot/r /scene/next` | 需要一个 WebSocket ↔ UDP 桥（TD 的 WebSocket DAT 或 20 行 Node） | OSC 无连接，丢包要自己平滑 | `bridge` |
| **激光笔 + 摄像头** | HSV 检测红/绿点 | 复用现有 `spF` 亮点检测，改成色相掩码 | 环境光、白墙反射 | `ready` |
| **IR 手电 + 拆 IR-cut 的摄像头** | 最经典的"光点追踪" | 现有 `spF` **一行不用改** | 要拆机（不可逆）+ 找 IR-pass 滤片 | `ready`（需要硬件改造） |
| **OpenMV / Pixy2 / ESP32 板载追踪** | 串口每行 `x,y[,area]` | **已内置** `ir` 模式（WebSerial，115200） | WebSerial 仅桌面 Chromium；固件要自己写 20 行 | `ready`（模式已存在） |
| **多台手机** | 每台手机一盏灯 | **已内置** `phone` 模式 + `server.py` + `phone.html` | 需要跑 `server.py`；局域网 HTTPS（陀螺仪要 secure context） | `ready`（已完成） |
| **二维码卡片 / ArUco 卡片** | 打印纸标记当"灯笼" | 复用 js-aruco2：检测多个 marker → 多盏灯 | 需要打印；光照与角度敏感 | `ready` |
| **NFC 贴纸** | 贴一下换场景 | `NDC`（Chrome Android）+ `NDEFReader` | 仅 Android Chrome；iOS 需 App | `ready`（受限） |

## B. 需要本地桥（native bridge）

| 装置 | 优势 | 桥接方式 | 状态 |
|---|---|---|---|
| **Kinect v2 / Azure Kinect** | 全身骨架 + 深度，做手掌剪影 | 本地 Node/Python 读 SDK → WebSocket → 页面 | `bridge` |
| **Intel RealSense / OAK-D** | 深度遮罩，手在画前"挖洞" | 同上 | `bridge` |
| **Leap Motion / Ultraleap** | 手部骨架精度最高 | 官方 WebSocket 服务可直接连 | `bridge` |
| **Tobii 眼动仪** | 真正的高精度视线 | 厂商 SDK → 本地 HTTP/WS | `native` |
| **MIDI 硬件踏板 / 呼吸控制器** | 展厅里不占手 | Web MIDI 已可（见 A） | `ready` |
| **DMX / Art-Net 灯具** | 让**展厅的灯**跟着光圈动 | 本地桥 → Art-Net | `bridge` |
| **Muse / EEG** | α 波越静，画卷开得越大 | BLE（`web-muse`）→ Web Bluetooth | `bridge` |
| **热像仪（FLIR Lepton）** | 全黑环境也能追踪人体 | UVC 输出 → 页面当一个普通摄像头 | `bridge` |

## C. 明确不做（与「零构建、单文件」冲突）

- 打包成 Electron / Tauri 桌面应用
- 引入 React / Vue / 构建流水线
- 服务端渲染或账号系统

## D. 想贡献？从这五个开始

1. **笔倾斜 → 飞白**（`tiltX` 已有值，缺纹理）— 半天
2. **游戏手柄模态**（摇杆 + 扳机，约 60 行）— 半天
3. **OSC 桥 + TouchDesigner patch 示例**（策展人最爱）— 一天
4. **多 marker 阵列**（4 个 ArUco → 平均角点，抗遮挡）— 一天
5. **IR 手电 + 拆机 webcam 的说明书**（配图 + 一步一步）— 一天

每个都遵守 [`docs/INTERACTIONS.md`](INTERACTIONS.md) 的注册表契约，并且要在 `tools/test.js` 里补一条断言。

## 参考（真实可用的库与许可）

| 用途 | 项目 | 许可 | 备注 |
|---|---|---|---|
| 帧差动作检测 | [beije/motion-detection-in-javascript](https://github.com/beije/motion-detection-in-javascript) | MIT | 8KB，最干净的教学实现；本项目 `motion` 模式思路同源 |
| 帧差（另一种） | [jasonmayes/JS-Motion-Detection](https://github.com/jasonmayes/JS-Motion-Detection) | 无 license 文件 | 只读思路，不要直接 vendor |
| 音高检测 | [ianprime0509/pitchy](https://github.com/ianprime0509/pitchy) | 0BSD | ESM-only，5.5KB gz；本项目用了自写自相关，零依赖 |
| ArUco | [damianofalcioni/js-aruco2](https://github.com/damianofalcioni/js-aruco2) | MIT | 已用于 `gaze` 模式，26KB |
| QR | [kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | MIT | 已用于手机配对 |
| 手/脸/姿态 | [MediaPipe](https://ai.google.dev/edge/mediapipe) | Apache-2.0 | `hand` / `face` 模式；legacy 0.4 已锁版本 |
| 眼动（**不要用**） | [brownhci/WebGazer](https://github.com/brownhci/WebGazer) | **GPLv3**，且已停止维护 | 只借鉴 9 点标定思路；代码不能进 MIT 项目 |
| 节拍（**不要用**） | [Keavon/Web-Onset](https://github.com/Keavon/Web-Onset) | **GPL-3.0** | 同上，只读思路 |
