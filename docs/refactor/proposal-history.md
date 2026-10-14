# 重构方案的历史状态

下面四份只读方案记录各自观察时点，原文中的“下一笔”“尚未修改”均描述当时状态。现已按对应功能提交；原文与哈希保留，阅读当前交付应使用下表的实施说明。它们不是新增待办或当前工作区验收结论。

| 历史方案 | 已提交实现 | 当前职责与实施说明 |
| --- | --- | --- |
| [猎魔夜间来源](next-night-source-boundary-proposal.md) | `7d61cda4` | [来源折叠与事实发布](demon-night-damage-contribution.md)；Manager 保留真实死亡、判胜与两个原调用时点。 |
| [用药准入](next-potion-tool-admission-proposal.md) | `3744a99b` | [完整用药准入](potion-tool-admission.md)；规则组合拥有预检，机制拥有库存和实际提交。 |
| [查验准入](next-seer-tool-admission-proposal.md) | `87403019` | [普通查验准入](seer-tool-admission.md)；完整规则表归规则组合，阶段仍拥有必选行动与提交。 |
| [剩余归档核验族](next-recording-verifier-family-proposal.md) | `f5242032` | [完整核验族归属](remaining-reproduction-verifier-owners.md)；前置三族另见 [choice/effect 批次](choice-effect-verifier-owners.md) `eed72f1f`。独立算法归 verification，checkpoint 格式与真实录制仍归 recording。 |

上述功能交付不等于全部 I01/I04/I10 或 P5/P7/P8 完成。剩余工作与最终同源验收以 [进度](progress.md)、[现行交付台账](current-delivery-ledger.md) 及各实施文档的限定范围为准。历史方案不随路径迁移改写，也不能用于证明后继源码已运行验证。

[原文与实际提交绑定](generated/proposal-history-bindings.json)保存四份原文哈希和完整 Git 提交身份。本笔只整理文档状态，没有运行类型、测试或门禁。
