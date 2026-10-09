# P6：狼美人接入与契约

第十三项原生角色 `wolf_beauty`／狼美人／Wolf Beauty，规则以 [AWA 1.0.0 冻结卡](rules/awa-wolf-beauty-v1.md) 为准。P9 觉醒狼美人分别实现；2023 设计赛投稿不作为本普通版的规则。

## 行动、状态与授权

普通狼队互认、夜聊和刀票沿既有参与契约；不额外揭队友特殊牌。狼美人不能自爆，不能本人提交刀自己的票。其它狼的目标校验不借秘密角色限制泄露狼美人身份；这项 AWA 解释已写入规则卡。

刀后、女巫前的优先级 450 收集 `charm {target_id:number|null}`，stage 为 `wolf_beauty`、handler ID 为 `wolf_beauty_charm`。每夜一次，其它存活目标（包括队友）或主动跳过。合法 null 或可选无行动均消费本夜、清当前关系、写 history null；非法／撤权／迟到均不消费。相邻夜不能同目标，合法跳过或实际日次间隔打断限制。

角色持有 `{targetId,lastActedDay,history}`，只有本人观察／提示可见；初始未行动显示“无／None”。异步后与 gateway 后再验 clock、原 actor/target 生命版本和组件／角色／state 引用，最终采用 sanitizedCall 后同步提交。旧关系至新合法选择／跳过保留，旧历史不删除。

关系 WeakMap 以 World 为作用域，绑定原角色／state／生命引用与版本；不写目标 marks、DTO 或操作记录。`charm_applied` actor-only；`charm_death`／`charm_blocked` God-only。玩家只收既有匿名 `additional_deaths` 的实际新死 ID，同步观察和前端。God 档与明确 private 终端诊断保完整事实；关系事件直播行受 `printPrivateEvents` 控制，chat 无关系细节。独立开启的 `printLlmIo`／`printThinking` 仍可向 operator 展示本人目标／历史，见 [M21 日志矩阵](runtime-display.md#p4-m21sdk--acp-日志开关)。

## 死亡、保护与同波

只有真实 Exile／Poison 触发当前关系；独立 Charm 死因禁死亡枪。复合 Duel／Dream 禁魅惑，即使同时含 Poison。Shot／WolfKill／WhiteWolfBlast／Charm 本身不触发。新增魅惑死亡没有额外遗言；同波初批按原死因已经有效完成的遗言保留，后来补 Charm 只禁止尚未执行的技能，不回滚已提交动作。

Night 和 Day 的 Guard／Heal 都不阻止 Charm。夜源 Poison 的 Charm 使用当前 Night 梦保护，合法阻止也消费关系；Day 放逐不能借旧梦。Night Charm 打中摄梦人可继续梦链；同波已死目标可补 Charm，不重复标死或公开死亡。多狼美人独立，Charm-only 不递归触发另一狼美人；复合触发原因仍按规则判断，循环去重。

DeathHook **只返回原绑定提案**。DeathResolution 在 await 返回后同步验证并认领令牌，才生成死亡 ID／补因／传播夜源及写 Alive；保护也在最终认领时判断。更换生命、复活、撤关系或换 state 的旧提案均不能击杀新生命。认领与实际写死亡间无 await；实际 Charm 提交后才记 `applied` 与 God 事件。没有第二个死亡 owner。

## 末狼特殊屠边与顺序

实际放逐前，狼美人是唯一活狼且当前绑定活着的好人；完整死亡链后，实际魅惑带走最后一神或最后一民时，在 `exile_settled` 的 **SlaughterSide 条目内部**判狼胜。`[City,Side]` 先普通 Good 胜，`[Side,City]` 先特殊 Wolf 胜。其它活狼、其它死因、魅惑被阻止／撤销／未生效、未消灭整侧都无此例外。

候选和隐藏狼数量由 PhaseManager 私有持有，prompt 只有通用公开规则，没有“本轮资格已满足”信息。所有遗言、徽章、角色技能／追加死亡结束后才 judge；胜者沿真实 Victory 归属，允许已死亡狼美人获胜。

## 内部 API 与取消兼容

- `NightStageContext.makeRequest` extras 新增 `requiresAction?:boolean`，默认 true；本阶段为 false。它是请求约束，不放任意 context 字段。
- `DeathHookResult.charmLinks` 为 `{binding:CharmBinding,nightEffect:boolean}[]`，属于可信引擎的原引用令牌，不是 bare ID 或序列化 DTO。`extraDeaths`／`extraDeathSources` 仍用于其它角色；Charm 由 resolver 认领后派生。
- `DeathHookContext` 可选 `blocksNightCharm`／`eligibleDead` 与 `isCurrent` 表达保护、同波生命和时钟；原调用默认兼容。
- `DeathResolution.resolve` 最后可选 effects 的 dreams／nightOriginIds 现可省略，让 Day 调用只传 `isCurrent`。没有 Frame 的低层调用不获得 Night 梦保护。
- `ConditionRegistry.evaluateMany` 第四参默认 `{}`，为可信 manager 的 per-condition `WinDecision` override；按原配置次序判断，不把特殊胜利移到全局最前。公开配置不接收任意 override。
- Runner 停止后晚到的成功或 null 改为**同对象 AbortError**，避免当主动 skip。Tape decision／checkpoint保取消错误，外层已存在原始失败时不重复添加自身停止错误；外来错误（包括另一 AbortError）仍保留。已有并发失败与本轮真实 timer flush 故障均严格重放。

公开 schema2／内部 Tape2 不变；引擎 source／lock／rules／RNG 兼容检查覆盖改动，旧指纹档案不能伪装成当前执行。绑定、候选和函数均不落盘；原名字／发言不翻译。

## 示例与验收范围

`roles.wolf_beauty.deathLinkPolicy`支持AWA兼容默认与2017 S7放逐/原生猎人枪版本，见[历史策略契约](contracts/historical-night-role-policies.md)；双目标、自爆、无条件全天牵连等未声明参数拒绝。[六人](../../configs.example/boards/six_player_wolf_beauty.json)为狼美人／狼／女巫／骑士／两民，AWA 演示配比；[十二人](../../configs.example/boards/twelve_player_wolf_beauty.json)为狼美人＋3狼／预女守骑／4民，沿来源板。均屠边、关闭自爆；十二人开启警长。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_wolf_beauty
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_wolf_beauty
```

12 个 [字面场景](../../backend/tests/support/wolf_beauty_scenarios.ts) × SDK／ACP／混合 × 两语＝72 本机真实传输完整局；包含普通放逐／毒、骑士封魅惑、梦保护／梦链、同波禁枪、末神／末民、两种条件顺序、skip 后同目标和 12 人三夜换目标。每个 actor 只持本人静态计划，实际随机发牌对照预选 seed，无 World／RNG 决策权限；逐轮核对真实身份、私有历史、接收拒绝、受众、死亡、结果及全部 Tape。

每个公开板 20 个 active 受限观察 seed 都须自然结束／零拒绝回退／实际选择与 Charm 死亡正覆盖／逐局重放。十二人最初 0–19 无 Charm 死亡，最终固定 20–39，保留分支正断言；不能用结束率替代技能效果覆盖。核心另验多 Charm、原生命撤权、Guard／Heal、特殊判胜未完成、原遗言／徽章和 runner 取消。前端使用本机合成模型实跑产生的 God 档案；两语 browser／纯 frame／真实 PNG 和三路结果见 [审查记录](reviews/p6-wolf-beauty.md)。

本批没有外部模型质量评估、全部 64 角色任意组合或 P10 发布矩阵的完成声明。P6 熊／隐狼／石像鬼及后续阶段继续。
