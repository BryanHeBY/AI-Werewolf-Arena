# 架构与所有权入口

当前文档回答“真实职责由谁拥有”，不按类名、文件长度或历史阶段编号分层。

- [模块与依赖](module-ownership.md)：应用、领域、引擎、机制、规则组合、Agent、记录、适配器的实际边界。
- [状态、许可与生命周期](lifecycle-and-authority.md)：原体／版本、未付动作、已付效果、死亡波次和终局。
- [机制索引](feature-ownership.md)：多角色机制、共同能力及对应独立 verifier。
- [交付与最终验收边界](delivery-status.md)：已交职责与还需同源验收的区别。

## 迁移职责与证据导航

- [机制覆盖摘要](mechanism-coverage-summary.md)：汇总当前职责、适用性及真实证据边界。
- [行索引](row-index.md)：按稳定行 ID 定位 owner、consumer 和证据；不是新的运行注册表。
- [完整迁移矩阵](migration-matrix.json)：记录 91×10 个位置的适用性和绑定来源，843 个适用位置与 67 个业务性 N/A 不充当通过数量。
- [机制支持边界](../contracts/mechanism-support-boundaries.md)：区分候选记录、领域付款、已付效果、严格版本和有限复现支持。

最终执行见[同源验收入口](../history/acceptance/refactor-final-acceptance.md)与[验收登记](../guides/validation.md#本轮最终验收登记)。受测源码 `60fdbfbc57122eeb1d4e9204b66d4daec1eb0157` 与后继矩阵／导航的元数据提交分别记录，不把后者的新 HEAD 当成整轮受测输入。

现行契约在 [contracts](../contracts/README.md)，规则在 [rules](../rules/README.md)。历史切片只是来源，不能根据其当时剩余项再把已成立 owner 拆成新的 public wrapper。
