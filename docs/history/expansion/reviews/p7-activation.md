# P7第三批角色阶段验收

## 目标与范围

P7七角色已经逐项交付，当前目录23 verified/41 planned。用户最新指令要求完成最后的黑市商人及P7验收后收尾，本阶段结束后交接，不进入P8–P10。

| 角色     | 规则与独立交付证据                                                                    | 公开六/十二板子ID后缀 |
| -------- | ------------------------------------------------------------------------------------- | --------------------- |
| 通灵师   | [规则](../../rules/awa-psychic-v1.md)、[验收](p7-psychic.md)                             | psychic               |
| 机械狼   | [规则](../../rules/awa-mechanical-wolf-v1.md)、[验收](p7-mechanical-wolf.md)             | mechanical_wolf       |
| 奇迹商人 | [规则](../../rules/awa-miracle-merchant-v1.md)、[验收](p7-miracle-merchant.md)           | miracle_merchant      |
| 混血儿   | [规则](../../rules/awa-hybrid-v1.md)、[验收](p7-hybrid.md)                               | hybrid                |
| 魔镜少女 | [规则](../../rules/awa-mirror-girl-v1.md)、[验收](p7-mirror-girl.md)                     | mirror_girl           |
| 觉醒隐狼 | [规则](../../rules/awa-awakened-hidden-wolf-v1.md)、[验收](p7-awakened-hidden-wolf.md)   | awakened_hidden_wolf  |
| 黑市商人 | [规则](../../rules/awa-black-market-merchant-v1.md)、[验收](p7-black-market-merchant.md) | black_market_merchant |

每行板子均为`six_player_<后缀>`和`twelve_player_<后缀>`，在configs.example/boards与games中维护。规则集为AWA明确版本及各自有限组合，不声明23角色任意排列、社区所有同名版本或64角色全部可运行。

## 全阶段证据登记

最终后端release日志`/tmp/awa-p7-backend-release-final.log`已核进程终态exit0。全阶段运行覆盖当前全部backend测试、真实本地SDK/ACP/MCP与严格Tape回归；没有仅以Black受影响测试替代阶段门槛。

| 门槛               | 已核证据                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 后端全量           | `/tmp/awa-p7-backend-release-final.log`：**2027 pass / 184573 assertions / 182 files / 0 fail**，808.11秒；type/deps/boundaries/i18n（57精确兼容例外）与smoke全部exit0，smoke自然game_over |
| 前端单测/类型/构建 | `/tmp/awa-black-front.log`：173 pass / 1496 assertions / 27 files，type/build exit0                                                                                                        |
| 全量实际Chromium   | `/tmp/awa-p7-browser-all.log`：78 passed，3.1分钟，exit0；包括新增4 Black与已有角色双语回归                                                                                                |
| Black冻结完整功能  | `/tmp/awa-black-frozen-matrix.log`：48 / 13906 / 3 files，84本机双语完整局＋40 seed＋4受控失败Tape；失败事件名定点修正另4/48/0                                                             |
| 视频               | Black两个真实God档双语PNG render exit0，root/L目检；此前各角色证据保存在逐角色验收，不将历史render冒称本阶段全重跑                                                                         |

第一次全量后端运行出现21条旧配置断言失败：它们仍用已经实现的觉醒隐狼作为“未实现角色”例子。仅将这些断言中的例子改成仍planned的丘比特，覆盖11文件的定点31 tests/179 assertions全部通过；没有修改规则以迁就测试。最终release重新运行并全部通过；中途被停止的另一次运行不登记成功。

生产源码与共享目录在最终Black完整局/seed/Tape及本次release期间冻结。R/T随后发现并修正一个失败测试的事件名拼写；定点4 failure Tape已通过，该修改只涉及测试，生产兼容指纹不变。

## 交叉审查与交接

Black源码末审A、R/T、L/D均无生产阻断，独立探针发现的问题已逐项修正复查。正式文档与最终release终态已由三路独立复核，**0残留阻断**，支持P7收尾提交：

- **A（review_arch_psychic）**：核type→deps→boundaries→i18n→全tests→smoke的完整门槛、源冻结、World/life/付费前缀/transfer/投影与strict策略；日志、计数与交接一致。
- **R/T（review_rules_psychic）**：核14人工场景与84+40+4范围、失败断言闭环、11旧配置例子的测试意图、全量终态及smoke真实game_over；有限组合与未完成事项准确。
- **L/D（review_rules_gargoyle）**：核23/41与双语、173前端/78浏览器、God提案/PNG事实、历史与本轮证据分界及分笔交接，最终日志与正式文档一致。

功能commit `83cac45`，旧配置测试修正 `3bcadb6`；本笔仅阶段验收、进度与交接文档，生产源码保持上述已验收版本。

本阶段不使用真实外部模型或读取用户认证；本地实际SDK HTTP/ACP进程/MCP与受控故障session范围分开记录。T6预算模型评测、每板约1000seed定时回归、发布长局及P8–P10/64角色22机制总验收留给下一Agent。交接入口：[handoff-p7.md](../handoff-p7.md)。
