# P9c 魔术师有限板功能验收

日期：2026-10-11（UTC+08）。基线：main@d278733；本批续接底层映射基础，登记 implemented，不提升 verified，不关闭 P9c/P10。

## 支持范围

十二人三普通狼、狼王、四民、预言家、女巫、猎人、魔术师，AWA 屠边与既有警长/PK/遗言流程。
四份公开预设为 awa_magician_12_n{1|2}_{original|exchanged}_v1。第一夜或第二夜开始；号码整局一次；允许自身与明确弃用。
交换只改变当夜技能生效目标，World 身份、座位、原刀票/女巫刀口/验人请求号码不动。原始号码判定女巫主动自救限制。夜死枪链按独立来源传播，原政策不换枪，exchanged 映射到已死对象时消耗枪并产生不额外致死的空枪事实。

不支持诡术师同时换位、复制/能力转移、复活、情侣、第三方及未验混合板。LAL 狼王夜死禁枪资格不在本批；枪口映射政策不能代替该项资格差异，留在 P10 规则映射待办。

## 实际证据

各项为各自运行的数量，不能相加冒充唯一测试总数。

- 七文件定向功能与配置：56 pass / 0 fail，537 assertions；四配置×双语×20 seed＝160 局真实 World，全部自然终局。
- 原生完整 Tape 与篡改拒绝：16 pass / 0 fail，321 assertions。
- 双语 SDK/ACP/mixed 正常及交换 missing/late：10 pass / 0 fail，3515 assertions。真实接入使用本地确定性 fixture，不是付费线上模型。
- 女巫、首日警长后夜死狼王枪、并发狼聊 late：6 pass / 0 fail，865 assertions；均保存且严格重放失败前缀。枪失败保留库存，篡改消费被拒绝。
- 仅为导出真实录像再跑双语 LLM：2 pass / 0 fail，1292 assertions；未重复 ACP/mixed 正常局。四份 replay 与四份末 checkpoint 已纳入 frontend/tests/fixtures。
- 六文件录制兼容性：128 pass / 0 fail，1093 assertions，覆盖既有通用、鬼魂新娘、猎魔人、赤月及新魔术师记录。
- 完整前端 unit：421 pass / 0 fail，4626 assertions。
- 完整 Chromium：206 passed，1 worker、0 retry，含原政策/交换政策×双语四用例。
- 双端 build、root check/lint/format:check、git diff --check 均通过。前端打包仅存在大于 500 kB 的 chunk 提示。

证据目录（本机 task-3）：awa-magician-seeds-failures、awa-magician-tape-audit-v3、awa-magician-late-fixtures、awa-magician-frontend-final-v2；后端构建 awa-magician-backend-build.log。最终登记后的目录/规则卡及界面复验另见 awa-magician-registration-final。

## 审查与修复记录

独立规则/录制审查和独立场景/前端核对已完成，最终只读复核未发现新增明确阻断。
修复与回归覆盖：私有事实受众、候选数组白名单、首日竞选前自爆的延迟死亡合并、删除必需交换/夜结算、失败枪库存、删除空枪事实、非 finalized 异步刷盘时 decisions 超前于 checkpoint 的边界。最终记录始终进行完整因果检查，已有 checkpoint 前缀不放宽。

首次真实传输 0/10 失败源于测试 oracle 缺少 magician_exchange；修复后审计中途刷盘再暴露正常传输 4/6，修复后 10/0。前端首次 419/2 失败源于空枪阶段双语键缺失，修复后 421/0、Chromium 206/0。测试 readonly 数组 push 的类型错误亦已修复。保留这些失败证据，不把候选/局部通过写为完成。

## 门禁口径与后续

依 delivery.md 第 3 节及 contracts/p8-p10-continuation.md：本次是功能提交门禁，执行受影响文件、每板固定 seed、真实接入及额外完整前端；全部已支持后端/板子回归在 P9c 阶段收口执行。上一波赤月的 4313 项全量是历史证据，未宣称覆盖本批新源码。
本批后为 23 verified、15 implemented、26 planned，38/64。P9c 后续优先定序王子重投依赖，再接诡术师标准合板；其余 P9c–f、P10、约1000 seed周期回归、发布长局与有预算的 T6 仍开放。仅 main 本地提交，不自动推送。

## 后续范围更新：2026-10-11

本页保留该批独立板历史验收范围。后续 awa_trickster_12_v1 已另行支持魔术师、诡术师、定序王子精确组合，证据见 [诡术之境验收](p9-trickster.md)。不将后续结果回填为此前已通过。
