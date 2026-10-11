# P9d 猎日逐光有限板完整技术验收

本批登记流光伯爵与蚀日侍女为 implemented，仅支持[冻结规则卡](../rules/awa-radiant-eclipse-twelve-v1.md)的精确十二人板 `awa_radiant_eclipse_12_v1`。目录达到23 verified、25 implemented、16 planned，48/64。P9d其它板、P9e／P9f、P10及真实模型T6继续；main本地功能提交，不推送。

## 功能与交叉审查

- [运行候选与资源所有权](p9-radiant-eclipse-runtime-candidate.md)：夜初原角色／原生命／原生资源快照、真实末狼刀权、临时封禁、四种独立借用、正常／异常清理、付过的庇护／梦关系、17项字面交互矩阵。R、A、T/L/D原最小反例已修复并复验。
- [独立记录与严格Tape](p9-radiant-eclipse-recording-candidate.md)：原始请求前缀、事件释放边界、所有库存和历史、死亡／警徽／投票／胜负，以及异常关闭和合法增量；真实异步日间自动flush使用单一事件拥有者最新快照。
- [通信、观察和前端](p9-radiant-eclipse-transport-delivery.md)：42个SDK／ACP／混合双语完整局、96个精确失败局、12个retained MCP迟到／旧ID测试、50个固定seed两语100局自然终局且逐局严格Tape；16God／CP与112实际玩家档、26专项Chromium。

通信实际采集完整SDK messages及ACP提示。当前copy绑定与完整状态精确核对，序号／类型／payload逐项对应独立账本的本次请求前缀；源角色人格标记仅用于完整通信上下文隔离，不冒充原生查验历史canary。原生历史采用两个World、共享提示／DTO／事件差分，并以真实借用状态白名单及源事件时序约束支撑。工作台仍导入God档，最小玩家movie来自实际授权timeline；不将席位过滤称为权限。

## 冻结输入与实际门禁

基线HEAD `bb79b300bb79635bdc4308f0fb0f5471e14c751f`，加本批运行／记录／通信／前端及目录状态候选。验收期间source、tests、fixtures、公开配置与docs未编辑。完整2052公开输入的before、after、after-on-exit清单及字节一致：

`226c4c8d29c5620b9e416d2cc73097a746d78186750a7e15454d6e90d66623a1`

目录 `/tmp/awa-p9d-radiant-candidate-full-third`，驱动 `/tmp/run-awa-p9d-radiant-candidate-full-third.py`。Bun1.4.2，系统Chromium153.0.8010.52。driver SHA `3daa82d6fd7eae6b8c7b109844dbe41a4461f2e3f739bf0221438256c1d47435`，collector SHA `6d8861ed3400883f675d1f7052a5f0b79b459d198beb8f5bcce7c263cc6ec88d`；第二轮实际逐文件耗时输入SHA `db675bedf05396ed5c813e195e3655b4d684131467b21c8887c0bff451671882`，仅用于均衡分片，不改变测试范围。

| 门禁                                   | 实际结果                                                |
| -------------------------------------- | ------------------------------------------------------- |
| root类型、lint、格式、git diff --check | 全部退出0                                               |
| 后端三分片，141／142／142文件          | 1789／1952／2128通过，0失败                             |
| 七个时序敏感文件串行                   | 42通过，0失败                                           |
| 后端合计                               | 5911通过、0失败、1条件导出skip，432唯一文件、606791断言 |
| 前端全量unit                           | 803通过、0失败，69文件、25769断言                       |
| backend mock smoke、两端build          | 全部退出0                                               |
| 实际Chromium                           | 300通过、20spec，单worker、retries=0，5.1分钟           |

每个后端文件实际header恰覆盖一次，前后完整输入不读取本机私密配置或环境文件。唯一skip是需显式开关的旧fixture导出测试，其独立实际生成证据已有记录；不能把skip视为导出通过。整轮无重试，无失败后单文件补跑混算。根任务核对原始footer、header、1–300浏览器序列、13个门禁退出码与完整输入字节；A 独立审计 `/tmp/awa-radiant-third-final-independent-audit.json` 核全部原始header、命令及清单、1–300浏览器规格、完整输入字节与当前public_manifest逐行一致，确认范围与统计、工具chain指纹；无剩余验收阻断。

## 原失败与接续范围

完整第一轮在ES2022源码类型处停止，`findLastIndex`改普通遍历；未运行后端。第二轮实际423分片文件5845通过／2失败／1skip，只有旧机械配置直接启动错误码期望漏列新有限角色；公开拒绝与诊断不变，更新字面期望。第二轮未执行七份时序与后续前端／浏览器。两轮原日志与各自完整输入闭环保留，不把重跑混算为原轮通过。

本批登记文档在完整验收后更新，其新字节不冒称仍属于上述冻结指纹；随后另核目录契约、文档链接、格式与差异。`bb79b30`的下一板单来源伤害原语也在本轮输入和测试中，未激活夜之贵族或觉醒愚者。

继续夜之贵族／觉醒愚者及猎魔人夜仆例外，再交付寻香魅影／觉醒预言家，之后P9e六项、P9f余六项和P10。下一板临时状态草稿不计交付；真实模型T6授权、每板长种子与发布资源验收仍开放。

## 验收后的隐私维护补证

R 根据规则卡隐私条款补充两个原主历史不同World中的真实共享 `ActionTurn` 与 `AcpTurnRegistry` 非法目标及关闭后工具响应差分：8项／360断言通过，完整payload相等、精确四类错误码、没有history canary。它没有额外启动模型网络。原脚本 `/tmp/awa-radiant-r-history-error-closure.test.ts` 已并入 `radiant_eclipse_prompt_history.test.ts`，属于冻结门禁结束后的单项维护补证，不计入上表原指纹及断言数。
