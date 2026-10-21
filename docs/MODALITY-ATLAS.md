# 交互模态全图 · Modality Atlas

> 目标：把「能产生 `{x,y,radius[,z]}` 或离散命令的一切」列全，按**传感器类别**分组（不按品牌），
> 每条都回答同一个问题：**浏览器能不能直接读？读不到要插什么桥？接进现有契约要多少行？**
> 图例：**直读** = `是`（原生 API）· `是*`（原生但需 flag / 特定平台 / +1 CDN）· `桥`（本机脚本）· `否`。
> 状态：**✅** 已实现 · **⭕** 浏览器可做未做 · **🧩** 浏览器可做但要新 CDN · **🔌** 需本地桥 · **💰** 需买硬件 · **❌** 不建议。

## 0 · 三条硬事实 + 总量（先看这个，再决定做什么）
1. **注册表真实 29 个模态，不是 31**（解析 `M{}` @ `9a97d6f`）：
   `auto mouse audio tilt motion hand face flashlight gaze phone ir keys multi pen dwell breath speech shake gamepad midi hid ble nfc eyes light clap blow osc bridge`。
   README / IDEAS / CHANGELOG 的「31」是漂移，**以代码为准**。
2. **CDN 已超预算**：静态 2 个 `<script>`（hands、camera_utils）+ 运行期懒加载 3 个（face_mesh、
   js-aruco2 26 KB、qrcode-generator）＝ **5 个库 vs 硬规则 ≤4**；所以 🧩 方案**必须先删一个库**，⭕ 全是 0 新 CDN。
3. **契约只有一盏灯**：`spot()` / `spots()` 不带 z、不带 cmd，只有 `extIngest()` 有 `z` 与 `cmd`；
   没有「在场 / 人数 / 身份 / 连续状态」字段 —— 这是 §B 里一半模态只能硬塞 x,y 的根因。

**总量**：本表 **125 条 / 12 类**；直读 `是`+`是*` 81 · `桥` 37 · `否` 7；
状态 ✅33（含复用既有模态的入口；注册表 29）· ⭕35 · 🧩4 · 🔌36 · 💰8 · ❌9 → **纯浏览器可做未做 = 39 条**。
**成本列**：`≈N 行/0` = 加进 `web/index.html` 的估算行数、0 新 CDN；`+1 CDN` 另计字节。

---
## 1 · 光学 / 摄像头（可见光、IR、深度、结构光、ToF、热、事件、光场）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 手部 21 点 ✅ | 可见光摄像头 | 是 | MediaPipe Hands 0.4（版本已锁） | 0/已载 | S | `spot()` hand |
| 面部 468 点 + 头姿 ✅ | 摄像头 | 是 | MediaPipe FaceMesh 0.4 | 0/已载 | S | `spot()` face |
| 眨眼 EAR ✅ | 摄像头 | 是 | FaceMesh + 眼宽高比 | 0/已载 | S | `spot()`+splat eyes |
| 帧差动影 ✅ | 摄像头 | 是 | `getImageData` 差分质心 | 0/已载 | S | `spot()` motion |
| 亮点 / 手电筒 ✅ | 摄像头 | 是 | 亮度加权质心 `spF()` | 0/已载 | S | `spot()` flashlight |
| 彩色光点（激光笔/彩球）⭕ | 摄像头 | 是 | 色相+饱和度掩码→质心 | ≈25/0 | S | `spot()` |
| QR / 条码 ⭕ | 摄像头 | 是* | `BarcodeDetector`（Chrome 88；桌面仅 ChromeOS/macOS，Android 83+，BCD） | ≈20/0 | S | `extIngest({scene})` |
| ArUco 多标记 ✅ | 打印标记 | 是 | js-aruco2 2.0.0（懒加载） | 0/已载 | M | `spots()` gaze 扩 |
| 姿态骨架 33 点 🧩 | 摄像头 | 是 | MediaPipe Pose（+1 CDN） | ≈60/+1 | M | `spot()` |
| 深度相机 🔌 | Kinect v2 / RealSense / OAK-D | 桥 | SDK→`POST /send?room=ext` | 0/脚本 30 行 | L | `extIngest` |
| 结构光 / ToF 模组 🔌 | Kinect v1、VL53L1X | 桥 | 串口→WebSerial 或 ext | ≈40/0 | M | `spot()` |
| 热成像 UVC 💰 | Lepton / Seek / P2 Pro | 是 | `getUserMedia`（UVC 免驱，全黑可用） | ≈20/0 | M | `spot()` |
| 拆 IR-cut + IR 补光 💰 | 改造摄像头 | 是 | 复用 `spF()` | 0 | M | `spot()` |
| 屏幕 / 窗口捕获 ⭕ | 任意窗口、视频 | 是 | `getDisplayMedia` | ≈35/0 | M | `spot()` |
| iPhone LiDAR 🔌 | Record3D App | 桥 | App UDP→脚本→ext（协议细节未经核实） | 0/30 行 | M | `extIngest` |
| 事件相机 ❌ | Prophesee / DVXplorer | 否 | 无 Web API | — | L | — |

## 2 · 惯性 & 磁（IMU、陀螺、磁力计、振动、倾斜）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 倾斜 ✅ | 手机陀螺仪 | 是 | `deviceorientation`（iOS 需授权） | 0/已载 | S | `spot()` tilt |
| 摇一摇 ✅ | 加速度计 | 是 | `devicemotion` + 阈值 | 0/已载 | S | `spot()`+splat shake |
| 敲击 ⭕ | 加速度计 | 是 | 高通滤波 + 阈值 | ≈15/0 | S | `extIngest({cmd:'splat'})` |
| 线性加速度 ⭕ | `LinearAccelerationSensor` | 是* | Generic Sensor（Chrome flag，BCD） | ≈20/0 | S | `spot()` |
| 磁罗盘 ⭕ | `Magnetometer` | 是* | 同上（BCD：Chrome 56 flag） | ≈20/0 | M | `spot()` 航向 |
| 绝对朝向四元数 ⭕ | `AbsoluteOrientationSensor` | 是* | 同上 | ≈25/0 | M | `spot()` |
| 手柄 IMU 🧩 | Joy-Con / DS4 | 是 | WebHID + joy-con-webhid（+1 CDN） | ≈80/+1 | M | `spot()` |
## 3 · 触摸 & 笔（电容、压感、倾斜、悬停、多指、手套、导电墨、触摸墙）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 指针 / 单指 ✅ | 鼠标、触控板、手指 | 是 | Pointer Events | 0/已载 | S | `spot()` mouse |
| 压感笔 ✅ | Wacom / Apple Pencil / USI | 是 | `pointerType==='pen'` + `pressure` | 0/已载 | S | `spot()` pen |
| 笔倾斜 + 笔锋方位 ⭕ | 压感笔 | 是 | `PointerEvent.tiltX/tiltY/twist` | ≈15/0 | S | `spot()` |
| 悬停（笔未落纸）⭕ | 压感笔 | 是* | `pointermove` + `buttons===0` | ≈10/0 | S | `spot()` |
| 多指 ✅ | 触摸屏 | 是 | 多 `pointerId` | 0/已载 | S | `spots()` multi |
| 滚轮 / 捏合改半径 ✅ | 触控板、触屏 | 是 | `wheel`（含 `deltaMode`、`ctrlKey`） | 0/已载 | S | radius（已有） |
| 导电物 / 电容触摸 💰 | Makey Makey（HID 键盘） | 是 | `keydown`（无需驱动） | ≈15/0 | S | `extIngest` |
| 电容触摸板 / 触摸墙 🔌 | TTP223、CapSense、TUIO 墙 | 桥 | 串口→WebSerial；TUIO→ext | ≈30/0 | M | `spot()`/`spots()` |
## 4 · 声音 & 超声（麦克风电平/音高/瞬态/呼吸、超声测距、声呐、语音、口哨、噪声）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 响度 ✅ | 内置麦克风 | 是 | `AnalyserNode` 时域 RMS | 0/已载 | S | `spot()` audio |
| 基频 / 音高 ✅ | 麦克风 | 是 | 自相关（85–1400 Hz） | 0/已载 | S | `spot()` audio |
| 瞬态 / 拍手 ✅ | 麦克风 | 是 | onset 差分 + 去抖 | 0/已载 | S | splat/scene clap |
| 呼吸包络 ✅ | 麦克风 | 是 | 低通包络 | 0/已载 | S | `spot()` breath |
| 吹气 ✅ | 麦克风 | 是 | 高频能量 + 风噪 | 0/已载 | S | dust mask blow |
| 语音识别 ✅ | 麦克风 | 是* | `SpeechRecognition`（Chrome 139 / Safari 14.1，BCD） | 0/已载 | S | 关键词 speech |
| 节拍 / BPM ⭕ | 麦克风或线路输入 | 是 | 频谱通量 + 自相关 | ≈40/0 | M | `spot()`/splat |
| 口哨 / 哼唱音阶 ⭕ | 麦克风 | 是 | 音高→十二平均律 | ≈25/0 | S | `extIngest({scene})` |
| 环境噪度 / 在场声 ⭕ | 麦克风 | 是 | 长窗 RMS（30 s 底噪） | ≈12/0 | S | radius/墨色浓度 |
| 超声测距 🔌 | HC-SR04 → MCU | 桥 | 串口→WebSerial | ≈40/0 | M | `spot()` |
| 声呐回声 ❌ | 麦克风+扬声器 chirp | 否 | 浏览器可发 >18 kHz，但 MIC 普遍滤除（未经核实） | — | L | — |
| 接触麦克风 / 压电片 💰 | 压电片→3.5 mm MIC | 是 | 复用 `AnalyserNode`（≈¥2 的输入设备） | ≈18/0 | S | `spot()` |
| MIDI 乐器 ✅ | 任意 MIDI 键盘 | 是 | Web MIDI | 0/已载 | S | `spot()` midi |
## 5 · 生物 & 生理（rPPG、HRV、EEG、EMG、EDA、呼吸带、眼动、注视、瞳孔、体态）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| rPPG 心率 ⭕ | 摄像头 | 是 | FaceMesh ROI + 绿通道带通 | ≈55/0 | M | `meter()`+radius |
| HRV ⭕ | 同上（间期序列） | 是 | RR 间期标准差 | ≈25/0 | M | radius/浓度 |
| 心率带 BLE ✅ | Polar / Coospo（0x180D） | 是 | Web Bluetooth `heart_rate_measurement` | 0/已载 | S | radius ble |
| EEG（Muse 1/2/S）🧩 | BLE 头环 | 是* | muse-js（+1 CDN，仓库已核） | ≈60/+1 | M | `spot()`/meter |
| EMG 🔌 | Myo（停产）/ OpenBCI / BITalino | 桥 | BLE/串口→脚本→ext | 0/40 行 | L | `extIngest` |
| EDA / GSR 🔌 | Grove GSR、BITalino | 桥 | 串口→WebSerial | ≈35/0 | M | radius |
| 呼吸带 💰 | 压电带→MIC 或 BLE | 是 | MIC 包络（比 `breath` 更稳） | ≈20/0 | S | `spot()` |
| 眼动仪（Tobii）🔌 | Tobii 5 / Pro | 桥 | 厂商 SDK→ext | 0/40 行 | L | `extIngest` |
| WebGazer 网络眼动 ❌（GPL） | 摄像头 | 是* | GPLv3（LICENSE 已核）→ 不可 vendor | — | M | — |
| 注视停留 ✅ | 指针 | 是 | 停留计时 1.4 s | 0/已载 | S | splat dwell |
| 瞳孔直径 ❌ | IR 眼动相机 | 否 | 浏览器拿不到红外眼图 | — | L | — |
| 体态 / 坐姿 ⭕ | 摄像头 | 是 | FaceMesh 鼻尖 z / Pose | ≈30/0 | M | radius |
## 6 · 无线电 & 接近（BLE RSSI、UWB、Wi-Fi CSI、RFID/NFC、信标、mmWave、IR 接近）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| BLE RSSI 接近 ❌ | 任意 BLE 设备 | 否 | `watchAdvertisements` 无 MDN 页（404）→ 未经核实 | — | M | — |
| iBeacon 信标 ❌ | iBeacon | 否 | Web Bluetooth 不能被动扫描广播 | — | L | — |
| UWB 测距 🔌 | DW3000 / DWM1001 | 桥 | 串口/TCP→ext | 0/50 行 | L | `spot()` |
| Wi-Fi CSI 🔌 | ESP32-CSI-Tool | 桥 | 串口/UDP→ext（需 DSP） | 0/80 行 | L | `spot()` |
| RFID（RC522）🔌 | MFRC522 + 卡 | 桥 | 串口→WebSerial | ≈40/0 | M | `extIngest({scene})` |
| NFC 贴纸 ✅ | 手机 NFC | 是* | `NDEFReader`（**仅 Chrome Android 89+**，BCD） | 0/已载 | S | 关键词 nfc |
| mmWave 存在感应 🔌 | HLK-LD2410 | 桥 | 串口→WebSerial | ≈40/0 | M | `spot()` |
| IR 接近 🔌 | GP2Y0A21 / E18-D80NK | 桥 | 模拟/数字→MCU→串口 | ≈30/0 | S | radius |
| 雷达手势 ❌ | Google Soli | 否 | 项目已终止，无消费级硬件 | — | L | — |
## 7 · 定位 & 空间（动捕、Vive、UWB 锚点、GPS、QR/ArUco、SLAM、LiDAR、标定网格）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| GPS ⭕ | 手机 GNSS | 是 | `geolocation.watchPosition` | ≈20/0 | S | `extIngest({scene})` |
| UWB 锚点定位 🔌 | 4× DWM1000 | 桥 | 网关→TCP→ext | 0/60 行 | L | `spot()` |
| 光学动捕 🔌 | OptiTrack / Vicon | 桥 | VRPN→`python-osc`→UDP 9000 | 0/20 行 | M | OSC `/spot` |
| Vive Tracker 🔌 | Lighthouse + Tracker 3 | 桥 | `pyopenvr`→ext | 0/40 行 | L | `extIngest` |
| WebXR AR / SLAM ⭕ | Android Chrome | 是* | `navigator.xr`（无 iOS） | ≈80/0 | L | `spot()` |
| 2D LiDAR 🔌 | RPLIDAR A1 | 桥 | SDK→串口→ext | 0/40 行 | M | `spot()` |
| Leap 手部 🔌 | Leap Motion 2 | 桥 | 服务/WS→ext | 0/25 行 | M | `spots()` |
| 投影标定网格 🔌 | 投影机 + 相机 | 桥 | `?wall=1` 已出网格，相机侧在外部 | 0 | M | 网格 |
| 气压计楼层 🔌 | BME280 / 手机 | 桥 | BLE→ext | ≈25/0 | M | radius |
## 8 · 机械 & 接触（按钮、FSR、弯曲、压电、敲击、编码器、摇杆、推子、MIDI、HID、踏板、吹管、电容）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 键盘 ✅ | 任意键盘 | 是 | `keydown` | 0/已载 | S | `spot()` keys |
| 手柄 ✅ | Xbox / PS / Switch Pro | 是 | Gamepad API（BCD：Chrome 21） | 0/已载 | S | `spot()` gamepad |
| MIDI（推子/旋钮/踏板/吹管）✅ | 任意 MIDI 控制器 | 是 | Web MIDI（BCD：Chrome 43 / FF 108） | 0/已载 | S | `spot()` midi |
| HID 自定义 ✅ | Joy-Con / Wiimote / DIY | 是 | WebHID（BCD：Chrome 89 桌面） | 0/已载 | M | `spot()` hid |
| FSR 压力垫 🔌 | FSR402 + MCU | 桥 | 模拟→串口→WebSerial | ≈30/0 | S | radius |
| 弯曲传感器 🔌 | 弯曲片 + MCU | 桥 | 同上 | ≈30/0 | S | radius |
| 旋转编码器 🔌 | EC11 + MCU | 桥 | 同上（或 HID 键盘映射） | ≈25/0 | S | radius/scene |
| Theremin 式电容 🔌 | ESP32 `touchRead` | 桥 | 串口→WebSerial | ≈35/0 | M | `spot()` |
| 干簧管 / 门磁 🔌 | 簧片 + MCU | 桥 | 同上 | ≈20/0 | S | `extIngest({scene})` |
| sip-and-puff 🔌 | 气压传感器 MPX5010 | 桥 | 同上 | ≈35/0 | M | `spot()`+splat |
| 3Dconnexion SpaceMouse ⭕ | 6DoF 推杆 | 是 | WebHID 原始报告（需逆报文） | ≈90/0 | L | `spot()` |
| 轮椅摇杆 ❌ | 电动轮椅 | 否 | 医疗设备改装，安全/法规 | — | L | — |
## 9 · 环境（光、颜色、温湿度、空气、风、水/土壤、烟雾、火焰；磁场见 §2）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 环境光 ✅ | `AmbientLightSensor` | 是* | Chrome 56 需 flag（BCD）；多数桌面无 | 0/已载 | S | radius light |
| 颜色传感器 🔌 | TCS34725 | 桥 | I²C→MCU→串口 | ≈30/0 | S | 风格/墨色 |
| 温湿度 🔌 | DHT22 / BME280 | 桥 | 同上 | ≈30/0 | S | 半径/场景 |
| 空气质量 🔌 | MQ-135 / PM2.5 | 桥 | 同上 | ≈30/0 | S | 墨色浓度 |
| 风速 🔌 | 风杯/热线 | 桥 | 同上 | ≈30/0 | M | 粒子方向 |
| 水位 / 土壤湿度 🔌 | 电容式水位、土壤探头 | 桥 | 同上 | ≈25/0 | S | 半径 |
| 烟雾 / 雾机 🔌 | MQ-2、DMX 雾机 | 桥 | 串口；DMX 需 Art-Net 桥 | ≈35/0 | M | 雾浓度 |
| 火焰 ❌ | 火焰传感器 | 桥 | 公共装置用明火，安全不可控 | — | M | — |
| 气压 / 海拔 🔌 | BME280 | 桥 | 同上 | ≈25/0 | S | 场景 |
## 10 · 屏幕 / OS 级（指针、滚轮、键盘、剪贴板、通知、电池、网络、时间、方向、动作）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 剪贴板文字 ⭕ | 系统剪贴板 | 是 | `navigator.clipboard.readText()` | ≈12/0 | S | 关键词→scene |
| 通知到达 ⭕ | 系统通知 | 是 | `Notification`（需权限，BCD Chrome 20） | ≈20/0 | S | splat |
| 电池 ⭕ | `BatteryManager` | 是 | `navigator.getBattery()`（BCD Chrome 38） | ≈15/0 | S | radius/墨色 |
| 网络延迟 / 类型 ⭕ | `NetworkInformation` | 是 | `connection.effectiveType/rtt`（Chrome 61） | ≈12/0 | S | 笔触粗细 |
| 时间 / 昼夜 ⭕ | 系统时钟 | 是 | `new Date()` | ≈10/0 | S | 场景/色温 |
| 屏幕方向 ⭕ | `ScreenOrientation` | 是 | `screen.orientation`（Chrome 38） | ≈10/0 | S | 构图 |
| 空闲 / 在场 ⭕ | 系统空闲 | 是 | `IdleDetector`（Chrome 94 / Edge 114，BCD） | ≈20/0 | M | 回 attract |
| 多屏 / 投影墙 ⭕ | `ScreenDetails` | 是 | `getScreenDetails()`（Chrome 100） | ≈30/0 | M | 双屏铺展 |
| 键盘锁 ⭕ | kiosk | 是 | `navigator.keyboard.lock()`（Chrome 68） | ≈8/0 | S | 展厅防退出 |
| 屏幕取色 ⭕ | 屏幕像素 | 是 | `EyeDropper`（Chrome 95 桌面，Android 无） | ≈12/0 | S | 风格 |
| 系统负载 ⭕ | CPU 压力 | 是 | `PressureObserver`（Chrome 94，示例已核） | ≈15/0 | S | 墨色/帧率 |
| 折叠姿态 ⭕ | 折叠屏 | 是* | `navigator.devicePosture`（Chrome 132，BCD） | ≈10/0 | S | 构图 |
| 全屏 / 唤醒锁 ✅ | 浏览器 | 是 | Fullscreen + `wakeLock`（Chrome 84） | 0/已载 | S | 展厅 |
## 11 · 多人 & 网络（多手机、人群、弹幕、远程 API、其他装置、MQTT、OSC）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 多手机 ✅ | 观众手机 + `server.py` | 是 | SSE `GET /events?room=` | 0/已载 | M | `spot()` phone |
| 手机众光 ✅ | 同上 | 是 | 每部手机一个 target | 0/已载 | M | `spots()` |
| 远程 HTTP ✅ | 任意脚本 | 是 | `POST /send?room=ext` | 0/已载 | S | `extIngest` |
| OSC over network ✅ | TouchDesigner / Max / PD | 是 | UDP 9000 + SSE 转发 | 0/已载 | S | OSC `/spot` |
| 直播弹幕 ⭕ | Twitch IRC | 是 | `wss://irc-ws.chat.twitch.tv:443`（官方文档已核） | ≈35/0 | M | splat/scene |
| MQTT 🧩 | 任意 broker | 是 | mqtt.js over WebSocket（+1 CDN） | ≈40/+1 | M | `extIngest` |
| WebRTC 多机同步 ⭕ | 多台设备 | 是 | `RTCPeerConnection`（需信令） | ≈90/0 | L | `spots()` |
| 装置互连 WebSocket ⭕ | 另一台装置 | 是 | `WebSocket`；`server.py` **无 WS**（只有 SSE/HTTP/UDP） | ≈60/0 | M | `extIngest` |
| 人群密度 ⭕ | 摄像头 | 是 | 肤色块/帧差计数 | ≈45/0 | M | radius |
## 12 · 非常规 / 艺术（导电颜料、激光竖琴、烟、水、植物、EMG、脑电、扶乩、掌声、脚步、门磁、sip-and-puff）

| 名称 | 传感器/硬件 | 直读 | 具体 API 或桥 | 成本 | 难度 | 现有契约 |
|---|---|---|---|---|---|---|
| 导电颜料墙面 💰 | 导电墨 + Makey Makey | 是 | HID 键盘（与 §3 同一路径） | ≈15/0 | S | `extIngest` |
| 激光竖琴 🔌 | 激光模块 + 光电管 | 桥 | 串口→WebSerial | ≈40/0 | M | `spots()` |
| 植物生物电 💰 | MIDI Sprout / DIY 电极 | 是 | Web MIDI（MIDI Sprout 原生 MIDI） | ≈25/0 | M | `spot()` |
| 通灵板 / 扶乩 ⭕ | 摄像头追板 | 是 | ArUco/色块跟踪 | ≈35/0 | M | `spot()` |
| 水盆电容 / 水位 🔌 | 电容水位、湿度 | 桥 | 串口 | ≈30/0 | S | radius |
| 掌声 / 欢呼 ✅ | 麦克风 | 是 | 复用 `clap` 内核（长窗能量） | ≈10/0 | S | splat |
| 脚步地垫 🔌 | FSR 毯 / 压电地砖 | 桥 | 串口 | ≈35/0 | M | `spot()`+splat |
| 接触麦心跳鼓 💰 | 接触麦克风 | 是 | `AnalyserNode` 低频瞬态 | ≈20/0 | S | radius |

---
## §A · 已经实现的 31 个（实为 29，按注册表分组）

| 组 | 模态 | 一句话现状 |
|---|---|---|
| free（14） | `auto` `mouse` `multi` `keys` `pen` `dwell` `breath` `blow` `audio` `clap` `speech` `tilt` `shake` `light` | 全部 0 外设、失败必回落 `mouse`；`light` 靠 flag 传感器，桌面基本读不到（已有降级） |
| cam（5） | `motion` `hand` `face` `eyes` `flashlight` | 零模型动影 + MediaPipe 两代混用；`eyes` 与 `face` 共用一份 FaceMesh |
| gear（8） | `gamepad` `midi` `hid` `ble` `nfc` `gaze` `phone` `ir` | WebHID/MIDI/Serial/NFC 四条总线都已打通；`gaze` 靠 26 KB js-aruco2 |
| local（2） | `osc` `bridge` | UDP 9000 + `POST /send?room=ext`，任何会发 HTTP/OSC 的软件都能驱动 |

**数字漂移（建议改文档，不是改代码）**：README/IDEAS 写「31 个模态」，CHANGELOG 写「blow 是第 31 个」，
但 `M{}` 只有 **29** 个键；`tools/test.js` 有 **142 个 `ok()` 调用点**，其中 2 处在循环里展开
（三语 ×3、模态 ×23）→ **运行时 166 条**，与 `TEST-REPORT.md` 的 166 一致；
任务书与部分笔记里的「179」在代码里找不到对应。
## §B · 尚未实现但浏览器能直接做（按「0 新 CDN + 行数 + 舞台效果」排序）

1. **笔倾斜 `penTilt`** — `PointerEvent.tiltX/tiltY`（MDN 已开）。`pen` 只差两个字段，10 行以内。
```js
addEventListener('pointermove', e => { S.penTilt = (e.tiltX||0)/90; }, {passive:true});
spot(){ const t=Math.abs(S.penTilt||0); return {x:S.mouseX, y:S.mouseY, radius:S.radius*(0.6+0.9*t)}; }
// 断言：合成 pointermove(tiltX:45) 后半径 ≥ tiltX:0 的 1.3 倍
```
2. **环境噪度 `noise`** — `AnalyserNode` 长窗 RMS（30 s 底噪）。复用 `audio` 的电平条与失败路径。
```js
const an=A.ctx.createAnalyser(); an.fftSize=1024; an.getFloatTimeDomainData(buf);   // 复用 audio 的 A.ctx
S.noise = S.noise==null ? rms(buf) : S.noise*0.999 + rms(buf)*0.001;   // 慢跟随底噪
// 断言：注入白噪 3 s 后 S.noise > 静音时 2 倍
```
3. **节拍 `beat`** — 频谱通量 + 自相关求 BPM。展厅放音乐就能驱动泼墨。
```js
flux = Σ max(0, mag[i]-prevMag[i]); prevMag=mag.slice();
if (flux > S.beat.avg*1.6 && now-S.beat.t > 240) { pushSplat(...); S.beat.t=now; }
// 断言：120 BPM 点击轨 8 s 内触发 ≥6 次泼墨
```
4. **心率 `pulse`（rPPG）** — FaceMesh 额头 ROI 的绿通道带通（0.7–3 Hz），无需硬件。
```js
const g = roiGreen(fd); S.pulse.buf.push(g); if (S.pulse.buf.length>150) S.pulse.buf.shift();
S.pulse.bpm = 60*peakFreq(bandpass(S.pulse.buf, 0.7, 3, 30));   // 30 fps
// 断言：合成 1.2 Hz 脉动的视频帧 → bpm 落在 66–78
```
5. **口哨 / 哼唱 `whistle`** — 复用 `audio` 的音高，加音名表 → 换场景。比语音识别稳。
```js
const n = 69 + 12*Math.log2(S.audio.pitch/440);     // MIDI 音高（S.audio.pitch 已有）
if (Math.round(n)!==S.wNote) { S.wNote=Math.round(n); }
// 断言：440 Hz 正弦 → S.wNote===69；880 Hz → 81
```
6. **剪贴板 `clip`** — `navigator.clipboard.readText()`（需用户手势；Clipboard 接口 Chrome 66，BCD）。复制「雪」就下雪。
```js
const txt = await navigator.clipboard.readText();
if (/(雪|snow)/i.test(txt)) changeScene(2);
// 断言：写入「竹林」→ scene 变为 1；权限拒绝时静默回落
```
7. **时间 `hours`** — `new Date().getHours()`。无人操作也在变，适合长展。
```js
const h = new Date().getHours();
if (h<6||h>=19) setStyle('dark'); else if (h<11) setStyle('edges');   // STYLE_ORDER=['edges','sketch','dark','paper']
// 断言：mock Date 到 22:00 → style==='dark'
```
8. **空闲在场 `presence`** — `IdleDetector`（Chrome 94，需 'idle-detection' 权限）。
```js
const d = new IdleDetector(); await d.start({threshold: 60000});
d.onchange = () => { if (d.userState==='idle') wM('auto',{silent:true}); };
// 断言：模拟 idle 事件 → mode==='auto' 且 aria-live 播报
```
9. **多屏 `wall`** — `getScreenDetails()`（Chrome 100）。`?wall=1` 的标定网格可直接铺两块屏。
```js
const {screens} = await window.getScreenDetails();
S.wall = {left: screens[0].availLeft, top: screens[0].availTop, n: screens.length};
// 断言：mock 两块屏 → S.wall.n===2 且网格 x 偏移 > 0
```
10. **展厅键盘锁 `kiosk`** — `navigator.keyboard.lock()`（Chrome 68）。防观众按 Esc/F11 退出。
```js
if (S.kiosk) await navigator.keyboard.lock(['Escape','F11','Tab']);
// 断言：kiosk 模式下 Esc 不触发退出（mode 不变）
```
11. **屏幕取色 `inkpick`** — `EyeDropper`（Chrome 95 桌面）。从任意像素取色 → 定风格。
```js
const {sRGBHex} = await new EyeDropper().open();
setStyle(nearestStyle(sRGBHex));        // 在 4 种风格里取最近色
// 断言：mock 取色 #2b2b2b → style==='dark'
```
12. **系统负载 `load`** — `PressureObserver`（Chrome 94，MDN 示例已核）。机器越忙墨越淡，纯艺术。
```js
new PressureObserver(rs => { S.load = rs.at(-1).state; }).observe('cpu', {sampleInterval:1000});
radius = S.radius * (S.load==='critical' ? 0.6 : 1);
// 断言：注入 'critical' 记录 → 半径缩到 0.6 倍
```
其余同样 0 CDN、可后置：`battery`（`getBattery`）、`nettype`（`connection.effectiveType`）、
`orientationlock`（`screen.orientation.lock` 需全屏）、`fold`（`devicePosture`，Chrome 132）、
`qr`（`BarcodeDetector` 桌面仅 ChromeOS/macOS，BCD）、`capture`（`getDisplayMedia`）、
`gps`（`watchPosition`）、`chat`（Twitch WSS）、`webxr`（仅 Android）。
## §C · 需要一个本地桥 / 驱动（OS 工具 → 协议 → 我们的 server.py 已覆盖多少）

| 装置 | OS 侧工具 | 协议 | `server.py` 已覆盖 | 缺口 |
|---|---|---|---|---|
| Leap Motion | Ultraleap Hyperion 服务 | 本地 WS / SDK | 无（需自写 WS→ext） | 20 行转发 |
| Kinect v2 | libfreenect2 / Kinect SDK | USB→脚本 | `POST /send?room=ext` | 深度/骨架只在脚本侧 |
| RealSense / OAK-D | pyrealsense2 / depthai | USB→脚本 | 同上 | 同上 |
| Tobii | Tobii Pro SDK / tobii-research | USB→脚本 | 同上 | Windows 优先 |
| OpenBCI / LSL | brainflow / pylsl | TCP→脚本 | 同上 | 采样率对齐 |
| 光学动捕 | VRPN client | UDP→`python-osc` | **UDP 9000 OSC 已解析** | 命名空间映射 |
| Vive Tracker | `pyopenvr` | USB→脚本 | `extIngest` | 基站校准 |
| 2D LiDAR | RPLIDAR SDK | 串口→脚本 | `extIngest` | 极坐标→x,y |
| UWB | DWM1001 网关 | 串口/TCP→脚本 | `extIngest` | 多锚点解算 |
| Wi-Fi CSI | ESP32-CSI-Tool | 串口/UDP→脚本 | `extIngest` | 需要 DSP |
| DMX / Art-Net | OLA / pyartnet | UDP→脚本 | `extIngest`（单向） | 无回传通道 |
| 装置互连 | — | WebSocket | **无**（只有 SSE/HTTP/UDP） | 需补 WS 端点 |

`server.py` 的能力边界（已核）：`GET /events?room=`、`POST /send?room=`、`POST /osc`、UDP 9000
（`/spot f,f[,z][,r]`、`/spot/x|y|z|r`、`/scene i`、`/style i`）、`MAX_BODY=64 KB`、room token 即权限、
**单向广播、无 WebSocket、无二进制帧、无回传**。因此任何「需要把画面状态回传给装置」的模态
（触觉、灯光跟随、闭环校准）都要先补一个 WS 或轮询端点。
## §D · 需要买硬件才能验（价格带为**量级估计**，不是报价；最便宜的验证路径才是重点）

| 装置 | 价格带 | 插哪里 | 最便宜的验证 |
|---|---|---|---|
| Makey Makey（或 DIY 电容板） | ¥30–350 | USB HID | 手摸香蕉 → `keydown` 进 `keys` |
| FSR / 压电片 / 弯曲片 | ¥2–15/片 | MCU 模拟口→USB 串口 | 串口发 `x,y,r`，看 `ir` 模式的光圈是否跟随 |
| ESP32 / Arduino Nano | ¥20–45 | USB | 20 行固件发 `x,y,r\n`，`ir` 模式直接读 |
| HC-SR04 / VL53L1X | ¥6–15 | MCU | 手在 20–80 cm 移动，看半径线性变化 |
| HLK-LD2410（mmWave） | ¥60 | 串口 | 人走进 3 m 内看 `S.ir.r` 跳变 |
| UWB DWM1000 ×2–4 | ¥150/个 | 网关→USB | 两点测距误差 <10 cm 即可信 |
| RC522 RFID | ¥8 + 卡 ¥2 | SPI→MCU→USB | 贴卡换场景（等价 `nfc`） |
| Polar H10 / Coospo 心率带 | ¥150–600 | BLE | Chrome 打开 `ble` 模式，看 0x2A37 notify |
| Muse 2 / Muse S（EEG） | ¥1800–2800 | BLE | muse-js demo 先跑通，再接 α 波→半径 |
| BITalino（EDA/EMG/ECG） | ¥1200–1800 | BLE/串口 | 先只验 EDA 一路 |
| Leap Motion 2（v1 二手更便宜） | ¥200–900 | USB + 服务 | 官方 Web demo 的手掌坐标能否 30 fps |
| Kinect v2 + 适配器 | ¥300–600 + ¥250 | USB3 | 只验深度图质心，别碰骨架 |
| RealSense D435 / OAK-D Lite | ¥700–2500 | USB3 | 深度直方图→手掌遮罩 |
| 热成像（P2 Pro / Lepton） | ¥1200–2000 | USB UVC | `getUserMedia` 直接出灰度图 |
| RPLIDAR A1 | ¥700 | USB 串口 | 360° 点云中找最近簇 |
| Vive Tracker 3 + 基站 | ¥1000 + ¥1500 | USB/SteamVR | 只验一个 tracker 的 x,y |
| Joy-Con / Wiimote | ¥120–450 | 蓝牙 HID | joy-con-webhid demo 的摇杆值 |
| MIDI 控制器（nanoKONTROL2） | ¥500 | USB MIDI | CC1/CC2 推动光圈 |
| 呼吸控制器（BC3 二手 / DIY 气压） | ¥60–1000 | MIDI / 串口 | 吹气看 CC 值；DIY 更可控 |
| sip-and-puff 气压传感器 | ¥60 | MCU | 吸/吹两个阈值触发 splat |
| 植物生物电（MIDI Sprout / DIY 电极） | ¥30–600 | MIDI / 串口 | 触碰叶片看数值跳变 |
| 激光竖琴零件（激光+光电管） | ¥20 | MCU | 遮光一次触发一次 |
| 事件相机（Prophesee / DVXplorer） | ¥15000+ | USB3 + SDK | **不建议**，见 §E |
## §E · 不建议做

| 项目 | 理由 |
|---|---|
| 事件相机 / 光场相机 | 万元级、无 Web 通路、画面收益不如现有帧差；光场已停产 |
| 单目深度模型 | 748 KB + 19–27 MB 权重，首屏不可接受（IDEAS 已否决） |
| WebXR / 头显 | 单文件里维护会话生命周期，现场没人戴（IDEAS 已否决） |
| WebGazer 眼动 | GPLv3，不能 vendor 进单文件；CDN 引 GPL 也是许可风险 |
| jsQR / MediaPipe Pose / muse-js 等一切 `+1 CDN` | 现有 5 个库已超 ≤4；要么删一个，要么不做 |
| Kinect v1 / 结构光老设备 | 驱动链断裂，Windows-only |
| Google Soli 雷达手势 | 项目终止，无消费级硬件 |
| Wi-Fi CSI 实时艺术 | 研究级灵敏度，布展一次调一天，观众一动就漂 |
| 医疗轮椅摇杆 | 改装医疗设备，安全与法规风险，不做 |
| 明火 / 3B 类激光 | 公共装置安全不可控 |
| EEG 当「命令」 | 只有 2–4 类可靠分类，做氛围可以，做控制不行 |
| 浏览器 GPS 做室内定位 | 室内精度差 + 权限弹窗打断体验 |
| 常开摄像头「读心」 | 隐私与伦理，展厅会被投诉 |
| 扬声器+麦克风超声测距 | 浏览器能发 >18 kHz，但 MIC 普遍滤除，未经核实 |
## §F · 建议的实现顺序 Top 15（为什么现在 / 哪条断言证明它成了）

1. **`penTilt` 笔倾斜** — 只差两个事件字段，`pen` 已有 → 断言：`tiltX:45` 的半径 ≥ 0° 的 1.3 倍。
2. **`noise` 环境噪度** — 复用 `audio` 电平条与降级 → 断言：白噪 3 s 后 `S.noise` > 静音 2 倍。
3. **`beat` 节拍** — 展厅一放音乐就有反应，0 硬件 → 断言：120 BPM 点击轨 8 s 内 ≥6 次泼墨。
4. **`pulse` rPPG** — 最「人」的信号且零硬件 → 断言：合成 1.2 Hz 脉动 → bpm ∈ 66–78。
5. **`whistle` 音阶** — 复用音高，比语音识别稳 → 断言：440 Hz → 音名 69，880 Hz → 81。
6. **`clip` 剪贴板** — 12 行，给策展人一个「复制词就换画」的入口 → 断言：写入「竹林」→ scene 1。
7. **`hours` 昼夜** — 无人也会变，长展必备 → 断言：mock 22:00 → style `dark`。
8. **`presence` 空闲在场** — 展厅自动回 attract，省一个人 → 断言：idle 事件 → mode `auto`。
9. **`wall` 多屏** — `?wall=1` 网格已有，只差铺屏 → 断言：mock 两屏 → `S.wall.n===2`。
10. **`kiosk` 键盘锁** — 8 行，防观众退出 → 断言：kiosk 下 Esc 不改 mode。
11. **`inkpick` 屏幕取色** — 把「观众的色」变成风格 → 断言：`#2b2b2b` → style `dark`。
12. **`load` 系统负载** — 15 行，纯艺术但便宜 → 断言：`critical` 记录 → 半径 ×0.6。
13. **`qr` 条码/二维码** — 卡片换场景的物理入口 → 断言：`BarcodeDetector` 存在时读一张 QR 得 `scene`；不存在时静默跳过（桌面仅 ChromeOS/macOS，Android 可用）。
14. **`chat` 直播弹幕** — 远端观众参与，WSS 直连 → 断言：mock 一条 PRIVMSG → 一次 splat。
15. **`ws` 端点（server.py 补 WebSocket）** — 前面 14 条都不需要它，但触觉/灯光闭环需要 → 断言：`GET /ws` 升级成功且能收到一条 `{x,y,r}`。

**每条新模态的固定税**：`M` 一条 + I18N ×3 语言 + `tools/test.js` 一条断言 + INTERACTIONS.md 表格一行。
按 §B 的 12 条算，≈12×(1 条注册表 + 3 个 i18n 键 + 1 条断言) —— 这是「全都做」真正的成本所在。
## §G · 资料来源（只列真的打开过、真的读到的；打不开的写明）
**已打开并读到正文**
- [MDN · AmbientLightSensor](https://developer.mozilla.org/en-US/docs/Web/API/AmbientLightSensor) — 需 `ambient-light-sensor` 权限、secure context、experimental；`illuminance` 单位 lux。
- [MDN · PressureObserver](https://developer.mozilla.org/en-US/docs/Web/API/PressureObserver) — `observe("cpu",{sampleInterval})`，`state` 三档；secure context、可在 Worker。
- [Luxmin 互動研究院 · TD OSC 手機控制](https://institute.luxmin.art/ivd487-w10/) — 中文实操：OSC 四步、`OSC In (CHOP)` 端口 6001、`data osc`/`zig sim` 仅 iOS、必须 `Filter` 平滑。
- [掘金 · 纯前端把摄像头变成 4000 个粒子](https://juejin.cn/post/7580208715275550762) — MediaPipe Hands 21 点、拇指-食指距离阈值 0.08/0.16 做离散手势。
- [Twitch · IRC 文档](https://dev.twitch.tv/docs/chat/irc/) — `wss://irc-ws.chat.twitch.tv:443`。
- [GitHub · tomayac/joy-con-webhid](https://github.com/tomayac/joy-con-webhid) — WebHID 读 Joy-Con 摇杆/陀螺/加速度。
- [GitHub · colinbdclark/osc.js](https://github.com/colinbdclark/osc.js) — 浏览器可用、传输无关，含 UDP 与 WebSocket Port。
- [GitHub · urish/muse-js](https://github.com/urish/muse-js) — Muse 1/2/S 的 Web Bluetooth 库。
- [GitHub · WebGazer LICENSE](https://github.com/neuroailab/WebGazer/blob/master/LICENSE.md) — GPLv3，不可 vendor。
- [MQTT.js README](https://github.com/mqttjs/MQTT.js) — 浏览器 + WebSocket 传输。

**MDN 兼容数据（BCD，逐个读 JSON）**：
[BarcodeDetector](https://github.com/mdn/browser-compat-data/blob/main/api/BarcodeDetector.json)（Chrome 88，桌面仅 ChromeOS/macOS）· [NDEFReader](https://github.com/mdn/browser-compat-data/blob/main/api/NDEFReader.json)（android 89）· [IdleDetector](https://github.com/mdn/browser-compat-data/blob/main/api/IdleDetector.json)（94/114）· [ScreenDetails](https://github.com/mdn/browser-compat-data/blob/main/api/ScreenDetails.json)（100）· [EyeDropper](https://github.com/mdn/browser-compat-data/blob/main/api/EyeDropper.json)（95，Android 无）· [Keyboard](https://github.com/mdn/browser-compat-data/blob/main/api/Keyboard.json)（lock 68）· [Magnetometer](https://github.com/mdn/browser-compat-data/blob/main/api/Magnetometer.json)（56 flag）
[AmbientLightSensor](https://github.com/mdn/browser-compat-data/blob/main/api/AmbientLightSensor.json)（56 flag）· [Serial](https://github.com/mdn/browser-compat-data/blob/main/api/Serial.json)（89 桌面）· [MIDIAccess](https://github.com/mdn/browser-compat-data/blob/main/api/MIDIAccess.json)（43/FF108）· [SpeechRecognition](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json)（Chrome 139/Safari 14.1）· [DevicePosture](https://github.com/mdn/browser-compat-data/blob/main/api/DevicePosture.json)（132）· [WebTransport](https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json)（97/114/26.4）· [MediaStreamTrackProcessor](https://github.com/mdn/browser-compat-data/blob/main/api/MediaStreamTrackProcessor.json)（94 partial）
**只确认可达（200 + 标题），未逐段读**：
[ImageCapture](https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture) · [PointerEvent.pressure](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pressure) · [ScreenOrientation.lock](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock) · [Device Posture](https://developer.mozilla.org/en-US/docs/Web/API/Device_Posture_API) · [MediaPipe Hand Landmarker (Web)](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) · [CreativeApplications.Net](https://www.creativeapplications.net/)（艺术项目站，200）· [Golan Levin · flong.com](https://www.flong.com/)（200）

**打不开 / 只有壳（不伪造引用）**
- **知乎 403**：[question/26689667](https://www.zhihu.com/question/26689667/answer/2772433120) — 返回 403 拦截页，未取到正文。
- **小红书只有壳**：[搜索页](https://www.xiaohongshu.com/search_result?keyword=%E4%BA%A4%E4%BA%92%E8%A3%85%E7%BD%AE) — 200 但仅导航与页脚，结果由 JS 注入，**未取到内容**。
- **B 站可用**：[搜索 TouchDesigner](https://www.bilibili.com/search?keyword=TouchDesigner) — 200，读到真实标题/UP 主/播放量（「Touchdesigner 零基础教程10分钟快速上手」AIRT艺术科技 6.6 万）。
- **MDN 无此页**：`BluetoothDevice.watchAdvertisements` → 404 → **BLE RSSI 一行标未经核实**；GitHub `jeromeetienne/js-aruco2`、`ubicomplab/rppg-web` README 也 404。
- **§D 价格**：全部为量级估计（常见电商档位），**不是引用**，下单前自行核价。
