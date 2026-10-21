# 预设 · Presets

现场只需要记一个词：`?preset=gallery|kiosk|stereo|lab`。

| 预设 | 用在哪 | 它做了什么 |
|---|---|---|
| `gallery` | 日常 / 网页分享 | 自动展卷 · 纸本 · 无墙无立体 |
| `kiosk` | 展厅开机即用 | 自动展卷 + **投影墙**（隐藏全部 UI）+ **校准网格**（A/B/C/D） |
| `stereo` | 立体墙 / 双机投影 | 点云场景 + **左右分屏** + 墙模式 |
| `lab` | 调参与调试 | 墨线（暗房光束）+ 指针 |

## 用法

```
https://hunao1995.github.io/ink_scroll/?preset=kiosk
https://hunao1995.github.io/ink_scroll/?preset=stereo
```

可以再叠加其它参数（`?preset=kiosk&lang=en`）：

| 参数 | 作用 |
|---|---|
| `?mode=<id>` | 指定模态（优先级高于预设里的 mode） |
| `?scene=0..6` | 指定场景（5 水墨 + 3D 视差 + 点云） |
| `?style=edges\|sketch\|dark\|paper` | 指定墨层风格 |
| `?wall=1` / `?wall=0` | 投影墙（隐藏 UI） |
| `?grid=1` / `?grid=0` | 校准网格 |
| `?stereo=anaglyph\|sbs` | 立体输出 |
| `?video=<url>` | 把任意 mp4/webm 当彩色层 |
| `?lang=zh-CN\|zh-TW\|en` | 界面语言 |
| `?debug=1` | 显示 FPS |
| `?effects=1` | 打开全部视觉特效（演示用） |

## kiosk 预设具体做了什么

1. `body.wall` → HUD、控制栏、提示、场景点、署名**全部隐藏**
2. 自动开卷（不需要点按钮）
3. 画出校准网格：三分线 + 画框 + 四角 **A/B/C/D** + 中心十字 + 当前分辨率与 DPR
4. 配合 `?preset=kiosk&grid=0` 可只留画面

校准交给 **MadMapper / TouchDesigner**：网格只提供参照，我们不做几何校正（见 `docs/VISION-3D.md` §6）。

## 展厅开机建议

```bash
python3 server.py 8888            # 静态 + SSE + OSC(9000)；要 DMX 再加 DMX_HOST
chromium --kiosk "http://localhost:8888/?preset=kiosk"
```

- 屏幕常亮：页面已用 `wakeLock`
- 观众离开 60s：`presence` 模态会让光圈自己收小（不会黑屏）
- 灯光跟随：`DMX_HOST=<控台IP> python3 server.py 8888`（CH1 亮度 / CH2 x / CH3 y / CH4 半径）

## 加一个新预设

改 `web/index.html` 里的 `PRESETS`：

```js
const PRESETS={
  gallery:{ mode:'auto',  scene:0, style:'paper', wall:false, grid:false, stereo:null },
  mine:   { mode:'audio', scene:3, style:'paper', wall:true,  grid:false, stereo:null },
};
```

然后在 `tools/test.js` 的「展厅预设」组里补一条断言。
