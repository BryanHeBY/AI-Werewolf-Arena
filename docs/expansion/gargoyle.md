# P6：石像鬼具体角色查验与接刀

第十六项 `gargoyle`／石像鬼／Gargoyle，采用[AWA冻结卡](rules/awa-gargoyle-v1.md)。普通独立狼版本与迷雾、觉醒版本分别处理。

## 信息和执行边界

真实 Wolf、原生最多一张；不与狼队相认、聊天、读取刀口或原生自爆。`inspect_role` 每夜先查另一存活玩家的规则角色标签，遵守明确伪装；与预言家的 camp 查验分开。同 `role_check` 实例不得自验或重复验同 ID，复活不清历史。有效目标存在时必须完成，三次无效返回报运行错误；目标耗尽则完成流程，没有虚假报告、请求或消费。

原生 `{hasInheritedKnife}` 保存实际曾接刀事实，由装配或 DeathResolution 完整死亡提案后更新。只有自己是唯一活真实 Wolf 且本夜原生查验流程完成、原角色/状态/能力/生命及阶段仍有效，才可使用基础夜刀、弃票、自刀；Day 获得不立即攻击。普通狼死后枪带走石像鬼，保中间已取得事实；同个提案同时死则不假接刀。隐狼和石像鬼同时在场不会产生双刀。

`role_inspected {actorId,abilityId?,targetId,day,result:{kind:"role",role}}` 与 `gargoyle_awakened {actorId,day}` 仅实际本人可见。验出某狼不补狼聊历史或自动授权队友 ID。目标无通知；上帝复盘可以展示私有事实，玩家原文保持原文。

## 状态和 API

- `NightAbilityStates.role_check` 保存 lastTarget、lastDay 和 typed history；资源沿现有 G02 实例计算。gift/copy 以明确新状态建立独立实例，不改变持有者真实身份/阵营。transfer 校验完整语义状态和资源，允许字段重排，拒绝清空旧知识；明确授权新持有者读取完整旧知识，不重发旧事件。
- `inspection_scope.ts` 按 World/夜保存完成范围及提交账本，不进入 DTO、角色 JSON、事件或 Tape。已提交夜流水线拒绝重入；撤权、原生状态替换、转移、原生命更换或其它狼复活，不能沿用旧完成范围出刀。
- stage 优先级 180，在摄梦后、狼聊/刀和其它信息阶段前；完整身份在装配时已有。await、gateway 与最终报告提交重验 actor 和 target 原生命。死亡、警徽、遗言、追加波次及最后判胜仍由既有 owner 处理。
- `RoleProfile.baselineAction` 追加可选 World，旧函数兼容；仅决策 fallback 使用。受限观察机器人只读本人观察中的历史与合法目标，不持有 World。
- 共享 PlayerPromptPolicy 向 SDK/ACP 注入 bound 实例完整查验规则和本人状态。实际查后刀资格与曾获得事实分别说明；私有日志受现有显示开关控制，公共终端/chat 不输出。

## 配置和声明支持

`roles.gargoyle` 只接受 `{}`，maxCount=1；未知相认、自爆、重复查验、固定刀位或迷雾参数拒绝。公开[六人板](../../configs.example/boards/six_player_gargoyle.json)为石像鬼／普通狼／预言家／守墓人／两民；[十二人板](../../configs.example/boards/twelve_player_gargoyle.json)为石像鬼＋三狼／预言家女巫猎人守墓人／四民，有警长。采用屠边、关闭原生自爆；不宣称其它同名变体已实现。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_gargoyle
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_gargoyle
```

[字面整局](../../backend/tests/support/gargoyle_scenarios.ts)包括 Day 接刀后 Good/Wolf 两种终局、王枪接后死、同波毒/刀不接、开局单石像自刀、十二人真实竞选/药枪/三夜查后刀。6×SDK/ACP/混合×两语＝36本机完整局，每局严格 Tape；演员只持本人静态计划。另四个 gifted SDK/ACP 任务验证重复拒绝后纠正、真实身份/完整规则、接收只读及进程回收，不能算完整局。

core 另覆盖白狼、Beauty、梦链、隐狼伪装、Knight 真阵营、熊邻接和实际放逐石像鬼的墓反馈；查后撤权、目标第2/3次耗尽和三个独立能力账本均有人工回归。两板各20受限观察 seed、自然终局、零拒绝/回退、具体查验/实际接刀/新刀票正覆盖与全部重放。十二人初始0–19未触发接刀；扩展20–79定位53，最终固定40–59，未改板子、策略或降低正断言。

中英终端、实际 God 档前端、Chromium 交互和 PNG 均按相同领域事件验证，审查与最终证据见[验收记录](reviews/p6-gargoyle.md)。P6 整阶段所有已支持玩法已完整回归；P7–P10、真实模型评测与发布长局保持完整目标。
