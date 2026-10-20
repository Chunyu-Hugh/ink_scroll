# 交互系统 · Interaction System

> 这份文档把「墨卷」的交互当成**一个系统**来定义，而不是一堆散落的事件监听。
> 只要遵守同一个契约，任何人都可以往画廊里再挂一盏灯。

## 1. 契约 · The contract

所有交互模态都被归一成同一个数据形状：

```ts
type Spot = { x: number, y: number, radius: number }   // 画布设备像素
```

渲染层完全不知道光是从哪来的。一个模态只要向 `M` 注册表里加一条：

```js
const M = {
  myMode: {
    icon:      'hand',        // ICONS 里的键（内联 stroke SVG）
    nameKey:   'modeHand',    // I18N 键，三语都要填
    group:     'cam',         // 'free' | 'cam' | 'gear' —— 决定卡片落在哪个分组
    needCam:   true,          // 进入时申请摄像头
    needMic:   false,         // 进入时申请麦克风
    needsPixels:false,        // 是否需要每帧 getImageData（贵）
    init(){},                 // 进入时启动传感器
    spot(fd){ return Spot|null },  // 每帧调用；null = 交给吸引循环
    spots(fd){ return Spot[] },    // 可选：一次多盏灯（多手机模式）
    cln(){},                  // 离开时释放一切
    ex(){ return '状态文字' },      // 可选：HUD「状态」行
    meter(){ return {label,value} } // 可选：HUD 电平条（把看不见的输入变得可见）
  }
}
```

加一个模态 = **一条注册表 + 一个 I18N 键 × 3 语言 + 一条测试**。没有 switch，没有分支散落。

离开时必须恢复现场：`cln()` 里停轨道、关 AudioContext、摘 `deviceorientation` 监听。
任何申请失败的路径都必须 `wM('mouse', {silent:true})` 回落——**交互永远不是单点故障**。

## 2. 交互矩阵 · Interaction matrix

### 2.1 免外设 · no extra hardware

| 模态 | 输入 | 映射 | 离散命令 | 反馈 | 失效与回落 |
|---|---|---|---|---|---|
| **自动展卷** `auto` | 无 | 慢速 Lissajous 自漂移 | — | 光圈自身移动，招呼路人 | 无（永远可用，适合展厅） |
| **指针 · 触屏** `mouse` | 鼠标 / 触控板 / 手指 / 压感笔 | 位置 → x,y；**笔压 → 半径**（`0.45+1.1·pressure`） | 拖动、滚轮/捏合改半径、双击换场景、长按留痕 | 光圈环 + 笔锋变粗 | 无（永远可用，是所有模态的兜底） |
| **声音 · 吟诵** `audio` | 内置麦克风 | 基频 → x（85–1400 Hz 对数映射）；**音色亮度 → y**；响度 → 半径 | 瞬态（拍手/喊）→ 泼墨 | HUD 电平条 | 拒绝麦克风 → 指针；环境噪音大 → 灵敏度靠 `[ ]` |
| **倾斜 · 掌中** `tilt` | 手机/平板陀螺仪 | 横滚 → x，俯仰 → y（进入时取零点） | `C` 重设零点 | 光圈 + 提示 | iOS 未授权 / 无传感器 → 指针 |
| **（键盘）** | 键盘 | 方向键/WASD 不动光圈但可控制一切 | 全量快捷键 | 焦点环 + aria-live | 永远可用 |

### 2.2 只用摄像头 · camera only

| 模态 | 输入 | 映射 | 离散命令 | 反馈 | 失效与回落 |
|---|---|---|---|---|---|
| **动影 · 皮影** `motion` | 摄像头帧差（**零模型、零下载**） | 变化像素的加权质心 → x,y；运动能量 → 半径 | — | HUD 电平条 | 太暗/静止 → 保持最后位置；拒绝摄像头 → 错误页 → 指针 |
| **手势 · 空手** `hand` | MediaPipe Hands（0.4，锁定版本） | 手心 → x,y；食指 → 细光束 | 握拳 = 收光；✌️ = 换场景 | 右侧手势图例实时高亮 | 无手 → 吸引循环；模型加载失败 → 保持吸引 |
| **面庞 · 头姿** `face` | MediaPipe FaceMesh | 鼻尖 → x,y；**张嘴幅度 → 半径** | — | HUD 电平条 = 张口度 | 无脸 → 「把脸放进画面」；加载失败 → 指针 |
| **手电筒** `flashlight` | 摄像头亮点 | 亮度直方图加权质心（O(n)） | — | 光圈 | 无光点 → 吸引循环 |

### 2.3 需要额外装置 · needs extra setup

| 模态 | 需要 | 说明 |
|---|---|---|
| **眼动 · 眼镜** `gaze` | 打印的 ArUco 标记 + 眼镜 + 5 点校准 | js-aruco2 26KB，亚像素；校准面板随时可用「先用指针玩」退出 |
| **手机 · 众光** `phone` | `server.py` 中继 + 观众手机 | 每部手机一盏灯；捏合调半径、按钮换场景/泼墨/收光；可多人同场 |
| **IR · 追踪器** `ir` | OpenMV/Pixy2 + WebSerial（桌面 Chromium） | 串口每行 `x,y[,area]`，同一 Spot 契约 |

## 3. 通用层 · Universal layer（与模态无关）

| 层 | 交互 | 实现 |
|---|---|---|
| 进入 | 标题页 3 组卡片；点击即切；`M` 循环模式 | `rebuildModeCards()` 按 `group` 分组 |
| 运行 | 底部悬浮控制栏：模式/场景/风格/光圈±/留痕/全屏/帮助/退出 | 触屏 44px，键盘可达，`role=toolbar` |
| 帮助 | `?` / `F1` / 控制栏「?」→ 单一面板列出全部模态 + 全部快捷键 + 触屏手势 | `role=dialog aria-modal`，焦点陷阱，Esc/背景点击关闭 |
| 触屏 | 拖动揭示 · 双指捏合改光圈 · 双击换场景 · 长按留痕 | Pointer Events 统一鼠标/手指/笔；`touch-action:none` |
| 键盘 | `M` 模式 · `←→/Space` 场景 · `1–4` 风格 · `+/−/滚轮` 光圈 · `[ ]` 灵敏度 · `X` 镜像 · `I` 留痕 · `O` 回墨 · `G` 长曝 · `K` 生兽 · `Y` 镜影 · `T` 天时 · `A` 氛围音 · `U` 众声 · `B` 击节 · `S` 存图 · `P` 静观 · `F` 全屏 · `?` 帮助 · `Q/Esc` 退出 | 全部走 `keydown`；`Esc` 优先关闭最上层浮层 |
| 分享 | `?mode=audio&scene=2&style=paper&lang=en` 深链，打开即自动开卷 | `applyDeepLink()` + `history.replaceState` |
| 存图 | `S` → 带题款与「印」的分享卡 PNG（按语言本地化） | `savePNG()` |
| 生态 | 变化都通过 `aria-live` 播报；`prefers-reduced-motion` 关掉粒子；`P` 可暂停（WCAG 2.2.2） | `announce()` / `REDUCE` / `S.paused` |
| 展厅 | `wakeLock` 保持屏幕常亮；`auto` 模式自展卷 | `wakeLockOn()` |

## 4. 反馈层 · Feedback（为什么"能感觉到"）

1. **光圈环**：内侧赤陶细线 + 外侧中性深线 —— 在浅色与深色画卷上都读得出来。
2. **HUD**：模式 / 场景 / 风格 / 光圈 / 状态，五秒内看懂当前一切。
3. **电平条**：声音、动影、面庞这类"看不见的输入"，用一条 3px 的墨色电平条变成可见反馈——这是它们能被玩起来的关键。
4. **文字提示**：进入模式、切换开关、失败回落都有 `flashHint`，同时进 `aria-live`。
5. **触觉**：手机端振动（`navigator.vibrate`，仅 Chrome/Android）。
6. **声音**：`A` 环境音（五声音阶 generative pad）、`U` 众声成墨、手机端拨弦反馈。

## 5. 降级顺序 · Degradation ladder

```
鼠标/触屏  ←  永远可用，是所有失败路径的终点
   ↑ 摄像头拒绝
手电筒 / 动影 / 手势 / 面庞  ←  摄像头可用
   ↑ 模型加载失败
   ↑ 陀螺仪无读数 / iOS 拒绝
声音 / 倾斜  ←  麦克风 / 传感器可用
```

任何一步失败都必须：① 说清楚为什么 ② 自动落到上一条 ③ 不打断正在播放的画卷。

## 6. 参考 · Further reading

- [`docs/interaction-research.md`](interaction-research.md) — 浏览器交互模态的工程调研：
  每个 API 的支持度与坑（压感恒 0.5、wheel 的 deltaMode、iOS 传感器授权）、
  MediaPipe 两代的实测字节数、可复用开源库及其**许可风险**（WebGazer=GPLv3，不能 vendor）
- [`docs/HARDWARE-TODO.md`](HARDWARE-TODO.md) — 需要外设的方向
- [`docs/SELF-IMPROVEMENT.md`](SELF-IMPROVEMENT.md) — 评测器怎么让"改进"可判定

## 7. 怎么加一个新交互（checklist）

- [ ] `M` 里加一条，填齐 `icon / nameKey / group / need* / init / spot / cln`
- [ ] `I18N` 三个语言各加 `modeXxx` 与 `firstHintXxx`（`test.js` 会检查键对齐）
- [ ] 失败路径 `wM('mouse',{silent:true})` + 一句解释
- [ ] 需要新图标 → `ICONS` 里加一条 24×24 stroke SVG（不要用 emoji：跨平台会变成方块）
- [ ] 在 `tools/test.js` 的「每一种交互模态」段加一行断言
- [ ] 更新本文件的矩阵表
