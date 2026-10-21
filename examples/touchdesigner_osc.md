# TouchDesigner → 墨卷（OSC）

墨卷自带 OSC 入口，不需要任何插件或 Node 依赖。

## 1. 起服务

```bash
python3 server.py 8888        # 静态服务 + SSE 中继 + UDP 9000 的 OSC
```

页面里选「**OSC · 本地**」模式（或直接开 `?mode=osc`）。

## 2. TouchDesigner 侧

```
CHOP（比如 Constant / LFO / 鼠标位置 / 音频分析）
  → OSC Out CHOP
      Network Address : 127.0.0.1
      Network Port    : 9000
      Address         : /spot          ← 两个样本 = x, y；三个样本 = x, y, radius
```

`/spot` 的每个样本会被当成一个 float，按顺序映射成 x、y、r（0..1）。

| 地址 | 参数 | 作用 |
|---|---|---|
| `/spot` | `f f` 或 `f f f` | x, y（0..1），可选半径 |
| `/spot/x` `/spot/y` `/spot/r` | `f` | 单轴微调（适合单个推子/滑杆） |
| `/scene` | `i` | 0 山水 / 1 竹林 / 2 雪 / 3 花鸟 / 4 星空 / 5 立轴·3D |
| `/style` | `i` | 0 墨线 / 1 素描 / 2 暗调 / 3 纸本 |

## 3. 不想用 OSC？

同一个中继也吃 HTTP —— Dat 或 Web Client DAT 发：

```text
POST http://127.0.0.1:8888/send?room=ext
{"x":0.4,"y":0.6,"r":0.8,"scene":2}
```

或者用 `WebSocket DAT` 连不上没关系：**SSE** 才是页面订阅的那条（`/events?room=ext`），
发送侧只需要 POST。其余支持 OSC 的软件同理：Resolume / VDMX / MadMapper /
Max/MSP / Pure Data / vvvv / Unreal（OSC 插件）/ Unity（extOSC）/
Ableton（Connection Kit）/ ossia score / Chataigne / TouchOSC。

## 4. 为什么走 OSC 而不是 WebSocket

OSC 是这块领域的通用语言，几乎所有演出/装置软件都内置；
浏览器侧我用 SSE 接住，等于「OSC 输入 → HTTP 广播 → 页面」，**零第三方依赖**。
