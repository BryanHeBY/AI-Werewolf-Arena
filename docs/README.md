# 项目当前文档

本项目的当前产品链路是：配置与装配 → LLM／ACP／受限观察机器人驱动对局 → 同会话记录 → 公开离线复盘与独立严格复现。在线观战、多租户服务和任意外部 API 不由此文档宣称支持。

## 先按问题选择入口

| 维护问题                                     | 唯一入口                               |
| -------------------------------------------- | -------------------------------------- |
| 模块放在哪里、谁能写状态或推进生命周期       | [架构与所有权](architecture/README.md) |
| 配置、行动、事件、观察、归档的数据及失败承诺 | [现行契约](contracts/README.md)        |
| 某个角色的来源、版本、有限规则和未支持变体   | [现行规则卡](rules/README.md)          |
| 如何运行、离线验证、增加机制或迁移           | [维护指南](guides/README.md)           |
| 为何这样区分身份、阵营、许可、已付效果和版本 | [决策记录](decisions/README.md)        |
| 原扩充／重构的提交、红灯、审查和阶段证据     | [历史来源](history/README.md)          |

## 哪些内容具有当前约束

1. 规则版本与机器协议以现行契约、规则卡和实际唯一 owner 为准；目录或资料登记不授予执行支持。
2. 完整重构的目标仍见[实施计划](guides/refactoring-plan.md)。它约束最终验收，阶段计划不是已经完成的结果。
3. [交付状态](architecture/delivery-status.md)只登记已知实现与尚需同源验收的边界；旧矩阵的 pending／partial 不能自动触发重复提取，历史通过也不自动变成 current complete。
4. `history` 中的“下一步、暂停、完成、不得继续”均描述对应原 commit 的阶段事实。它们不是现行工作指令；原错误与未完成项也不得被删去制造全绿。

## 迁移结果与验收定位

迁移职责和证据从[机制覆盖摘要](architecture/mechanism-coverage-summary.md)进入，经[行索引](architecture/row-index.md)定位[完整矩阵](architecture/migration-matrix.json)；支持声明以[机制支持边界](contracts/mechanism-support-boundaries.md)为准。91 项职责的十个维度共 910 个位置，其中 843 个适用位置与 67 个业务性 N/A 是分类口径，不是测试或已通过数量。

本轮固定受测源码为 `60fdbfbc57122eeb1d4e9204b66d4daec1eb0157`；[最终验收入口](history/acceptance/refactor-final-acceptance.md)登记真实同源结果。后继 C48 文档与矩阵提交是元数据发布，不能倒称其新 HEAD 已运行全部 42 项；当前结果以[验证指南的最终登记](guides/validation.md#本轮最终验收登记)为准。

## 版本与隐私

稳定 RoleId、boardId、工具／错误／消息 key、原始用户／模型文本和历史归档身份不随组织文件名改变。公开复盘是 God 视角，不能作为对局 Agent 的输入；reproduction 与 manifest 可能含底牌／seed／完整请求，不应作为玩家公开资料。

没有本轮最终固定输入报告时，不以文档目录、角色数量或旧套件通过声称 P9 完成。
