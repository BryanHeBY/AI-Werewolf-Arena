# 架构与所有权入口

当前文档回答“真实职责由谁拥有”，不按类名、文件长度或历史阶段编号分层。

- [模块与依赖](module-ownership.md)：应用、领域、引擎、机制、规则组合、Agent、记录、适配器的实际边界。
- [状态、许可与生命周期](lifecycle-and-authority.md)：原体／版本、未付动作、已付效果、死亡波次和终局。
- [机制索引](feature-ownership.md)：多角色机制、共同能力及对应独立 verifier。
- [交付与最终验收边界](delivery-status.md)：已交职责与还需同源验收的区别。

现行契约在 [contracts](../contracts/README.md)，规则在 [rules](../rules/README.md)。历史切片只是来源，不能根据其当时剩余项再把已成立 owner 拆成新的 public wrapper。
