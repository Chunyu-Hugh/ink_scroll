# 递归自我改进 · Recursive Self-Improvement Harness

> 这是回答一个很具体的问题：*"有没有现成的 recursive self-improvement 框架可以直接套在这个仓库上？"*
> 答案：**框架是次要的，可判定的评测器才是主要的。** 这一页说明本仓库怎么把"能自我改进"这件事变成工程。

## 1. 为什么大多数 self-improvement 框架套不上

| 框架 | 思路 | 为什么不适合这里 |
|---|---|---|
| [Darwin Gödel Machine](https://github.com/lemoz/darwin-godel-machine) / [Gödel Agent](https://github.com/zhaoyang97/Paper-Notes-en) | 让 agent 改**自己的代码**，用 benchmark 分数做适应度，维护变体档案 | 需要一个**可自动评分的目标**。一个艺术装置没有 SWE-bench 那样的分数，DGM 会优化"测试通过率"而不管好不好看 |
| [OpenEvolve](https://pypi.org/project/openevolve/)（AlphaEvolve 的开源实现） | 进化式搜索：program + evaluator + 变体池 | 同样是"有 evaluator 才成立"。它适合**参数/算法**搜索（如墨层阈值、映射曲线），不适合"加一个新的交互模态"这类离散结构改动 |
| SEAL / 自训练类 | 让模型生成微调数据自我迭代 | 要训练基础设施；与"单文件、零构建"的产品约束无关 |
| Reflexion / 自反思循环 | 失败→写反思→重试 | 有效，但**仍然需要一个不会说谎的判据**，否则就是自我感觉良好 |

它们的共同前提是同一件事：**存在一个便宜的、可自动运行的、与目标对齐的评分函数。**
所以本仓库把那件事做出来了，剩下的循环用最朴素的 harness 即可。

## 2. 本仓库的评测器（核心资产）

```bash
node tools/test.js        # 141 条端到端断言，真实 Chromium + 假摄像头/麦克风 + 真 SSE 中继
cat tools/last-run.json   # 结构化结果：{pass, fail, skipped, failures[], at}
```

它是**真的在跑**，不是桩：

- 真浏览器、真 `getUserMedia`（假设备喂一张 NASA 公有领域肖像 + 一段移动白条 Y4M）
- **动影**：帧差质心必须跟着移动的白条走 —— 断言的是算法，不是"函数被调用了"
- **声音**：真的开了一个 `AudioContext` + `AnalyserNode`
- **手机魔杖**：`server.py` 真的起来，第二个页面真的当手机发 POST，大屏真的收到并画出光圈
- **无障碍**：`role` / `aria-live` / 焦点陷阱 / `prefers-reduced-motion` / 暂停开关
- **i18n**：三语键集合必须完全一致（差一个键就红）
- **性能**：fps 下限 + 墨层生成时间预算

于是"改进"有了可判定的定义：

```
fitness = test.pass / test.total          （硬约束：fail 必须为 0）
         ∧ 视觉审查（人看截图）
         ∧ 不超过"单文件、零构建"的产品约束
```

## 3. 循环怎么跑

```
   ┌─────────────────────────────────────────────────────┐
   │  1. 读 docs/TEST-REPORT.md 的失败项 / 新需求          │
   │  2. 改 web/index.html（严守注册表契约）               │
   │  3. node tools/test.js        ← 自动判分             │
   │  4a. 全绿 → 截图人审 → git commit（= 一个新变体入档） │
   │  4b. 有红 → 回到 1，按失败信息改                      │
   │  5. 给评测器**加一条断言**（这一轮的收获固化成规则）   │
   └─────────────────────────────────────────────────────┘
```

第 5 步是关键，也是"递归"真正发生的地方：**评测器自己也在进化**。
每修一个 bug、每加一个模态，就多一条断言，下一轮的 agent 无法把它改坏。
这比换一个更强的模型更能保证质量单调上升。

在 DeepSeek Harness 里可以直接用 **Ralph loop**（每轮一个全新 agent、以工作区为长期记忆、
只有结构化报告跨轮传递）来跑这个循环：

```
ralph("把 ink_scroll 的 tools/test.js 跑成全绿，并在不违反单文件约束的前提下
       让 docs/INTERACTIONS.md 的矩阵表每一项都有对应断言")
```

外部框架不是不能用，而是**要先把 evaluator 接到本仓库**：
OpenEvolve 可以拿 `tools/test.js` 的 pass 数当 score，去搜 `sobel` 阈值、`audio` 的
pitch→x 映射曲线、`motion` 的差异阈值这类**连续参数**；但它不该碰"再加一个模态"这种
离散结构改动，那需要人来定契约。

## 4. 契约让"改进"可组合

`docs/INTERACTIONS.md` 里的注册表契约（`{icon,nameKey,group,needCam,needMic,init,spot,cln,ex,meter}`）
是让自动改进不至于把架构改烂的护栏：

- 加一个模态 = 一条注册表 + 3 个 i18n 键 + 1 条断言 → 可以机械验证
- 渲染层只认 `{x,y,radius}` → 换掉任何输入都不影响画面
- 失败必须 `wM('mouse',{silent:true})` → 任何新模态都不会把作品变成死路

## 5. 现在已经固化的"规则"（每一轮测试都在守）

1. 三语键集合必须对齐（拒绝"只加中文"）
2. 每个模态都能进入、不报错、失败有出口
3. 默认模态必须是零门槛的（曾经因为默认 `phone` 而整站不可用）
4. 场景图必须是真 JPEG，且 `cover` 铺满（不留黑边）
5. 触屏必须能完成所有操作（不依赖键盘）
6. canvas 必须有 `role="img"` 与可读描述；状态变化必须播报
7. `prefers-reduced-motion` 必须被尊重；必须有暂停开关
8. 退出必须释放摄像头
9. fps 与墨层生成时间不得回退

## 6. 下一步可以继续自我改进的方向

- 把「视觉审查」也自动化一点：截 4 个视口的图，用像素直方图断言"画面不是全黑/全白/未变化"
- 给 `sobel`/`pap` 的阈值做 OpenEvolve 式小搜索（fitness = 边缘密度落在目标区间 + 人审）
- 把 `docs/INTERACTIONS.md` 的矩阵表解析成断言清单，缺断言就红（文档即测试）
