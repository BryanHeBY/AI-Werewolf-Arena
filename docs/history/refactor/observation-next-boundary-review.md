# 玩家观察、提示与回退的下一批边界审查

## 范围与结论

本次只读审查 C30–C34 当前生产调用链及实际录制消费者；没有运行测试、类型门禁、整局或模型。
基线 HEAD：`2117e4979a0256f95c990d25f209e347fdef9a83`。下表记录读取的实际工作树字节；并行 DayPipeline／状态槽候选没有纳入本审查。
没有发现足以归为独立 Fxx 的已证实权限绕过或 God 真值泄漏；仍有明确的契约归属、特权适配器位置及重复观察流程可继续收敛。

## 已成立的边界

- `capturePlayerObservation()` 在游戏侧读取 World，策略得到 `freezeObservation()` 复制后冻结的 DTO；原位查询 thunk、机制字段裁剪与冻结时点仍有唯一捕获入口。
- `knownAliveIds` 从席位与 `request.context.visible_events` 的已发表死亡形成，未直接采用 `getAliveEntityIds()`。未公告死亡仍是知识候选，不应在机械重构中改成真实存活名单。
- `currentWolfActions` 只含自己的两个布尔资格；捕获可信政策结果后重新检查自身原角色引用／角色 ID、狼阵营和存活。它没有生命版本、阶段 lease 或付款凭据，不能当作提交授权。
- `ObservationFallbackStrategy` 不持 World，固定 `next()` 不推进游戏随机流；SDK 和 ACP 的默认生产回退都通过 `buildObservation()`。`null` 明确停止、`undefined` 才找下一 handler 的区别必须保持。
- `observed_bot/native.ts` 的查验政策已直接消费公共 `role-inspection-policy`，未再反向运行角色私有政策。受限 handler 使用观察／请求／自己的随机流，不直接查询 World。仍有 `PotionType` 从 core 总出口的运行依赖，可单独直连契约；这是加载归属问题，不是获得 World 实例或泄露真值。
- `GameEventRecorder.flush()` 给整局档写原领域事件，玩家档则使用 `buildAgentVisibleEvent()` 裁剪，`sourceEventSeq` 是玩家局部序号。整局 God 档、玩家事件档和决策观察不是同一结构，也不应强合并。

## 下一批建议（按独立职责提交）

| 批次 | 真实当前位置／消费者 | 完整交付与保持条件 |
| --- | --- | --- |
| O1：夜能力玩家 DTO 归公共契约 | `roles/abilities.ts` 的 `PlayerNightAbilityStates`、`PlayerNightAbility`、`AbilityStatus`；`player-observation.ts:31` 仍反导能力机制类型 | 把纯 DTO 声明归 game-contract 的具名公开子路径；显式列原元数据字段，替代从运行 `NightAbility` 通过 `Omit` 派生。保七个 kind、可选字段、未披露来源的 `{kind}` 分支和原状态联合；`abilityStatus()`、库存和次数算法仍归机制。 |
| O2：其余观察字段类型退出私有叶 | `player-observation.ts` 的 `OwnNightAction`、`NoblePlayerState`、`SecretBodyPlayerState`、`PlayerAlchemistState`、`PlayerRavenState`、`WeddingActorView` 及 `ReturnType<projectTimeConsortState>` 等 | 优先搬实际纯声明，明确玩家可见字段；不得把 live state／组件类型当公共玩家状态。`ownNightActions()` 的 WeakMap／读写、各机制投影函数与裁剪政策留在原 owner。分角色家族实施，避免一次移动整个 DTO 和所有算法。 |
| O3：实际能力投影归游戏观察 | `projectNightAbility()` 在 `roles/abilities.ts:245`；`projectNightState()`、`projectAbilitySource()` 兼供提示、事件和死亡能力展示 | 迁完整字段收集和具体分支到游戏观察 owner，保原 id→source→起效／到期／次数／lastUsed→disabled→activation／deathExpired→status→kind／state 的读序及重复 getter。机制继续提供真实只读库存／状态判断；不只加重导出，也不将 status、suppression 与 lease 规则复制成展示算法。 |
| O4：观察 provider 与提示模板装配分开 | `ObservedPlayersActionProvider` 构造五个提示注册表及 `PlayerPromptPolicy`，实际只调用 `buildObservation()`；SDK／ACP 也经提示对象取得观察 | 让游戏侧观察入口具备明确可信查询装配，受限 provider 直接消费它；AI 提示类仍拥有模板、人设和公开配比缓存。构造器当前会执行配比收集，移除这条无用提示依赖会改变构造读取／失败前缀，必须明确表征为 API／时序调整，不能声称纯 import 迁移。 |
| O5：回合录制输入归游戏侧适配 | `PlayerRoundRecorder.record()` 位于 AI，却直接持 World、读取当前 Role、取得 session recorder | 把完整游戏身份／请求日次阶段到录制输入的投影归游戏侧具名 owner；保 round counter、先更新计数再读请求的原顺序、无 recorder 时立即返回及异常前缀。AI 继续交原 prompt／outcome；Session aggregate 与 FileStore 不接 World。 |
| O6：录制与提示对同一事件的准备边界 | `GameEventRecorder.flush()` 对每个玩家调用 `buildAgentVisibleEvent()`，各次重新 Node snapshot／prepare；SDK／ACP 请求另消费玩家事件流 | 只在真实事件增量范围考虑一次准备、各玩家授权／裁剪；先表征可信自定义 callback 的 source 对象身份、跨玩家修改与 late World 读取。当前每次交付独立副本，不能直接改成共享 mutable prepared source。保历史 audience、隐藏事件无序号缺口及原落盘失败前缀。 |

O1/O2 先完成真实资料契约，O3 后迁完整投影；O4/O5 可各自一笔独立适配器迁移。O6 包含调用时点和对象身份变化，另笔实施并交叉审查。
O1 中运行 `disabled`、`status` 和 `deathExpired` 是原观察字段，不因为改 DTO 所有者就新增严格 schema、冻结默认对象或改变已接受的输入。

## 需保持的语义差别

1. `allNightAbilities()` 投影包含未起效、已耗尽、禁用等自己的已知实例；“看见能力”不等于该请求能使用它。
2. `PlayerNightAbility.status` 是日期和原运行政策的状态摘要，不是原角色／生命／来源／请求窗口完整许可。提交仍由 `activeNightAbility`、具体 scope 与 Gateway／机制复验。
3. `OwnNightAction` 账本来自接受的效果；策略里的 `allowed()` 只根据自己的历史形成候选偏好，不恢复已付款资源。
4. F01 的两狼资格 gate 当前只加在 `ObservationFallbackStrategy`；`ObservedBot.decide()` 只按 allowedTools 调 handler。没有证据证明后者可绕过引擎提交；若要统一策略筛选，会改变动作／RNG／Tape，需独立行为批次，不能夹进 DTO 迁移。
5. `PlayerRoundRecorder` 的 tool accepted／finalAction 表示回合选择／接收结果；领域资源 commit、死亡和判胜仍需原行动／事件证据，不应把录制 accepted 改名或解释为“已经付款”。

## God 真值与记录检查

`PlayerPromptPolicy` 仍是可信适配器：持 World，读自身角色／身份／已知队友，并委托游戏侧 status、stage、目标提示。它不是受限策略接口；后续可缩小查询端口，但不能简单删掉这些合法自身读取。
`DefaultTargetHintRegistry` 对狼巫目标会读取目标真实 camp；当前 `pureWhiteInspectionTargets()` 与规则卡明确排除实际狼阵营，有限板中的四狼互认，不能据此声称已发现隐藏狼混板泄漏。扩板前应让目标候选由具体支持组合／机制统一提供，再分别审玩家知情与执行许可。
`GameEventRecorder` 的 `recordPublicEvent()` 名称并不表示已脱敏的玩家 feed；它写所有领域事件到整局档，玩家档才走授权投影。现有命名可在录制边界批次注明／改名，不应让 AI 直接复用这个数组。
`ReplaySessionAggregate` 只接收投影后的玩家事件、回合文本和显式身份字段，规范化后由 `createPlayerViewArchive()` 落盘；没有直接读取 World，也没有把完整 `PlayerObservation` 当归档格式。
`ensurePlayerView()` 只在第一次记录时建立 role/camp 头，后续不重写；这是现有档案语义。若要记录身份变化，应使用既有事件／显式版本迁移，不能随投影移动静默改该头。

## 注释与验收

- `PlayerRoundRecorder`、`GameEventRecorder`、`night_action_history` 文件头及 `observedToolHandlers` 优先级说明仍有英文，应随各自归属迁移补有效中文：接受≠付款、局部序号、账本只记录效果、`null/undefined` 和 RNG 次序。
- `observed_bot/native.ts` 已有中文职责头；下一批只需在绑定／原生女巫差异、查验候选与真实许可处解释实际政策，勿复制整段游戏规则或改机器字符串。
- O1/O2 用完整纯声明、真实 public binding 和类型擦除证明；O3/O5 用完整原程序及 getter／失败前缀的精确逆，不能掩 callback／断言／literal。
- 仅针对新边界运行必要字面反例、实际消费者有限类型；大阶段合流后再跑固定源码门禁。未知来源、隐藏死亡与未披露 source 可使用现有独立字段预期，不让生产格式器生成 oracle。
- 每笔源码与文档交叉审查，并明列公共出口、冷加载图和严格 sourceHash 的真实变化；本次没有给任何测试／最终 P9 全绿结论。

## 读取源码指纹

| 文件 | SHA-256 |
| --- | --- |
| `backend/src/game/observation/player-observation.ts` | `505f3e117d47ad7cb51891d8b20f2dd62201ddb2741d67ee8f6d07c8ce757463` |
| `backend/src/game/observation/player-observation-projector.ts` | `e7719c8d2416f726e238b6c3d982f90e6ec4e7e4c0fc75d38ff7f687512f9b49` |
| `backend/src/game/mechanisms/roles/abilities.ts` | `468a5e3ccc49295d1e5bb4fc85e72548a5d7ceb91521328856f8f02d8712b7ea` |
| `backend/src/game/mechanisms/roles/night_action_history.ts` | `62c02c8f9addfdad1d7a6f22ee3577b9222c2bb3e78a173cc6867eb68f4c9ff7` |
| `backend/src/ai/agents/player/player_prompt_policy.ts` | `97c1267e62d5219908e43d8c383b14f129261ed45bf30bd88c8628a7d8e3fb7e` |
| `backend/src/ai/agents/providers/observed_players.ts` | `74cd8a65518e56f8d91bab4acdaf791089d8de269d304a57441897bbb21eace3` |
| `backend/src/ai/agents/providers/observed_bot.ts` | `e4bfaa2572dd083d5d4460fe30351ee1fbd084432b2b71e645b3aff55bda6c28` |
| `backend/src/ai/agents/providers/observed_bot/native.ts` | `1bf4368a5cb26ba4196090aed6c25624140d2772d4641e9ae382d0b8945d04f7` |
| `backend/src/ai/agents/providers/observation-fallback.ts` | `80fd1b0de3a8b56ff991b1e0aae191f7b54d077292aa4f4aa17640ad321f0adb` |
| `backend/src/ai/agents/player/player_round_recorder.ts` | `1ad75571301303965ddb8af734abf2a235bfdf16eadb453ade43e12d399d6eef` |
| `backend/src/runtime/game_event_recorder.ts` | `4dffad8d9cfcdc2f7c8d38d6284543548794664e59729f93be491d47512b283c` |
| `backend/src/game/engine/agent_visible_event_feed.ts` | `0fbaa9de5c548448883d778280c98221baf7669c8fcb61761657ec7fd174f8ab` |
| `backend/src/recording/session_aggregate.ts` | `baeeda7d2f2a4ea474815d7fbe25d2239ea25d46415a963a62a1c2d8e65c1f0a` |
| `backend/src/recording/session_recorder.ts` | `fe05aedd6aa2324462547124ee2d1bfdde69a38b179b7956bc7f7d5603e59527` |
