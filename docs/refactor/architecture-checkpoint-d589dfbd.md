# d589dfbd 固定结构检查

## 输入与实际结果

本次只检查真实提交 `d589dfbdb79797d2afcfd9c18d7efe60b5675328`，读取公共 Git 原始 blob，不混入之后的工作区候选。

| 项目 | 实际结果 |
| --- | --- |
| 公开 Git 文件 | 3,122 |
| 同一 Git 文档路径 | 446 |
| 新增违规 | 0 |
| 仍存原债 | 407 |
| 已清除原债 | 1,372 |
| 原债务总数 | 1,779 |
| 实际后台退出 | 0，session `45923` / chunk `38f7a4` |

[固定捕获与完整报告](generated/architecture-checkpoint-d589dfbd.json) 的输入摘要为 `1aa569ff5ef430e939e5dac0deb19a4f47ac48267d8d1b38577cce053f103aa2`。原债务文件 SHA 为 `297b945bcdc85873b1d44e9e0ae705cddc1af8fd3e2fa5acfdb443f036550e5d`，没有改写基线或新增豁免。

## 独立核对

[独立审查](generated/architecture-checkpoint-d589dfbd-review.json) 没有再次执行门禁，而是核对：

- 真实 Git 公共白名单、普通 blob 模式、全部 3,122 个原始字节 SHA 与固定路径顺序。
- 446 个同一 Git 文档路径、原始 SHA 元数据摘要与报告 `inputHash`。
- 五个门禁模块及实际 inventory reader 的固定 Git／当前字节一致。
- 原 1,779 项冻结债务字节和原 metadata digest；407 个精确历史匹配与 1,372 个已清除 ID 完整、不重复分区。
- 实际捕获脚本及可读 stdout 摘要与持久报告一致；真实终止结果来自 Root 工具回执，空日志不作为通过依据。

[执行来源](generated/architecture-checkpoint-d589dfbd-harness-history.json) 保存可读临时脚本和日志原文／SHA。审查只复核已记录分类，不重新发现全量违规，不执行 `checkArchitecture`、类型、测试、整局或模型。

## 范围限制

固定提交已经包含蚀时狼妃 DTO、婚约死亡波、应用观察 M1/M2、夜能力投影 O3 及共同载荷中文说明。随后未提交的 Cycle 准入、Order/Wedding DTO、Mist 状态槽及 Root C48 工作区不属于本次输入。

0 新增违规是此固定提交的依赖、命名和职责说明形状结果。407 项原债仍需继续完成；这不是全目标零债，也不替代完整类型、行为、玩法矩阵和最终 P9 同源验收。固定绿不代表当前并行工作树全部通过。
