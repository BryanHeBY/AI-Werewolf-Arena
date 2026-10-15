# 固定 f0ed208f 阶段结构检查

本轮在已提交 `f0ed208f3e2beae8818f79d966ec277dc11af4bc` 的公共 Git 输入上后台执行一次原 progressive 架构检查。输入含 3,185 个原始文件与同提交 565 个文档路径，来源摘要为 `bd2903da0fb6a656e88d9a4abaeb3bea0beb274728adef317589d2370e9297be`。正在开发的首夜窗口、蛇／河豚及死亡追加关系准备未纳入此固定树。

| 项目 | 数量 |
| --- | ---: |
| 新增失败 | 0 |
| 原结构债务剩余 | 289 |
| 原债务已清 | 1,490 |
| 较固定 005c92e4 新清债务 | 11 |
| 较固定 005c92e4 返回债务 | 0 |

原冻结 1,779 项清单及六个执行工具与固定 Git／当前字节均保持。没有重建基线、增加豁免、修改映射或运行 strict。数量反映结构诊断，不能作为玩法覆盖率、中文内容完整性或 P0–P9 完成率。

实际 launch `af20c9`、session `88905`，terminal `5233ae`，退出 0。开跑前完整捕获 path／blob／mode／原始摘要和文档；临时全文输入 80,208,101 字节，可按固定 Git 清单重建。只读输入复核 `63cf7c` 退出 0，核对每个原始 blob、SHA、UTF8 文本、顺序及工具来源；原债务分区复核 `57dc68` 退出 0，剩余与已清互斥且完整覆盖原全集。没有再次执行架构检查、测试、类型、对局或模型。

[完整捕获](generated/architecture-checkpoint-f0ed208f-capture.json) · [报告](generated/architecture-checkpoint-f0ed208f-report.json) · [债务差分](generated/architecture-checkpoint-f0ed208f-debt-delta.json) · [实际收据](generated/architecture-checkpoint-f0ed208f-harness-history.json)。

本批只交付固定阶段检查证据，289 项旧债和最终同输入验收继续推进；后继工作区不能借本次结果宣称已验收。
