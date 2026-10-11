# 魔术师系列原生能力独立账本补齐

功能基线 `75ce319`。范围为魔术师原生板、诡术之境与魔幻对决的原生女巫／预言家记录校验；不改引擎动作或角色数量。

## 已修正的记录缺口

- 依据原始牌组和阵营建立独立原生能力账本，逐事件核验女巫药量、用途／日期／夜内标记与预言家目标、映射阵营及完整历史；逐 checkpoint 比较整个能力库存。生产判定函数不作为预期来源。
- 每个已完成夜（包括已经进入 Day、尚未公布 night_resolved 的首日）必须具备当夜存活原生角色的必答事实。不能通过同时删除 decision＋event 并回退 checkpoint 隐藏一次原生行动；明确 none 同样是应有回合。
- Seer 成功事实、失败／pending 请求均要求已完成当夜女巫阶段；记录尚未发布当前夜事件时，以前一完整 checkpoint 验证起点存活，以 Witch 成功 action 的 settleOrder≤Seer openedAfterSettlement 验证阶段先后。身份、工具及重复请求检查在增量前缀跳过之前执行，不要求尚未发布的事件。
- 女巫夜标记重置时点独立区分：Magician 在 reset 之前，Trickster／Wolf Sorcerer 在 reset 之后；已死原生女巫不被推断为本夜已重置。

## 测试与交叉审查

四项库存／结果篡改与两项完整夜双删先红：16 pass、6 fail。修复后 22 项通过。新增真实 pipeline 的 N2 Seer pending（仅 cp1）、Seer 失败 cp2、N1 Seer 成功后 nomination 失败 cp1，验证双删女巫及六类增量篡改；未发布前缀反例先红 1 项（24 pass），修复后 25 pass／646 断言。测试修订时曾有两项 ReferenceError；修复后才取得上述 red/green，不把夹具错误作为产品缺陷。

最终相关完整录制及严格重放 57 pass／769 断言／3 文件，涵盖原枪口／交换枪口、诡术抵消及狼术顺序。实际本机 SDK／ACP／MCP 中英失败通路 46 pass／12552 断言／4 文件，每项双语，共 92 失败对局；包含缺失、迟到、非法，以及女巫、狼聊、枪、重投和 Psychic 边界。初始录制、失败前缀、零意外 fallback、严格 Tape 与子进程释放均按现有 harness 核验。未调用真实模型。

日志：`/tmp/awa-magician-native-red.log`、`/tmp/awa-magician-prefix-red-2.log`、`/tmp/awa-magician-prefix-green.log`、`/tmp/awa-magician-day-opportunity-green.log`、`/tmp/awa-native-audit-transports-final.log`。后续类型修正只将显式 living assertion、枚举和玩家事件事实匹配写正确；最终 check／lint／format:check／diff 均通过，初次 TypeScript 四条诊断及修复日志保留。

review_scholar_rules（R/A）、review_configuration_closure（A/D）、review_scholar_delivery（T/L/D）完成只读复核。A/D 追加独立发现首日 Day／警长前双删 Seer 仍可通过公开 parser 的 P2，T/L/D 原初审漏掉此边界，修正后由原报告者复验 2 项／342 断言通过；T/L/D 再读回修正及最终日志关闭。新增仓库反例先 25 pass／1 fail，补 phase_changed Day 的应行动事实集合与所有 Day/Voting 请求的成功 decision 前置，最终上述 57 项通过。合法 Night Seer pending 仍接受。92 局通路在该追加修正后完整重跑，仍 46 项零失败。所有已报告意见已关闭。仅功能回归，不宣称全后端重跑；P9c 最终阶段门禁、狼王可配置资格和 P9d–P10 继续。44/64 不变。
