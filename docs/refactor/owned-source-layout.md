# 运行模块的实际归属迁移

## 本批范围

以 `6025b64bca6d57c1d0965fdecf5328a8b897ef4c` 为原 Git 来源，迁移 672 个文件：660 个程序和 12 个 Time fixture JSON。没有保留旧实现副本，也没有新增转发层。最终范围为 1,504 个实际当前文件和 672 条旧路径删除；范围包含模块引用、实际启动路径、包出口、工具及 fixture 元数据。

| 目录 | 本批归属 |
| --- | --- |
| `app` | CLI、配置读取与解析、运行生命周期、Agent 装配及模拟入口 |
| `engine` | 阶段、动作接收、死亡与终局的运行编排 |
| `features` | 各机制及普通夜能力、死亡行动的实际实现 |
| `rulesets` | 有限板子、角色目录、参数与装配 |
| `agents` | 决策、受限观察、提示、修复与回合协调 |
| `adapters` | ACP、SDK、终端及单文件持久化 |
| `recording` | session、严格复现格式、Trace 与独立 verifier |

这次移动保留完整业务程序、公开导出条款顺序、原对象和默认实例。`domain` 的 42 个模块已在先前提交迁移，不计入本批 672。checkpoint 的五个 live 读取／装配模块仍暂在 recording；后继将整组移至 `app/checkpoint`，纯归档格式保留原层。它们对应的 16 条原依赖没有获得豁免。

## 程序与运行路径

机械阶段核对了 1,475 个完整程序、6,317 处模块字面编辑和 9,988 个实际相对模块绑定；目标规范化的 AST、NodeArray、token 与 ESNext 输出一致，2,950 个完整逆向输出与原程序一致。真实 CommonJS 模块路径和局部别名可以变化，不能据此宣称原新 raw 输出完全相同。

机械证明之后另列 37 文件／83 个适配片段：CLI scripts、两种 ACP sidecar 的实际文件位置、Trace 三种有限布局、动态测试路径、包出口、fixture 准入与检查器。原 `smoke` 入口及 `release:check` 命令链保留。检查器识别真实的新所有者；旧观察／展示／repair 端口和 AI 执行模块仍按各自实际职责约束。

Time 的源码、测试及当前位置统一使用 `time-wolf-consort`。旧包子路径 `facts/time-consort` 明确退休，当前消费者改用 `@ai-werewolf-arena/game-contract/facts/time-wolf-consort`；角色、板子、事件、参数、种子、i18n 键和 fixture 来源 ID 不改。八份归档 payload 保持原字节，四份 Time 派生清单只更新当前位置。未知外部消费者使用的旧源码深路径也会退休。

## 两项明确的适配修复

首次 fixture 后处理发现，更早提交的两次公共包退桥没有登记到 sourceAsset 的准入规则：语言类型由 catalog 归 game-contract，迷雾事实由 game-text 归 game-contract。原始程序和 binding 摘要保持；新规则只接受两个精确来源／当前位置、固定原提交、原具名及类型模式，并核对原公共出口链和同一契约叶的十个完整声明及运行语句。没有授予任意包映射或后端值导入。

首轮类型检查另发现两条前端 CLI 仍引用已退休的 catalog `isLocale` 出口。仅将其导入接到 game-contract，参数、判断和渲染流程不改。新改的架构测试文件头还补明了测试层级；该中文注释调整的两个实际完整输出保持一致。

## 实际验证

- 机械证明通过；首次工具仅因 Git 路径输出超过默认缓冲退出，放大缓冲后完成，原日志保留。
- 受影响的八个类型项目首跑七项通过；前端两处遗漏导入修复后仅复查失败项目并通过。历史准入工具修改后只复查 tooling 并通过。
- 六个新增 fixture 风险声明首次通过，34 条断言；原三个声明被过滤，没有重复计数。
- 当前元数据后处理通过，五个 sourceAsset 的原程序／binding 摘要、八个 Time payload 及原来源／suite／acceptance 保留；实际写六份清单。
- 一处本批新改的中文职责头形状检查通过。准备态、首失败、修复和输入快照分别归档，不合称一次同输入全绿。

作者、Root 和独立代理交叉审查了映射、具体适配及历史准入。详见 [实际收据](generated/owned-source-layout-receipts.json) 与 [最终源快照](generated/owned-source-layout-source-ready-final.json)。本批没有运行付费模型、完整对局、浏览器或最终全量门禁；完整 C47 与逐机制登记仍继续。
