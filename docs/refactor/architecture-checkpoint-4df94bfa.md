# 固定 4df94bfa 结构增量检查（真实红）

输入只来自已提交 `4df94bfafcf0f249b900a46a568ad427d069ad83` 的 **3,160 个公开 Git 原始文件**与同提交 **508 个文档路径**。开跑前捕获每文件实际 blob、mode、原始 SHA、完整临时文本输入及 sourceDigest，并核六个实际执行工具与该 Git 全字节一致。私有 configs／认证、node_modules、DR4／NP3 及其它工作树 WIP 均不入固定输入。

唯一后台运行为 launch `e93618`、session `47701`，实际 terminal `dc6353` **退出 1**。没有重启或重跑。本检查调用原 progressive `checkArchitecture`，不使用 strict、映射或额外豁免；不是最终全门禁。

| 结果 | 数量 |
| --- | ---: |
| 当前结构诊断 | 354 |
| 新增失败 | **1** |
| 原债剩余 | **353** |
| 原债已清 | **1,426** |

原冻结 **1,779 项**债务 SHA 仍为 `297b945bcdc85873b1d44e9e0ae705cddc1af8fd3e2fa5acfdb443f036550e5d`，文件未修改。353 原债 ID 与1,426清除 ID 完整、不重叠地分区原1779全集；新增失败另列，没有写回债务消除回归。

## 唯一新增与后续边界

`dependency.unresolved-target`：固定 `backend/tests/unit/rulesets/wolf-tool-admission.test.ts:24` 的显式、被引用退休类型负例，直接 `typeof import("../../../src/game/mechanisms/roles/wolf/validation_rules")`。旧叶已按功能授权删除，TypeScript 的 `ts-expect-error` 验证退休，而原结构门禁仍把该静态 import-type 认作未解析依赖；这是此固定输入真实失败，不冒充架构全部绿，也不是重新运行的新游戏错误。

Root 后继计划以实际模块解析负例保留退休覆盖、避免静态 unresolved dependency；后继源码或有界替换诊断不得覆写本固定红报告。捕获方未为此修改产品、测试、原 debt 或门禁规则。

## 与上一固定检查差分

上一固定 `37f56392322fdfa859b0d674f339693e0ca883ff` 是360原债／1419清除。此次**另清7项、返回0项原债**：两backend scripts职责头、女巫两项旧跨角色依赖、狼旧婚约依赖、预言家旧学者依赖、光蚀夜请求叶缺职责头。完整原ID及source/rule列在[集合差分](generated/architecture-checkpoint-4df94bfa-debt-delta.json)。这不是玩法覆盖率或所有中文说明验收。

## 持久证据与限制

- [固定前输入清单](generated/architecture-checkpoint-4df94bfa-capture.json)：3160 paths／blob／rawSHA、508同Gitdocs、六工具来源 SHA、原debt SHA与sourceDigest。
- [完整唯一报告](generated/architecture-checkpoint-4df94bfa-report.json)、[原债完整分区](generated/architecture-checkpoint-4df94bfa-partition.json)、[实际脚本／终态](generated/architecture-checkpoint-4df94bfa-harness-history.json)。
- 完整80,028,003字节文本输入只存 `/tmp/awa-architecture-checkpoint-4df94bfa-input.json`；即使临时文件以后缺席，固定commit和每个原Git blob可恢复全部输入，不伪造新历史运行。原始bytes SHA与解码文本各按真实捕获口径处理。

本笔未执行 types、tests、Tape、模型或最终全门禁；不修改 Git、progress、台账或原指纹。原债353仍待，Goal 的全C45中文／完整行为与最终P9验收亦待；源结构形状检查不能证明注释真实、角色规则全对或整个重构已完成。文档和证据待另一代理独立核对后由 Root 提交。
