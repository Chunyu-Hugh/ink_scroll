# VISION-3D · 从平面光到空间光

> 目标：在**不加构建步骤、不动 `{x,y,radius}` 契约、2D 仍是主入口**的前提下，
> 让「墨卷」具备空间性 —— 不是把画卷换成 3D 场景，而是让**光拥有深度**。
> 本页所有外部数字都附了实际抓取的 URL；抓不到的（Reddit）在 §2 末尾明说。

---

## 1. 结论先行

- **做「零字节空间化」**：把现有的 `drawCloud` 投影器升级成真正的 scene graph（相机 dolly、head-coupled 视差、红青立体、弧幕 warp）。全部手写，**0 新增 CDN、0 外链资产**，`{x,y,radius}` 一行不改。
- **第二条做「投影现场包」**：无 UI 全屏 + 校准网格 + 角点编号，发布即给 mapper。标定交给 MadMapper / MiniMad 一类工具（[madmapper.com](https://madmapper.com/)），我们只负责"能被标定"。
- **第三条做「身体入画」**：MediaPipe 关键点本来就有 z（face mesh **478 个 3D 关键点**、hand **21 个**），现在被压成 2D 用掉了；接成射线只花几十行，却一次点亮 hand/face/gaze 三个模态。
- **不引 three.js**：676 KB raw / 171 KB gzip，再加 GLTFLoader 110 KB 才等于一个"能装资产"的引擎 —— 而我们的点云只有 1 万点量级，canvas-2D 投影器已经够，引进来只是把"可读的单文件"换成"半个框架"。
- **不做**：WebXR、自写投影标定、2D→3D 整体替换（§6 有完整理由）；也**不做**单目深度大模型（19–27 MB 权重，见 §3）——它为"空间感"付的带宽代价，比它买到的深度质量贵得多。

**基线（本文所有 exit criteria 以此为参照）**：`web/index.html` 4578 行 / 217 KB / 28 个模态 / `SCENE_COUNT=7` / 2 个 CDN script；
`tools/last-run.json` = **146 pass / 0 fail**；`tools/rsi/archive.json` 最新一轮 fitness **0.938**，弱项 `degradation 0.536`、`modeCoverage 0.964`（`ir` 无断言）。

---

## 2. 需求证据

判定标准：**强** = 有金额/数量/投稿量等硬指标，或制度化采购；**中** = 行业报告、机构口径、可复现的社区规模；**弱/轶事** = 单点帖子、无法量化的观察。

| # | 信号 | 级别 | URL | 它意味着什么 |
|---|---|---|---|---|
| 1 | BLINK 2026（美国最大灯光/投影节）征件：2024 年收到 **944 份投稿、来自 65 国**，落地 **37 个投影 mapping 项目 + 31 个灯光装置**，观众 200 万+ | **强** | [blinkcincinnati.com](https://www.blinkcincinnati.com/newsroom/2025/07/08/blink-announces-2026-dates-and-opens-call-to-artists) | 空间光艺术有**超额供给的创作者**和**稳定的策展位**；投稿/展位比 ≈ 14:1（944 份 / 68 个落地项目），说明"能不能被选上"取决于作品形态，不取决于想法数量 |
| 2 | 文旅部行业标准 **LB/T 097-2025《智慧旅游 沉浸式体验空间要求与评价》** 已实施；首批 **42 个**试点，2025 年底全国成型项目约 **600 个**，"十五五"末预计 **>1000 个**、年服务约 **3 亿人次** | **强** | [workercn.cn](https://www.workercn.cn/c/2025-12-02/8673454.shtml) | 中国把"沉浸式空间"变成了**有评分表的采购品类**（100 分制：内容与体验 40 / 服务条件 35 / 管理能力 25）——这正是"可被写进招标文件"的东西 |
| 3 | 山西地质科技成果展厅「多媒体设备」中标：**¥1,197,800**，清单含 **7 台投影仪**（¥26,000/台）+ 9 块 LED 屏 + 触控一体机 | **强** | [ccgp.gov.cn](https://www.ccgp.gov.cn/cggg/dfgg/zbgg/202511/t20251119_25727499.htm) | 政府采购在为一个**展厅级空间视觉系统**付百万级预算；"投影 + 内容"是标准配置项，不是实验 |
| 4 | Gensler × Immersive Experience Institute《2025 沉浸式娱乐与文化行业报告》：被动形态停滞/下滑，**以参与和交互为核心的形态持续增长，部分接近翻倍**；**73%** 观众愿为感兴趣的项目出行 | **中** | [gensler.com](https://www.gensler.com/gri/immersive-industry-report-2025) | 需求在从"看"转向"参与"；报告的措辞是"观众变得更挑剔（more discerning）"，即**质量门槛在升**，不是数量红利 |
| 5 | teamLab 2025 年在东京两馆合计 **420 万+ 观众** | **中** | [eap-magazin.de](https://www.eap-magazin.de/Article/teamLab-Welcomes-More-Than-4.2-Million-Visitors-in-Tokyo.html) | 3D 粒子/空间水墨这条审美路线有**大众市场验证**，不是小众趣味 |
| 6 | teamLab《Universe of Water Particles》：自述基于"**超主观空间**"——前现代亚洲绘画对空间的认知，用 3D 粒子瀑布还原，线条取 **0.1% 粒子的轨迹** | **中** | [art.team-lab.cn](https://art.team-lab.cn/zh-hant/ew/waterparticles-kyoto/) | 最直接的对照：**"水墨的空间观"可以直接用 3D 表达**，且这是他们的常设主打，不是实验作品 |
| 7 | CURRENTS New Media 2026 征件：Installations 分类明确接受**交互式**，提供差旅/住宿/运输/**设备支持**，投稿费 $25 | **中** | [currentsnewmedia.org](https://currentsnewmedia.org/submission-guidelines-2026/) | 新媒体节展的"安装类"是为**空间装置**准备的资助通道；注意它单独列了 VR/AR 分类 —— 空间 ≠ 头显 |
| 8 | Sandy Spring Museum 户外装置征件：**$1,000 方案费 + $15,000–25,000 制作安装费**，明确要求 "interactive site features" | **中** | [wooloo.org](https://www.wooloo.org/opportunity/entry/423046) | 中型机构对"可交互的实体装置"有**明确预算档位**；这是"作品能被采购"的价格锚点 |
| 9 | Processing 论坛长期存在点云性能讨论帖（"Point cloud in Processing: what are the limits?" 13 帖；"3D Lidar point cloud to Blender" 8 帖） | **弱/轶事** | [discourse.processing.org](https://discourse.processing.org/t/point-cloud-in-processing-what-are-the-limits/1089) | 创作者确实在撞"点云上限"这堵墙 —— 但这是**技术求助**，不是需求证明 |
| 10 | B 站搜索「点云装置」返回满额结果（平台上限 1000 条），但头部内容以测绘/建模教程为主（点云配准、点云出正射） | **弱/轶事** | [api.bilibili.com](https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=%E7%82%B9%E4%BA%91%E8%A3%85%E7%BD%AE) | 中文语境里"点云"仍主要绑定工程测绘，**艺术向的点云内容供给是空的** —— 这是空位，不是需求 |
| 11 | 展厅多媒体采购的技术条款以"设备清单"计价（LED/投影/触控按套报价） | **强**（与 #3 同源） | [ccgp.gov.cn](https://www.ccgp.gov.cn/cggg/dfgg/zbgg/202511/t20251119_25727499.htm) | 反过来读：**内容/软件在报价表里没有独立行项** —— 我们若要进入这条链，交付物必须是"能挂在设备清单旁的可运行系统"，而不是"作品" |

**抓不到的部分（如实记录）**：`reddit.com` 直连与 `r.jina.ai` 镜像均返回 **403**（"You've been blocked by network security"），r/creativecoding、r/TouchDesigner 的帖子**无法取证**，本文不引用任何 Reddit 链接。知乎答案页同样 403。小红书未尝试取证（需登录态）。因此"社区热度"这一维度**证据不足**，不要拿它当立项理由。

---

## 3. 技术路线对照表

字节数为本机实测（`curl` + `Content-Length` / `size_download`，2026-10；gzip 为 `Accept-Encoding: gzip` 实测）。

| 路线 | 可行性 | 新增字节（实测） | 单文件代价 | 可测性 | 风险 |
|---|---|---|---|---|---|
| **手写 projector（现状升级）** | 高 | **0**（约 40–120 行 ≈ 2–5 KB） | 无 | **高**（像素级断言，已有先例） | 低；上限是 10⁴–10⁵ 点 |
| **three.js r170（CDN）** | 高 | `three.module.min.js` **691,648 B raw / 171,050 B gzip**；GLTFLoader **110,273 B**；OrbitControls **32,134 B** | 吃掉 2 个剩余 CDN 名额之一；ESM import 不计入 `script[src]` 计数（**别利用这个漏洞**） | 中（同一 canvas 可截图） | 中：首帧变慢、移动端显存、API 漂移 |
| **glTF / GLB 加载** | 低 | 资产 0.5–20 MB + loader 110 KB | **违背 single-file**（外链资产） | 低 | 高：资产管线 = 构建步骤的影子 |
| **单目深度（transformers.js + Depth-Anything-V2-Small）** | 中 | 运行时 `transformers.min.js` **748,496 B**；权重 `model_q4f16` **19.1 MB**、`model_int8/quantized` **27.3 MB**、`model.onnx` **99.1 MB**（[HF 仓库](https://huggingface.co/onnx-community/depth-anything-v2-small)） | 首次 20–30 MB 下载；离线展览不可用 | 中（深度图可缓存后断言） | **高**：50–200 ms 延迟、对展厅光照敏感、显存 |
| **立体 / 视差作弊**（红青、SBS、head-coupled） | **高** | **0**（点云已有 yaw/pitch，加眼距或头部偏移即可） | 无 | 高（左右通道像素差可断言） | 低 |
| **MediaPipe 关键点 → 3D 射线** | **高** | **0**（hands/face 已加载；[face mesh 输出 478 个 3D 关键点](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)，[hand 21 个](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)） | 无 | 中（`tools/fixtures/hand.jpg`、`face.jpg` 已在） | 低：z 是相对深度，只能做"姿态"不能做"测距" |
| **深度相机（Kinect / RealSense）走 bridge** | 中 | 浏览器端 **0**（只收降采样深度，如 64×48）；桥端 Python | 现场需一台机器 + 驱动 | 中（可喂录制帧） | 中：驱动、丢包、每台设备一套标定 |
| **多投影输出 + 校准网格** | **高** | **1–2 KB**（网格、编号、角点、安全边距、G 键切换） | 无 | **高**（网格线数/编号可截图断言） | 低：我们**不做**几何校正 |
| **3D 音频（PannerNode / HRTF）** | **高** | **0**（[PannerNode 自 2015 起 Baseline](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode)） | 无 | 低（只能断言 `positionX/Z` 参数，听感不可断言） | 低：需用户手势解锁 AudioContext |
| **WebGPU** | 中 | 自写 compute 约 5–10 KB；`three.webgpu.min.js` **221,500 B gzip** | 需要第二套渲染路径 + 回退 | 低 | 中：[caniuse](https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/webgpu.json) 显示 Chromium 早已 `y`、Safari 27 `y`、**Firefox 160/161 仍是 `a`（部分）**，iOS 27 才 `y` |

**读表结论**：把"空间感"卖给观众的最短路径**不是引擎，是相机模型**。现有 `drawCloud` 已实现透视投影 + 雾化 + yaw/pitch（`web/index.html` 的 `buildCloud` / `drawCloud`，110 px 采样、亮度当深度、`test.js` 断言 >1000 点且视角变化）——缺的只有：**相机 z 平移、眼点/头位、双通道、曲面 warp、以及"外部 z"协议**。这五件事全是加法，且都在 100 行以内。

**一个已经躺在协议里的缺口**：手机消息类型 `pose6d` 的注释写着"WebXR 6DoF 空间魔杖"，它的 `msg.z` 今天被拿去**调半径**（`web/index.html` 第 3245 行）；而外部驱动的统一载荷 `{x,y,r,scene,style,cmd,name}` 在 `extIngest` 里**根本没有 z**。也就是说：**深度已经在线路上跑，只是没进场景**。把 `z` 从"半径调制"改成"相机深度"，是整个 3D 计划里性价比最高的一次改动。

---

## 4. 交互构想（11 个）

工作量：**S** ≤ 半天、**M** ≤ 3 天、**L** ≥ 1 周。

| # | 名称 | 一句话 | 用户做什么 | 看到什么 | 技术内核 | 量 | 水墨契合 |
|---|---|---|---|---|---|---|---|
| 1 | **卷中游** | 光沿画卷厚度推进 | 前后倾身 / 滚轮 / 摇杆 Y | 光圈"沉进"画里，近处墨点被推开、远处浮出 | `drawCloud` 加相机 dolly + 近裁剪 + 深度排序 | M | 立轴本身就是"可进入的纵深"，这是最正统的一步 |
| 2 | **视差之眼** | 观众就是相机 | 左右挪动头/身体 | 画卷像一扇窗，前后景错开 | face landmark 眼距/鼻尖 → 观察者 x,y,z → 相机偏移 | S | "观画如临"——手卷的观看方式本来就是移动视点 |
| 3 | **立体墨** | 红青眼镜下的墨 | 戴上 10 元红青眼镜 | 墨点在纸面之外悬浮 | 两次渲染，通道合并（或 SBS 供双投影） | S | 墨的"厚度"第一次真的可测 |
| 4 | **手为笔，影为墨** | 手的 21 个关节点成了点云 | 伸手进画面、推、抓 | 一只由墨点组成的手，z 就是墨的深度 | hand landmarks → 3D 点云 + 与画卷点云同场排序 | M | 手是笔，影是墨：把"运笔"从 2D 轨迹变成 3D 体积 |
| 5 | **双人四手** | 两个人各持一团墨 | 两人同时伸手，靠近 | 两团墨在中间相遇处"洇"成一片 | 双 hand landmarker 实例 + 两光标 + 中点生成 splat | L | "墨分五色"变成"两人分一水" |
| 6 | **投影墙包** | 交付物是"可被标定"的画面 | 策展人按 G | 全屏无 UI，浮现校准网格、角点编号、安全边距 | 网格绘制 + 四角标记 + `?wall=1` 参数 | S | 装裱：画心之外必须留白边 |
| 7 | **深度之障** | 人站在画前，成了墨 | 走进投影区 | 人形轮廓变成一团墨障，挡住彩色层 | bridge 送 64×48 深度 → 阈值 → 遮罩 → 墨团 | M | "人在画中游"，且是字面意义 |
| 8 | **声之纵深** | 每个墨点有个位置 | 光靠近某处墨 | 声音从那个方向传来，越近越响 | `PannerNode`（HRTF），限 8 个源 + 距离衰减 | M | 画有远近，声也该有 |
| 9 | **卷轴成弧** | 画卷弯成弧幕 | 策展人选曲率 | 画面在弧幕/柱面上不变形 | 网格 warp（圆柱/贝塞尔）作用于投影器 | M | 手卷本来就是卷起来的 |
| 10 | **风与纸** | 纸自己在动 | 光扫过、或"呼气" | 纸面起伏，墨点随之荡开 | 网格顶点噪声场（noise）+ 点云附着采样 | M | "纸寿千年"，纸是有生命的介质 |
| 11 | **落款在画外** | 印章浮在最前层 | 任何模态触发 | 印章/题跋以最大视差飘在画外 | 独立 z 层 + 视差系数 1.0 | S | 印章从来盖在画外，这是最便宜的一次"破框" |

**组合建议**：#6 + #1 是最小可交付的"空间版"（一个下午能看到差异）；#2 是留存率最高的一步（人一动就有反应）；#4 是演示时最容易让人"哇"的一步。

---

## 5. 三阶段实施计划

所有 exit criteria 都可机器验证；`node tools/rsi/score.mjs` 会往 `tools/rsi/archive.json` 追加一行（预期行为，不要手动改该文件）。

### P1 · 空间内核（零依赖，约 2 周）

做：#6 投影墙包 → #1 卷中游 → #2 视差之眼 → #3 立体墨。
**Exit criteria**
- `node tools/test.js`：**≥ 152 断言全绿**（当前 146），新增至少 6 条：点云相机 z 位移改变画面、网格线数/角点编号、红青两通道像素差、head-coupled 位移方向、`?wall=1` 无 UI、坏深度输入不崩。
- `node tools/rsi/score.mjs`：**total ≥ 0.938 且无任一维度回退**（这是 RSI 循环的硬规则：只保留不回退的变异）。
- `singleFile` 仍为 1：**CDN 仍 2 个**，`index.html` 增量 ≤ 15 KB。
- 1440p 下 `drawCloud` + 视差 ≥ 55 fps（现有基线可用 `tools/probe-real2.js` 量）。

### P2 · 身体入画（约 3 周）

做：#4 手点云 → #7 深度之障 → #8 3D 音频 → 打通 `z` 协议（`pose6d` 的 z 进场景；`extIngest` 增可选 `z`，向后兼容）。
**Exit criteria**
- `node tools/test.js`：**≥ 160 断言**；hand/face 断言复用现有 `fixtures/hand.y4m`、`face.y4m`（真推理）。
- `degradation` 从 **0.536 → ≥ 0.70**（给 13 个无失败路径的模态补 hint，顺带把这个弱项抬起来）。
- `score.mjs`：**total ≥ 0.95**；**新增维度 `spatialCoverage`**（有 z 的模态数 / 总模态数），首轮目标 ≥ 0.5。
- 契约不变：`{x,y,radius}` 仍是唯一必需形状，`z` 只做可选扩展。

### P3 · 现场包（约 4 周）

做：#9 弧幕 warp、#5 双人、#10 风与纸、#11 落款；加 kiosk 模式（无光标、无菜单、10 分钟无操作自动复位）+ OSC 场景表 + 一页现场手册。
**Exit criteria**
- `node tools/test.js`：**≥ 166 断言**；`node tools/rsi/score.mjs`：**total ≥ 0.96，`modeCoverage` = 1.0**（当前 0.964，`ir` 缺断言）。
- **4 小时 soak**：内存增长 < 50 MB，无 `requestAnimationFrame` 掉帧累积（可脚本化断言）。
- **可用性验收**：一位不熟悉本项目的 mapper，30 分钟内用 MadMapper 完成双投影标定并让画面贴合 —— 做不到就说明网格信息不足，回来改交付物。
- 交付物三件：`index.html`、网格页（同一个文件 + `?wall=1`）、现场手册一页。

---

## 6. 不建议做的

1. **WebXR / 头显**（业主已否决）。补充数据：按 [caniuse webxr](https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/webxr.json)，Safari 27.2 与 iOS Safari 27.2 均为 `n`、Firefox 160/161 均 `n`，Chromium 也只是 `a`（部分）—— 也就是说"不引入运行时前提下覆盖 iOS"根本不成立。更关键的是需求侧：§2 的三条强信号全是**公共空间**采购（节庆、展厅、博物馆），其第一诉求是"一次 200 人轮流看"，不是"一人一副眼镜"。这也是任务书之外的一条独立理由。
2. **自写投影几何标定**（业主已否决）。MadMapper 已经把这件事做成了产品线（`MadMapper / MiniMad / MadProjectorControl`，[madmapper.com](https://madmapper.com/)），而且它有专用播放硬件。我们重复实现只会得到一个更差的版本；**我们输出网格，他们输出标定**。
3. **2D 换 3D 整体替换**（业主已否决）。现有 `SCENE_COUNT=7` 已经是"5 幅画 + 1 个程序化视差 + 1 个点云"的**加法结构**，这正是正确形态：3D 是**可选层**，不是新地基。任何"默认进入 3D"的改动都会降低首屏的"墨"密度。
4. **引入 three.js**。171 KB gzip 换来的能力（相机、矩阵、投影、排序）在 100 行内可手写；换来的**代价**是"单文件可读性"这一项目唯一护城河。而真正的资产能力（GLTFLoader）我们又不需要（见下条）。
5. **glTF/GLB 资产管线**。它必然带来"资产目录 + 打包体积 + 版本管理"，等于偷偷引入构建步骤，直接违反硬规则。
6. **单目深度大模型**。19.1–27.3 MB 权重 + 748 KB 运行时，在**离线展厅**（网络不可靠）几乎不可用；而它的输出精度不足以支撑投影墙上的"人形墨障"。**深度相机（#7）用 100 KB 的桥接解决同一个问题，质量还更高。**
7. **自建节点图 / 编辑器**。那是 TouchDesigner 的地盘，我们赢不了，也不该赢。
8. **为通过 fitness 而钻正则**。`score.mjs` 的 `singleFile` 只数 `<script src="http...">`；ESM `import` 里的 CDN 不算。**利用这个漏洞等于自己骗自己**，本文明确禁止。

---

## 7. 待验证的假设

| # | 假设 | 我们不知道什么 | 最便宜的验证 |
|---|---|---|---|
| 1 | 观众真的感知到 z，而不只是"画面在动" | 深度是否提升停留时长/重看率 | 同一幅画 A/B：z 开 / z 关，各 50 人，测停留时长与"是否伸手"的比例 |
| 2 | head-coupled 视差在小屏上有效 | 手机前置摄像头 + 单人场景是否成立 | 一天：用 `?mode=face` 让 10 人试，问"像不像窗"，记录眩晕反馈 |
| 3 | 展厅光环境下墨层仍成立 | mono 层在 3000 流明投影 + 环境光下的对比度 | 一台投影、一间暗房、一小时：投 `?wall=1`，量灰阶 |
| 4 | 校准网格足以让 mapper 接管 | 网格需要多少信息才够（角点？编号？安全边距？） | 找 1 位 mapper 做 30 分钟计时测试（P3 的验收项，提前到 P1 做一次） |
| 5 | 深度相机数据能走现有 bridge | 64×48 深度在 `POST /send` 的延迟/丢包表现 | 半天：用录制的深度序列回放，测 5 分钟丢帧率 |
| 6 | 3D 音频被感知为"空间"而非"音量变化" | HRTF 在展厅多点声源下是否可辨 | 10 人盲测：只改 `positionX`，问"左还是右"；正确率 < 80% 就砍掉 #8 |
| 7 | 采购链能接受"浏览器 + 无构建"交付 | 招标文件是否隐含"必须有安装包/加密狗" | 读 3 份展厅多媒体招标技术条款（[ccgp.gov.cn](https://www.ccgp.gov.cn/cggg/dfgg/zbgg/202511/t20251119_25727499.htm) 这类公告的附件） |
| 8 | 中文艺术向点云内容是空位而非无需求 | B 站/小红书"点云艺术"是否真的没人做 | 各搜 3 个词，记录头部作品的播放/点赞分布（半天） |

---

### 附：本文取证的边界

- 所有 URL 均为本次实际抓取（`web_fetch` 或 `curl`，2026-10-21）；字节数为本机实测。
- **Reddit 与知乎返回 403，小红书需登录**，因此 §2 完全没有社区热度类证据 —— 这是本页最大的证据空洞，不要用"社区很热"来支撑决策。
- 三个被否决项在 §6 第 1–3 条；本文档不提出任何与之重叠的方案。
