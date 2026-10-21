# 创作软件接入 · Creative-tool integrations

这一页回答一件事：**如果你已经在用某个设计/演出软件，怎么让它驱动墨卷。**

三条通道，全部零第三方依赖：

| 通道 | 谁用 | 入口 |
|---|---|---|
| **OSC**（UDP 9000） | TouchDesigner、Resolume、VDMX、MadMapper、Max/MSP、Pure Data、vvvv、ossia score、Chataigne、TouchOSC、Unreal、Unity(extOSC)、Ableton(Connection Kit) | `python3 server.py` → 页面选「OSC · 本地」 |
| **HTTP POST** | Blender（内置 Python）、Processing、openFrameworks、任何脚本 | `POST /send?room=ext`，载荷见下 |
| **postMessage / `window.InkScroll`** | p5.js、Hydra、three.js、任何网页/iframe/Electron | `examples/p5_drive.html` |

统一载荷（x/y 归一化 0..1）：

```json
{ "x": 0.42, "y": 0.61, "r": 1.0, "scene": 2, "style": 3, "cmd": "splat", "name": "blender" }
```

`r` 是半径倍率（0.02–3），`scene` 0–5，`style` 0–3，`cmd` 支持 `splat` / `paint`。
只发 `x,y` 也够用。

## 一条命令自检（真的跑，不是文档）

```bash
python3 tools/check_integrations.py
```

它自己起中继，然后：

```
TouchDesigner / OSC（udp 9001）
  ✓ OSC 报文被中继接收 — 5 条到达 SSE
  ✓ OSC /spot/x 单轴生效
  ✓ OSC /scene 生效

Blender（真无头跑一次）
  ✓ Blender 真的发出去了 — INK_POST 200
  ✓ 物体坐标被正确归一化 — INK_PAYLOAD {"x": 0.35, "y": 0.4, ...}

  5 passed   0 failed   0 skipped
```

- **CI 里会自动跑 OSC 那段**（`.github/workflows/e2e.yml`），所以 TouchDesigner 那条路径每次提交都被验证
- Blender 找不到时**明确 skip**（不是假装通过）
- 两种软件共用同一个载荷契约，所以这条检查同时覆盖 Resolume / Max / PD / Unreal 等所有 OSC 客户端

## 灯光 / 舞台（Art-Net）

页面状态 → **Art-Net DMX**，真灯跟着光圈走：

```bash
DMX_HOST=192.168.1.50 DMX_PORT=6454 python3 server.py 8888
```

| 通道 | 含义 |
|---|---|
| CH1 | 亮度（= 在场度 presence） |
| CH2 | 水平（x） |
| CH3 | 垂直（y） |
| CH4 | 光圈半径（r） |

默认**关闭**（不设 `DMX_HOST` 就不发包），避免普通演示往网络里撒包。
控台侧：把 Universe 0 的 CH1–4 指给一台摇头灯 / 一条 LED 灯带即可。

已验证（`python3 tools/check_integrations.py`）：

```
Art-Net DMX（灯光控台）
  ✓ 收到 Art-Net 包 — 530 字节
  ✓ OpCode = OpDmx (0x5000)
  ✓ 4 个通道映射正确（亮度/x/y/半径） — ch1..4 = 128,191,64,128
```

## 逐个软件

### Blender —— 已附脚本
`examples/blender_ink_spot.py`

- **零插件**：Blender ▸ Scripting ▸ 打开 → Run Script → 移动选中物体，光圈跟着走（每 3 帧 POST 一次）
- **自检**：`python3 examples/blender_ink_spot.py --dry`（不需要装 Blender）
- **走 OSC**：装 [NodeOSC](https://blenderartists.org/t/nodeosc-for-controlling-nodes-opensoundcontrol/1202179) 插件，
  OSC Out → `127.0.0.1:9000`，地址 `/spot`。适合把 Blender 的几何节点/驱动器接到光圈上
- 也可以反过来：用 `bpy` 读画面里的 `scene["ink_scene"]` 自定义属性来切画
- **已用真实 Blender 4.2.3 无头验证过**（`examples/blender_smoke.py`）：

```
$ blender -b --python-exit-code 3 -P examples/blender_smoke.py
INK_PAYLOAD {"x": 0.35, "y": 0.4, "r": 1.0, "name": "Cube.001"}
INK_POST 200
$ curl -N /events?room=ext
data: {"x": 0.35, "y": 0.4, "r": 1.0, "name": "Cube.001"}      ← 中继真的广播了
```

  一个在 (3, 0, -2) 的立方体 → 归一化 (0.35, 0.4)。

### TouchDesigner —— 协议面已验证（TD 本体仅 Win/macOS）

> 这台机器装不了 TouchDesigner（官方没有 Linux 构建），但 OSC 报文形状已逐条验证：
> `python3 examples/osc_probe.py` → **7/7 形状正确**，含 120 条 60fps 突发，坏包不崩。

**配方**
`examples/touchdesigner_osc.md`：`CHOP → OSC Out CHOP → 127.0.0.1:9000 → /spot`。
官方 OSC 文档见 [docs.derivative.ca/OSC](https://docs.derivative.ca/OSC)。

| 地址 | 参数 | 作用 |
|---|---|---|
| `/spot` | `f f [f]` | x, y, 可选半径 |
| `/spot/x` `/spot/y` `/spot/r` | `f` | 单轴（接一个推子/滑杆） |
| `/scene` `/style` | `i` | 换画 / 换风格 |

### p5.js / Hydra / 任何网页 —— 已附示例
`examples/p5_drive.html`：iframe 里放画卷，父页面 `postMessage({type:'ink',x,y,r})`。
同源页面更直接：

```js
window.InkScroll.spot(0.4, 0.6);      // 移光
window.InkScroll.scene(2);            // 换画
window.InkScroll.style(3);            // 纸本
window.InkScroll.splat();             // 泼墨
window.InkScroll.state;               // 读回当前状态
```

任何软件只要能把数据变成 HTTP/OSC/一次 postMessage，就能接进来 —— 这是这套设计的边界。

### 其他演出/装置软件（同一 OSC 通道）

| 软件 | 接法 | 备注 |
|---|---|---|
| Resolume Arena | OSC Out → 9000 → `/spot` | 与视频混合同步最直观 |
| VDMX / MadMapper | 同上 | 投影贴图场景里做"光区"很自然 |
| Max/MSP / Pure Data | `udpsend` / `netsend` → 9000 | 音频分析驱动光圈 |
| vvvv | `OSCEncoder` | 生成式视觉 |
| Unreal（OSC 插件）/ Unity（extOSC） | 9000 → `/spot` | 3D 场景里的光 |
| ossia score | 内置 OSC | 时间线式演出编排 |
| Chataigne | OSC 模块 | 不需要写代码的编排 |
| TouchOSC / Lemur | 9000 → `/spot` | 平板当调光台 |
| Processing / openFrameworks | `POST /send?room=ext` | 两行 HTTP 就行 |
| After Effects | 导出关键帧 → 脚本 POST | 预演式演出 |

## 为什么不直接上 WebSocket

因为**这些软件说的都是 OSC**。我在中继里把 OSC/HTTP 收下来，用 SSE 推给浏览器，
等价于「任何软件的输出 → 一个不需要插件的网页」，而且 `server.py` 只依赖标准库。
真要 WebSocket，`/events` 那条 SSE 换成 WS 也只是 20 行的事。
