# RSI loop · 这个仓库怎么自我改进

对应 [awesome-rsi](https://github.com/lobehub/awesome-rsi) 的 **Harness-level RSI**：
*Self-Verification & Self-Correction* + *Harness & Scaffold Evolution* + *Evolutionary & Open-Ended*（变体档案）。
模型本身不改，改的是**脚手架**：交互、断言、文档、失败路径。

## 循环（一轮 5 步）

```
1 score   node tools/rsi/score.mjs --run      # 7 个维度，给出 fitness 与最弱的那个
2 propose 针对最弱维度，只提一个改动（一个模式 / 一条断言 / 一处文档）
3 mutate  改代码（守 docs/INTERACTIONS.md 的注册表契约）
4 verify  node tools/rsi/score.mjs --run      # 任何维度回退 → 丢弃这轮
5 keep    全维度不回退 → commit；archive.json 自动追加一行（= 变体入档）
```

## 七个维度（fitness 向量，不是单一分数）

| 维度 | 为什么它在 |
|---|---|
| `e2e` | 141 条端到端断言的真实通过率（真浏览器、真模型推理） |
| `i18n` | 三语字典键集合必须完全一致 |
| `docsCoverage` | 每个注册模态都必须被 `docs/INTERACTIONS.md` 覆盖（文档即契约） |
| `degradation` | 每个模态都必须有失败路径（提示或回落），不允许死路 |
| `singleFile` | 不限入构建、CDN 脚本 ≤4（项目唯一硬规则） |
| `a11y` | role/aria-live/aria-modal/reduced-motion/toolbar 五件套 |
| `coreMechanic` | 必须有一条断言直接测"光圈内外颜色不同"，否则等于没测那件事 |

## 和 DeepSeek Harness 的对应

| RSI 概念 | DSH 原语 |
|---|---|
| 一轮 = 一个全新上下文 | `ralph`（每轮新 agent，工作区=长期记忆，只有结构化报告跨轮） |
| 变异算子 | `subagent` / `workflow` 扇出（K 个候选并行，judge 选一个） |
| 选择压力 | `tools/rsi/score.mjs` 的 fitness 向量 |
| 变体档案 | `tools/rsi/archive.json` + git 提交历史 |
| 长期记忆 | `docs/`（契约、报告、TODO）+ `CLAUDE.md`/README |

## 变异算子清单（agent 可以自己挑）

1. 加一个模态（注册表一条 + 3 个 i18n 键 + 1 条断言 + 文档一行）
2. 把一条弱断言变强（例如从"能进入"改成"真的认出了东西"）
3. 补失败路径（缺 hint/回落的模态）
4. 把文档与实现对齐（`docsCoverage`）
5. 缩 `web/index.html`（不能降功能）或换更稳的 CDN
6. 修 CI 上暴露的跨浏览器差异

**唯一禁忌**：为了拉高分数而削弱断言。`coreMechanic` 与 `e2e` 的断言只能加强。
