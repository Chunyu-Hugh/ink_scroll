# Ink Scroll（墨卷）浏览器交互模态工程报告

> 约束：单文件、无构建、CDN-only。**每个模态只产出 `{x,y,r}` + 可选离散手势**。体积均为我用 `curl --compressed` 实测的 gzip 字节；支持度以 MDN / BCD 为准。

## 0. 适配层契约

```js
// 所有模态同一个 shape，渲染层不感知来源
const adapter = { name:'pen', needsPermission:false, start(onSample){}, stop(){} };
// onSample({x, y, r, gestures:['next'|'style'|'trail'|'pause'], t})
```

能力探测（决定默认模态与引导文案）：

```js
const can = {
  fine:  matchMedia('(pointer:fine)').matches,      // 鼠标/触控板
  coarse:matchMedia('(pointer:coarse)').matches,    // 手指
  hover: matchMedia('(hover:hover)').matches,
  iosMotion: typeof DeviceOrientationEvent?.requestPermission === 'function',
  speech: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  wake:  'wakeLock' in navigator,
};
```

## 1. 无外设 API 清单

| API | 给什么 | 支持 / 坑（已验证） | 用法要点 |
|---|---|---|---|
| `PointerEvent`（`pressure`/`tiltX`/`tiltY`/`pointerType`/`pointerId`） | 位置、压感、笔倾斜、多指 | Baseline 2020-07。**鼠标按下 `pressure` 恒 0.5、抬起 0**，必须看 `pointerType`；`tiltX/Y` 仅 pen/部分 Android 笔非零；画布需 `touch-action:none` | 压感→笔锋半径/墨浓 |
| 多点触控/双指缩放 | 指距→聚光半径 | 只是多个 `pointerId` 的 `pointermove`；Safari 的非标准 `gesturestart` 不要依赖 | 双指调 r |
| `WheelEvent`+`deltaMode` | 滚轮/触控板增量 | 0=pixel、1=line、2=page；Chrome/macOS 触控板给像素（含小数），部分 Firefox 给 line，**必须归一化** | 滚动→扫卷/缩放 |
| `KeyboardEvent` | 全键盘可达、方向键/空格 | 全支持；注意 `event.code` 而非 `key`（输入法/布局） | 无障碍主干 |
| `DeviceOrientationEvent`+`requestPermission()` | 俯仰/横滚→倾斜移卷 | iOS 13+ 有此方法，**需 transient activation（点击）+ secure context**，返回 `'granted'/'denied'`；`requestPermission(true)` 才连带磁力计 | 倾斜=风/推卷 |
| `DeviceMotionEvent` (`accelerationIncludingGravity`) | 抖动/扇风节奏 | 与上面同 gating（iOS 需 `DeviceMotionEvent.requestPermission()`） | 取 1–3Hz 带通判"扇" |
| Generic Sensor（`AbsoluteOrientationSensor`/`GravitySensor`） | 四元数/重力 | **非 Baseline**（MDN "Limited availability"）：需 accelerometer/gyroscope/magnetometer 权限 + Permissions-Policy 放行；仅 Chrome/Android，Safari/Firefox 无实现，桌面 Chrome 常 `NotFoundError` | 仅渐进增强 |
| Web Audio `AnalyserNode` | RMS（气吹/呼吸）、谱通量（节拍）、基频 | 全支持；只能在 rAF 里读时域；`getFloatTimeDomainData` 比 byte 版精度好；需用户手势 unlock `AudioContext` | 吹墨、木鱼 |
| `AudioWorklet`/`MediaRecorder` | 音频线程 DSP / 录音导出 | AudioWorklet Baseline，适合低延迟 onset；`MediaRecorder` 别拿来做实时分析 | 高精度节拍 |
| Web Speech `SpeechRecognition` | 关键词指令 | Chrome/Edge 走 `webkitSpeechRecognition`（部分属性缺失）；Safari 14.1+ **需开 Siri**，且主屏 PWA / SafariViewController 中不可用；Firefox 仅 flag | 关键词换景 |
| `navigator.wakeLock` | 展厅常亮 | Chrome 84+ / Safari,iOS 16.4+ / Firefox 126+；**`visibilitychange` 后必须重新 request** | kiosk 必备 |
| Page Visibility | 隐藏时停 rAF/摄像/麦克风 | 全支持 | 省电、隐私 |
| `prefers-reduced-motion` | 减少位移/闪烁 | 全支持 | 无障碍必接 |
| `matchMedia` | `(pointer:coarse)`/`(hover:hover)`/`(any-pointer:fine)` | 全支持 | 选默认模态 |
| Fullscreen API | 沉浸 | **iOS Safari 无元素级全屏**（只有 `<video>` 的 `webkitEnterFullscreen`），用 `100dvh` 兜底 | 桌面优先 |
| Vibration API | 敲击触感 | Chrome 32+（**60 起需用户手势，否则返回 `false`**）；**Firefox 129 已移除**；Safari 从来没有 | 只做点缀 |
| Gamepad API | 无外设时的可选手柄 | 需用户按键后才出现在 `navigator.getGamepads()`，监听 `gamepadconnected` | 备用输入 |
| 摄像头零模型（frame differencing/亮度质心/运动能量） | 手影位置、遮挡度、挥动强度 | `getUserMedia` 需 https+手势；iframe 需 `allow="camera"`；`<video playsinline muted>` 否则 iOS 劫持全屏 | 皮影戏 |

### 关键代码骨架

**压感→笔锋（鼠标 0.5 陷阱）**
```js
cv.addEventListener('pointermove', e => {
  if (!e.buttons) return;
  const isPen = e.pointerType === 'pen';
  const p = isPen ? e.pressure : 0.5;        // 鼠标永远是 0.5，别当"满压"
  spot.r = 40 + 160 * p + 0.06 * Math.hypot(e.movementX, e.movementY);
});
```

**双指调半径**
```js
const pts = new Map();
cv.addEventListener('pointerdown', e => pts.set(e.pointerId, e));
cv.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, e);
  if (pts.size === 2) {
    const [a, b] = [...pts.values()];
    spot.r = clamp(Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY) * 0.35, 40, 420);
  } else { spot.x = e.clientX; spot.y = e.clientY; }
});
for (const t of ['pointerup','pointercancel'])
  cv.addEventListener(t, e => pts.delete(e.pointerId));   // 漏了这句会在抬指后卡住
```

**wheel 归一化**
```js
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
  spot.r = clamp(spot.r + e.deltaY * k * 0.25, 40, 420);
}, { passive:false });
```

**iOS 传感器授权（必须挂在按钮上）**
```js
btn.onclick = async () => {
  const DOE = DeviceOrientationEvent;
  if (typeof DOE?.requestPermission === 'function') {
    if (await DOE.requestPermission() !== 'granted') return fallbackToPointer();
  }
  addEventListener('deviceorientation', e => {          // beta: 前后倾 -180..180
    const t = clamp((e.beta ?? 0) / 60, -1, 1);          // gamma: 左右 -90..90
    spot.x = lerp(spot.x, W * (0.5 + clamp((e.gamma ?? 0)/60, -1, 1) * 0.4), 0.15);
    spot.y = lerp(spot.y, H * (0.5 + t * 0.4), 0.15);
  });
};
```

**麦克风：气吹 + 节拍（低中频能量比 + 谱通量）**
```js
const ctx = new AudioContext(); await ctx.resume();            // 手势内调用
const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.6;
const td = new Float32Array(an.fftSize), fd = new Float32Array(an.frequencyBinCount);
let prev = new Float32Array(fd.length);
function tick(){
  an.getFloatTimeDomainData(td);
  const rms = Math.hypot(...td) / Math.sqrt(td.length);        // 呼吸阈值 ~0.01
  an.getFloatFrequencyData(fd);                                // dB，-100..0
  let low = 0, mid = 0, flux = 0;
  for (let i = 0; i < fd.length; i++) {
    const hz = i * ctx.sampleRate / an.fftSize;
    const lin = 10 ** (fd[i] / 20);
    if (hz < 350) low += lin; else if (hz < 3000) mid += lin;
    flux += Math.max(0, fd[i] - prev[i]); prev[i] = fd[i];
  }
  if (rms > 0.03 && low > mid * 1.6) blow(0.6);                // 吹气：宽低频噪声
  if (flux > 900) onset();                                     // 木鱼/拍手
  requestAnimationFrame(tick);
}
```

**摄像头零模型：帧差质心（无 ML、无下载）**
```js
const v = document.createElement('video'); v.muted = v.playsInline = true;
v.srcObject = await navigator.mediaDevices.getUserMedia({ video:{ width:160, height:120 } });
const c = document.createElement('canvas'); c.width = 64; c.height = 48;
const g = c.getContext('2d', { willReadFrequently:true });
let last = null;
setInterval(() => {                                  // 15fps 足够，省电
  g.drawImage(v, 0, 0, 64, 48);
  const d = g.getImageData(0, 0, 64, 48).data, cur = new Uint8Array(64*48);
  for (let i = 0, j = 0; i < d.length; i += 4, j++)
    cur[j] = (d[i]*299 + d[i+1]*587 + d[i+2]*114) / 1000;   // luma
  if (last) {
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) {
      if (Math.abs(cur[y*64+x] - last[y*64+x]) > 18) { sx += x; sy += y; n++; }
    }
    if (n > 40) { spot.x = W * (1 - sx/n/64); spot.y = H * (sy/n/48); }  // 镜像
  }
  last = cur;
}, 66);
```

**MediaPipe 加载法（都无需 bundler）**
```html
<!-- A. 经典脚本：IIFE 版 vision_bundle.js 只存在于 tasks-vision ≥1.0.0（0.10.x 没有，404），
     文件头是 `var Vision=function(t){…}`，所以全局名是 Vision.*，不是裸 HandLandmarker -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.js"></script>
<script>
const { FilesetResolver, HandLandmarker } = window.Vision;   // 立即可用
</script>

<!-- B. 最省字节（0.10.21 只有 .mjs/.cjs）：.mjs 是真 ESM（文件末尾 export{...}），
     官方文档那段不带 type="module" 的 <script src="….mjs"> 会因顶层 export 抛 SyntaxError
     （我核对了文件末尾确实是 `export{…HandLandmarker…}`） -->
<script type="module">
import { FilesetResolver, HandLandmarker } from
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
const hand = await HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: 'hand_landmarker.task' }, numHands: 1, runningMode: 'VIDEO' });
</script>

<!-- C. legacy（0.4，冻结于 2023）：经典脚本，但必须 locateFile 指对目录 -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js"></script>
<script>
const hands = new Hands({ locateFile: f =>
  `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
</script>
```

## 2. GitHub 可复用参考（★ 与许可为 GitHub API 实测）

| 用途 | 仓库 | 事实 | 可复用点 |
|---|---|---|---|
| 帧差动作检测（纯 JS） | [beije/motion-detection-in-javascript](https://github.com/beije/motion-detection-in-javascript) | ★99, 8KB, **MIT**, 2019 | 最干净的教学实现：缩图→灰度→逐像素差→包围盒 |
| 同上（更快、mask 版） | [jasonmayes/JS-Motion-Detection](https://github.com/jasonmayes/JS-Motion-Detection) | ★114, 10KB, 无 license 文件（**引用需谨慎**）, 2020 | "运动揭示"式差帧 + 加权质心，风格接近本项目 |
| 同上（getUserMedia 早期范例） | [piratefsh/js-motion-detector](https://github.com/piratefsh/js-motion-detector) | ★35, 73KB, 无 license, 2017 | 降采样与阈值参数可对照 |
| 音高检测（最轻） | [ianprime0509/pitchy](https://github.com/ianprime0509/pitchy) | ★138, **0BSD**, v4 **ESM-only**，`index.js` **5.5KB gz**（另需 fft.js 2.8KB gz） | MPM 算法，`PitchDetector.forFloat32Array(n)` + `findPitch(td, sr)` → `[Hz, clarity]` |
| 音高（WASM） | [code4fukui/aubiojs](https://github.com/code4fukui/aubiojs) / npm `aubiojs@0.2.1` | ★0, `build/aubio.js` **59.6KB gz** + wasm，2022 后基本停滞 | yin/mel 现成，但无人维护 |
| 音高（ML，重） | [marl/crepe](https://github.com/marl/crepe)（ml5 `pitchDetection` 即其移植） | ★1421, MIT, 仓库 187MB；ml5 最新 **1.4.0**，`src/PitchDetection` 仍在 | 精度高但要 TF.js + 模型，画廊首屏不划算 |
| 节拍/拍手 onset | [Keavon/Web-Onset](https://github.com/Keavon/Web-Onset) | ★11, **GPL-3.0**（对 MIT 项目不友好，只读思路） | 谱通量 + 自适应阈值的完整实现 |
| QR（已在用） | [kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | ★2380, **MIT**, `dist/qrcode.js` **12.4KB gz**, UMD 无依赖 | 保持现状即可 |
| 眼动 | [brownhci/WebGazer](https://github.com/brownhci/WebGazer) | ★3911；`dist/webgazer.js` **314KB gz** + face_mesh wasm **1.64MB gz** + packed **3.55MB gz**；README 声明 **2026-02-24 起官方停止维护**；**GPLv3**（营收<100 万美元可谈 LGPLv3） | 体积与许可双重劝退；示例里的 9 点标定 + 精度页可借鉴 |
| 手势/人脸/姿态 | [google-ai-edge/mediapipe-samples-web](https://github.com/google-ai-edge/mediapipe-samples-web) | ★99, Apache-2.0, 2026 仍活跃 | 官方零构建示例（TS，但可读） |

> 更正：任务里给的 `soundjunkie/JS-Motion-Detection` **不存在**（404），实际仓库是 `jasonmayes`。

**MediaPipe 两代对比（实测传输字节）**

| | legacy `@mediapipe/hands@0.4.1675469240` | `tasks-vision@0.10.21` | `tasks-vision@1.1.1` |
|---|---|---|---|
| JS | `hands.js` 17.7KB gz | `vision_bundle.mjs` 39.9KB gz（**无 .js**） | `vision_bundle.js` 45.3KB gz（IIFE，有全局） |
| WASM | `*_simd_wasm_bin.wasm` 1.68MB gz | 2.65MB gz | **3.59MB gz** |
| 权重 | 打包在 `packed_assets.data` 3.92MB gz | `hand_landmarker.task` 7.82MB | 7.82MB |
| 首屏合计 | **≈5.6MB** | ≈10.5MB | ≈11.4MB |
| CDN 坑 | 冻结于 2023-02，旧文档 `google.github.io/mediapipe/solutions/hands.html` 已 **404**；必须自己 `locateFile`；版本号与 assets 不匹配即白屏 | 自动拼 wasm 路径，无 bundler 需求，但**只能用 `type="module"`** | 唯一"经典 `<script>` 就能跑"的版本 |
| 结论 | 想省 5MB 且能锁死版本→可选 | **推荐**（字节/维护平衡） | 需要非模块加载时才用 |

**"头姿代替眼动"**：不做眼动也可用 FaceLandmarker 的鼻尖在脸框中归一化偏移做粗定位（人体工学上比瞳孔稳定得多，成本≈人脸网格一份权重）。这是工程技巧而非某个库的特性，需自行标定（4~9 点线性映射）。

## 3. 八种模态排序（按"以光揭示色"契合度）

| # | 模态 | 为何契合水墨 | 难度 | 无障碍 | 主要失效模式 |
|---|---|---|---|---|---|
| 1 | **笔锋**：`pressure`/速度→半径与墨浓，`tiltX`→侧锋飞白 | 对应中锋/侧锋、提按；聚光即笔触 | S | 键盘可完全替代 | 鼠标无压感（恒 0.5）；触屏无 tilt |
| 2 | **指卷**：拖拽移卷 + 双指捏合调半径 | 手指"推卷"最直观，零学习成本 | S | 需要键盘等价物；目标≥44px | 双指与浏览器缩放冲突（`touch-action:none` 必设） |
| 3 | **手影/皮影**：摄像头帧差质心 | 影子掠过绢面→彩色显形，皮影戏母题，**零 ML 下载** | M | 动作幅度大即可玩；须有摄像头关闭路径 | 逆光/暗场失效；多人时质心漂移；权限拒绝；隐私 |
| 4 | **吹墨**：麦克风低频能量比判吹气 | 吹墨/吹云，气息推开墨层露色 | M | 呼吸力度差异大，阈值需可调 + 灵敏度设置 | 空调/音乐/展厅人声误触发；iPhone 需 `AudioContext.resume()` |
| 5 | **木鱼节拍**：onset 检测→离散手势 + 每击一次光晕脉冲 | 一击一"开"，节奏即叙事；可换场景 | M | 听觉通道天然友好；也适合运动障碍者的单次强输入 | 掌声/音乐踩点误判；延迟>50ms 即"不跟手" |
| 6 | **风/扇**：`DeviceMotion` 1–3Hz 带通，或 pointer 速度积分 | 扇风掀卷，色随气动 | M | 手机可玩，桌面需 pointer 兜底 | iOS 要 orientation+motion 双授权；晃桌误触发 |
| 7 | **手势**：HandLandmarker 指位=聚光，石头剪刀布=换景 | "以手拭尘"，手指即光；猜拳有展场互动性 | L | 需等价按钮兜底 | 首屏 10MB+；弱光/遮挡掉帧；发热；隐私提示 |
| 8 | **语音**：`SpeechRecognition` 关键词（"山水/花鸟/雪/星空"） | 吟诵/题跋式换景，文化感最强 | M | 对行动不便者最友好 | Chrome/Safari 行为不一；误识别；无离线保障 |

> 备选：呼吸引擎（与 #4 共用管线）、头姿光标（#7 的轻量替代）、reduced-motion 下的"静态揭色"。

## 4. 无障碍清单（全屏 canvas 作品）

1. **键盘主干**：方向键/WASD 移光、`Shift` 加速、`Space` 压感、`[` `]` 调半径、`1–4` 换景、`S` 换风格、`Esc` 退出；焦点环不可被 `outline:none` 抹掉。
2. **焦点管理**：叠加层用 `<dialog>`／`role="dialog" aria-modal="true"`，背后 `inert`；打开即聚焦、关闭归还焦点、`Tab` 不逃逸。
3. **`aria-live`**：场景/风格/轨迹切换用 `role="status" aria-live="polite"` 播报"已切换：山水·雪景"；**聚光移动不要逐帧播报**。
4. **减弱动效**：`prefers-reduced-motion: reduce` 关拖尾/视差/自动巡游，只留径向渐变淡入；另给显式"暂停动画"按钮（WCAG 2.2.2）。
5. **对比度**：聚光接缝不能只靠色相差异——加 1–2px 中性描边；文字 ≥4.5:1；兼容 `forced-colors` 与 `prefers-contrast`。
6. **视觉作品的替代文本**：`<canvas role="img" aria-label="水墨卷轴：雪景，聚光半径…">` + canvas 内 fallback；另设文字/音频描述当前画面；沿用现有 QR 分享静态帧。
7. **单手可达**：主操作落在下 40% 拇指弧内，目标 ≥44×44px，提供 ±半径按钮代替精确双指；横竖屏都要测 `100dvh`。
8. **权限即体验**：摄像头/麦克风/传感器**绝不作为唯一通路**，拒绝即降级到 pointer 并说明缘由；`wakeLock` 失败静默兜底。

## 5. Roadmap（需额外硬件 → 只记 TODO）

Wiimote（`Gamepad` 可读但浏览器映射不一致）、Leap Motion（WebUSB/WebSocket 桥）、Kinect（浏览器拿不到深度流，需本地桥）、Tobii（无 Web API）、MIDI（`requestMIDIAccess`：Chrome/Edge 有、iOS 无）、EEG（厂商 SDK）、IR 摄像头（UVC 可读但需本地处理）、Wacom（`pointerType==='pen'` 已覆盖，专属压力曲线可后置）。

**参考链接**：[PointerEvent.pressure](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pressure) · [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) · [WheelEvent.deltaMode](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode) · [DeviceOrientationEvent.requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static) · [AbsoluteOrientationSensor（非 Baseline）](https://developer.mozilla.org/en-US/docs/Web/API/AbsoluteOrientationSensor) · [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) + [WebKit bug 225298（主屏 PWA 不可用）](https://bugs.webkit.org/show_bug.cgi?id=225298) · [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) · [Navigator.vibrate](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) · [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) · [WCAG 2.2 SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) · [SC 1.1.1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html) · [iOS 元素级全屏不可用](https://developer.apple.com/forums/thread/133248) · [MediaPipe Hand Landmarker (Web)](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
