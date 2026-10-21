# 关于墨卷 · About Ink Scroll

> 一幅墨色立轴覆在彩色山水之上。你的手、声音、呼吸、摄像头，或任何创作软件，
> 控制一束光——**光落在哪里，哪里的墨就化开显色**。

**在线体验** <https://hunao1995.github.io/ink_scroll/> ·
**源码** <https://github.com/hunao1995/ink_scroll> · **许可** MIT

## 30 秒上手

1. 打开在线地址（手机、电脑都行，**不装任何东西**）
2. 首页按「需要什么」把玩法分组，选一个，点「展开画卷」
3. 鼠标/手指拖动即可；右下角控制栏能换模式、换画、调光圈、开帮助

## 它是什么

- **一件作品**：可以挂在展厅当装置，也可以是一个打开的网页
- **一套系统**：42 种交互模态共用一个契约 `{x, y, radius}`，渲染层不知道光从哪来
- **一个接口**：Blender / TouchDesigner / p5.js / 任何软件都能驱动它
- **一把尺子**：166 条端到端断言 + 7 维记分卡，改动对错有机器判据

## 当前能力（已完成）

| 档 | 数量 | 交互 |
|---|---|---|
| 什么都不用 | 13 | 自动展卷 · 指针/触屏 · 多指多灯 · 键盘 · 压感笔 · 凝视停留 · 吐纳 · 声音 · 拍手 · 语音 · 倾斜 · 摇一摇 · 环境光 |
| 只用摄像头 | 5 | 动影（帧差/皮影） · 手势 · 面庞头姿 · 眨眼 · 手电筒 |
| 插一个装置 | 9 | 手柄 · MIDI · HID 摇杆 · 蓝牙传感器 · NFC · 手机众光 · 眼动 · 串口追踪器 · （+ 打印标记） |
| 本机小脚本 | 2 | OSC（TD/Max/Resolume…） · 通用外设桥（Leap/Kinect/Tobii…） |

内容层：5 张水墨画 + 1 张程序化 3D 视差 + 视频层 · 三语界面 · 深浅两套视觉 · 全键盘可玩

## 接入方式

| 通道 | 适用 |
|---|---|
| OSC `udp/9000` | TouchDesigner、Resolume、VDMX、MadMapper、Max/MSP、Pure Data、vvvv、Unreal、Unity、TouchOSC |
| HTTP `POST /send?room=ext` | Blender（内置 Python）、Processing、openFrameworks、任意脚本 |
| postMessage / `window.InkScroll` | p5.js、Hydra、three.js、任何网页 |

契约：`{x, y, r, scene, style, cmd}`，x/y 归一化 0–1。

## 三类人怎么参与

| 你是谁 | 能做什么 | 入口 |
|---|---|---|
| 策展 / 运营 | 走查体验、提场景需求、贡献画面、翻译 | Issue（功能建议 / 场景图模板） |
| 创作 / 设计 | 用你的软件接一个作品上来，反馈手感 | Issue 附截图，或 PR 一个示例 |
| 开发 | 加模态、修 bug、补断言、改性能 | Fork → PR，`node tools/test.js` 全绿 |

## 判据（不靠主观）

```bash
node tools/test.js         # 166 条端到端断言：真浏览器、真模型推理、真中继、真 UDP OSC
node tools/rsi/score.mjs   # 7 维 fitness：e2e / i18n / 文档覆盖 / 失败路径 / 单文件 / 无障碍 / 核心机制
```

## 还没做的

- 可安装适配器：TouchDesigner `.tox`、Blender add-on（现在是脚本）
- 模板包：Ableton Live Set、TD 工程、Resolume 预设、Chataigne 工程
- AI 当导演（协议已就绪，缺示例） · 展厅轮播模式 · 更多画面与语言

## 一句话标准

**别人接进来要不要读我们的源码？不要，才叫生态。**
