# P9d 迷雾鸦影有限板完整技术验收

本批登记炼金魔女与狼鸦之爪为 **implemented**，仅支持 [冻结规则卡](../../rules/awa-mist-raven-twelve-v1.md) 的精确十二人板 `awa_mist_raven_12_v1`。目录达到 **23 verified、23 implemented、18 planned，46/64**；P9d 其它板、两个觉醒前置、P9e／P9f 和 P10 仍开放。本地 main 提交，不自动 push。

## 功能与交叉审查证据

运行、原生命授权、玩家 DTO、独立核心／玩家观察账本、延迟结算以及双语事实已分批提交。完整功能证据包括：

- [六种梦境交互](p9-mist-raven-complete-interactions.md)、[四自爆窗口与双警徽](p9-mist-raven-complete-blast.md)、[末神／末民延迟胜负与非法自救](p9-mist-raven-complete-victory.md)。
- [24 个中英实际正常 SDK／ACP／mixed 局](p9-mist-raven-normal-transport.md)、[80 个严格失败局与精确请求预算／MCP 回收](p9-mist-raven-failure-transport.md)。普通请求十秒，仅选定故障请求一秒；缺失或失败不冒充合法弃刀。
- [并行自爆意图与唯一实际死亡](p9-mist-raven-parallel-blast.md)。由完整批次及最低有效号码确定赢家，原刀口上的败选者仍等夜公告死亡。
- [50 个固定 seed、两语 100 局受限观察](p9-mist-raven-observed-simulation.md)，自然终局、零拒绝／回退、逐局严格 Tape；实际资源消费／保留、后夜使用与有限雾圈弃刀抽刀都有证据。
- [26 个实际完成档案及前端帧／回退／浏览器](p9-mist-raven-frontend.md)：26 replay、26 最终 checkpoint、104 真实玩家档。工作台仍导入 God 回放，席位筛选不是玩家权限；私有最小画面使用真正 player.timeline，不以 God 过滤冒充。

各切片均含 R、A、T／L／D 三路独立审查、原反例修正与原审查者复验。最后补充的控制监听器检查与首轮失败见 [所有权修正](p10-control-owner-probe.md)；关闭地址或由不同 owner 复用分别记录，原 token 的 200／400／409 等仍必须失败。

## 本轮冻结输入与实际门禁

基线 HEAD `f9a5baf7926464ce35b6d94e8e7c033449acee02`，加本提交的两个角色目录状态与规则卡引用候选；验收期间没有编辑 source、tests、fixtures、公开配置或文档。完整 **1832 项公开输入**覆盖 backend／frontend／packages／configs.example／docs、README 与根工具配置，不读取本机私密配置或环境文件。

before、after、after-on-exit 以及 A 独立现场内存采样的清单与字节均一致：

`869e8d14efa11ae38edbe88f55e634ebef8d58077b6686385dc9c49eb6f7c366`

日志目录 `/tmp/awa-p9d-mist-final-accepted`；驱动 `/tmp/run-awa-p9d-mist-final-acceptance.py`，入口日志 `/tmp/awa-p9d-mist-final-acceptance-driver.log`。工具链 Bun 1.4.2、系统 Chromium 153.0.8010.52；driver SHA256 为 `5ee468f4bc1eccd571b8831c3c0de06e3120a8b1b8feb94fb78c529334914d45`，公开输入 collector SHA256 为 `6d8861ed3400883f675d1f7052a5f0b79b459d198beb8f5bcce7c263cc6ec88d`。

| 门禁                                             | 实际结果                                                   |
| ------------------------------------------------ | ---------------------------------------------------------- |
| root check／lint／format:check／git diff --check | 全部退出码 0                                               |
| 后端三分片（128／128／127 文件）                 | 2034／1784／1699 pass，零失败                              |
| 七个时序敏感文件串行                             | 42 pass，零失败                                            |
| 后端总计                                         | **5559 pass、0 fail、1 skip，390 唯一文件、560265 次断言** |
| backend mock smoke                               | 退出码 0                                                   |
| 前端全量 unit                                    | **666 pass、0 fail，66 文件、12253 次断言**                |
| backend／frontend build                          | 两者退出码 0                                               |
| 实际 Chromium                                    | **274 pass、17 spec、单 worker、retries=0，4.1 分钟**      |

后端显式枚举每个测试文件，分片加七份串行文件恰覆盖一次；本轮没有失败整文件补跑、没有重试。唯一 skip 是需显式导出开关的 fixture 生成测试，其真实导出门禁此前单独执行并已记录，不能把 skip 当生成通过。

A 独立逐文件核原始 Bun header、manifest、分片与串行清单，核 Chromium 1–274 全序列及 17 spec，确认命令／次数／输出与统计一致。独立结果存于 `independent-final-evidence-review.json`、`independent-input-closure-final-review.json`，未修改验收输入。

## 首轮失败保留与登记边界

此前目录 `/tmp/awa-p9d-mist-accepted` 的首轮 **5500 pass／5 fail／1 skip** 保留。机械配置两项错误预期稳定失败；三份 ACP TCP connected 失败串行重跑绿色，但未逐例确认根因。初次指纹遗漏 docs／README，sidecar 补证及源码后采样限制如实留档，不能把该轮称为同源全量通过。本轮新目录完整采样并重新执行全部门禁，不混算首轮重跑。

本提交在完整验收与独立核验后只同步目录和技术状态文档，规则行为不变；登记后的文档另做格式、链接及目录契约检查，不把更新后的文档字节冒称仍是上述冻结指纹。真实模型 T6、定时每板约 1000 seed、发布长局／并行资源及用户总体验收按 P10 继续处理，不在此宣称完成。
