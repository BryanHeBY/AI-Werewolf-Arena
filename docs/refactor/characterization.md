# P0 决策权限与请求撤权 characterization

本记录对应重构计划 F01、F02、§7、§19，基线为 `27a97cb`（55 个已交付角色）。本批只增加测试和事实登记，不修改生产策略或授权实现。测试文件为 `backend/tests/architecture/refactor-characterization.test.ts`。

## 证据类别与范围

- **既有行为**：下文实际运行过的测试与当前消费链。
- **目标约束**：生产决策只读 PlayerObservation、原租约终态撤权单调，以及错误外来提交不污染有效租约；这些不等于基线已满足。
- **待独立修正**：F01/C33a 及 F02/C18a。机械迁移不得把此处差异当作可忽略字段，也不得改 seed 或重生成 golden 消除差异。

所有测试均为进程内小边界，未访问认证、网络、真实模型或磁盘复盘。Noble 测试使用已有 `nobleBodyAuthorityFixture()`：六个原体组件与 Noble/SecretBody 状态，只验证授权子系统，不冒充十二人角色完整对局。Animal 测试只捕获 request envelope，不运行其完整生命周期。

## F01：决策 consumer 登记

| Consumer                              | 实际输入、调用链                                                                                                                                                                     | 当前分类与迁移责任                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `BaselineBotActionProvider.getAction` | 构造器持有 World；读取 actor RoleComponent、真实 Alive、参与权与能力；调用 RoleProfile.baselineAction 并传入两个选目标回调及 World                                                   | 当前特权策略。普通行动会依赖未告知玩家的引擎状态；C33a 应将生产选择输入改为 PlayerObservation，合法性留在引擎重检        |
| `RoleProfile.baselineAction`          | `action_providers.ts` 为唯一通用调用入口；参数含原 RoleComponent、request、`pickAliveNotSelf`、`pickAliveByCamp`、locale、World                                                      | 不是受限观察端口；先逐 callback 迁移真实调用方，再删除旧字段                                                             |
| SDK 生产 fallback                     | `player_agent_factory.ts` 注入 Baseline；`llm_action_provider.ts` 在未注入时也默认创建 Baseline；`FallbackActionPolicy.resolve` 调用该 provider；`LlmTurnOrchestrator` 使用该 policy | **已确认生产例外**。`allowsActionFallback` 保留严格请求不回退的门禁；C33a 独立改变选择行为，不改变严格窗口与资源提交规则 |
| ACP 生产 fallback                     | `player_agent_factory.ts` 注入 Baseline；`AcpActionProvider` 默认值也为 Baseline；运行错误分支在 `allowsActionFallback` 后调用 `fallbackProvider.getAction`                          | **同一生产例外**，需与 SDK 一起关闭；不能只改共享 SDK fallback policy 后宣称完成                                         |
| 可注入 fallbackProvider               | SDK/ACP 接口均接受 ActionProvider；测试 `FallbackProvider` 返回固定字面 action                                                                                                       | 注入方当前可自行持有 World。未来生产装配必须约束决策端口；测试字面驱动与默认生产策略分别登记                             |
| `ObservedPlayersActionProvider`       | 特权 adapter 用 `PlayerPromptPolicy.buildObservation` 产生冻结、脱离原体的 DTO，然后只传给 `ObservedPlayerStrategy.decide`                                                           | 受限观察边界。adapter 自身允许读取 World 作投影，strategy 不拿 World                                                     |
| `ObservedBot`                         | 只持有该玩家 RNG 和 style；`decide` 使用 observation 与 handler                                                                                                                      | 受限策略，不调用 baselineAction，不接收其他玩家 RoleComponent                                                            |
| `simulateGames`                       | 原生 bootstrap 后，按玩家 fork RNG，创建 ObservedBot/ObservedPlayers；外部 provider 在调用前用 World 检查终局与死者窗口                                                              | 决策为受限观察；终局/死者检查为特权 controller，不得把这层引擎权限误归为玩家读权                                         |
| 严格 Tape `RecordedActions`           | `replay_reproduction.ts` 私有类按 actor/day/stage/turn 检查 normalizedRequest、opening event/settlement 因果位置，再返回归档的 action/error；不生成策略选择                          | 显式归档驱动。归档含 God/库存/检查点供复现与 verifier，不是模型知识输入。每构建独立生成运行授权，不能复用旧句柄          |
| `ReproductionTrace.decide`            | `recording/reproduction.ts` 包装 provider，复制规范化 request/action、保存 opening 与 settlement；领域事务等待 completion                                                            | 记录者，不是策略。不能将 Provider 返回等同资源已付款                                                                     |
| `ScriptedActionProvider`              | 生产源码提供工具类，但仓内消费为测试；调用预置 match(request)，返回字面 action                                                                                                       | 显式特权测试驱动；match 是调用方回调，可捕获 World，不能据其接口宣称受限玩家                                             |
| `StrictScriptedPlayers`               | `tests/support/scripted_players.ts` 按 actor/day/stage/turn 逐项消费固定 action，支持 assertRequest 回调并检查缺失/多余请求                                                          | 显式测试 driver；不启用 Baseline，不用生产结算生成预期                                                                   |
| `NoopActionProvider`                  | 固定 null                                                                                                                                                                            | 无选择策略；用于显式无人行动测试，不能替代严格必选窗口                                                                   |
| `runMockGame` / `run:mock`            | 固定六人 board，直接把 Baseline 交给 PhaseManager                                                                                                                                    | 保留为**明确特权 smoke/mock**，不进入生产玩家决策端口，也不能证明受限观察 seed 对局                                      |
| 直接测试 callback                     | `seer_policies.test.ts`、`configured_role_policies.test.ts` 直接调用 profile.baselineAction；其他 engine/runtime tests 构造 Baseline                                                 | 历史策略与规则 fixture 消费者，迁移 discovery 时必须保留，语义修正时单独记录批准的新预期                                 |
| 公共导出                              | `ai/agents/index.ts → ai/index.ts → src/index.ts` 导出 action_providers                                                                                                              | 尚存在外部公开入口，不能只搜索内部调用后声称删除安全；公开 API 收敛由 package 阶段处理                                   |

### Profile callback 的实际覆盖

仓内 37 个 `profile.ts` 定义 baselineAction（一些文件定义多个角色）。下列登记的是实际实现文件，不是对“每个 callback 都偷看阵营”的断言：

```text
animal_dream, awakened_hidden_wolf, black_market_merchant, cupid, debater,
demon_hunter, dreamer, fragrant_pair_seer, gargoyle, guard, hunter, knight,
lonely_girl, magician, mechanical_wolf, miracle_merchant, mirror_girl,
mist_raven, nightmare_shadow, noble_secret_body, order_prince, psychic,
pure_white, radiant_eclipse, scholar_mentor, seer, shapeshifter, thief,
time_wolf_consort, trickster, white_wolf_king, wild_child, witch, wolf,
wolf_beauty, wolf_king, wolf_sorcerer
```

- `pickAliveByCamp` 的实际实现读取目标 `RoleComponent.camp`，不是玩家查验知识，且按真实 Alive 过滤。Wolf 的 kill_vote 用 `pickAliveByCamp("good")`；WolfKing 死亡枪、MechanicalWolf 的毒/刀/枪、AwakenedHiddenWolf 的攻击/枪也直接使用该回调。
- Wolf 派生 profile 多数委托 `WOLF_ROLE_PROFILE.baselineAction`：WolfBeauty、WolfKing、WhiteWolfKing、Gargoyle、WildChild、Noble、Fragrant、Radiant、Mist、PureWhite、Nightmare、Trickster、WolfSorcerer、TimeConsort、Mechanical、AwakenedHidden；ScholarMentor 还委托其基础 profile。HiddenWolf 通过 spread 继承 Wolf callback，没有单独定义，所以不在上述 37 文件列表中。
- Seer、Guard、Psychic、MirrorGirl、PureWhite、Magician、Cupid 等回调使用 World 查询候选/真实存活或 actor 的真实能力状态。它们需要逐条区分“选择信息”与“引擎合法性”，不能把去除 byCamp 当作 F01 全部完成。
- pass/null、固定文本、request 提供的候选列表与 own resource 的 callback 同样登记，但不因它们较安全就授权整份 RoleComponent/World 进入新策略接口。

### 已运行的字面反例

固定原生六人初始化牌序：1 Wolf、2 HiddenWolf、3/4 Villager、5 Seer、6 Guard；请求为 1 号 N1 kill_vote，尚无玩家可见事件。HiddenWolf 不被普通狼人互认，所以 1 号 observation 的 teammateIds 为 `[]`。

1. 2 号真实 `RoleComponent.camp = wolf`：Baseline 与实际 `FallbackActionPolicy.resolve(..., "runtime_error")` 都选择 3 号。
2. 测试 controller 仅将 2 号该 camp 字段改为 good：同一投影 observation 完全相等，Baseline 与 fallback 改选 2 号。
3. 对两份相等 DTO，分别用相同 RNG fork/style 创建 ObservedBot，决策完全相等。

这是用 God-only 字段干预隔离 read dependency 的实验，**不是合法角色转化场景**；CampComponent、Victory 与角色本身未替换。它证明当前生产回退选择依赖玩家没有获得的新信息。目标 C33a 必须冻结明确的新政策及变更轨迹。另一个测试证明 `allow_fallback=false` 与 `action_failure_policy=error` 时 fallback provider 调用次数为零、返回 null，不伪造必选行动。

**F01 结论：保持打开；当前生产例外确定，C33a 必须实施。** P0 未修正它，机械差分仍需保留旧行为。特权 mock/Tape/scripted driver 不等于生产例外关闭。

## F02：Noble 恢复实验与机制差异

### 真实 read / commit 边界

`noble_secret_body/requests.ts` 的私有 `current(request, registration)` 校验：`turn.closed`、领域 lease.isCurrent、原 request body、原 context 引用、原 deadline、当前 alias 的 context/deadline/body，以及最早共享 deadline。该函数在失配时仅返回 false，未设置 closed 或其他永久撤权字段。

- `openNobleBodyRequest` 签发 opaque scope，并通过 WeakMap 绑定原 request；`bindRequestDeliveryGuard` 使用同一个 current predicate。
- `nobleBodyRequestScope` 读 registration、校验 World 与 current；失配返回 undefined。
- `assertRequestDelivery` 调用 bound guard，失败抛 `action_request_delivery_authority_revoked`；自身不关闭 Noble turn。
- `canSubmitNobleBodyChoice` 校验 scope、World、actor/phase/day、原 request current 与目标；非法返回 false。
- `commitNobleBodyChoice` 重新检查后才调用领域 choice.commit，成功设置 closed 并 settle；失败 `noble_body_request_unavailable` 不自动设置 closed。
- `inheritNobleBodyDeadlineRequest` 只登记相同原 context/body 且缩短 deadline 的 alias；错误新 alias 静默不登记。Noble current 只检查 original 和本次读的 alias，并不遍历所有登记 alias。

### 基线已运行结果

| 输入类别与轨迹                                                        | 现有 Noble 结果                                                   | 状态/付款                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 原 context.day：1→2，scope/delivery/preflight/commit 读拒绝，再恢复 1 | 同一个原 request/scope 重新有效，正确 commit 成功一次             | 拒绝阶段 snapshot 完全不变；恢复后 lastChoice `{day:1,targetId:3}`；重复 commit 拒绝 |
| 原 context 引用换为等值对象，读拒绝，再放回原引用                     | 同上，恢复原引用使授权重新有效                                    | 同上                                                                                 |
| 原 allowedTools 换为 speak，读拒绝，再恢复原工具                      | 同上，body 恢复使授权重新有效                                     | 同上                                                                                 |
| 原 deadline 从 absent 改为未来值，读拒绝，再删除                      | 同上，原 deadline 字段恢复使授权重新有效                          | 同上；此实验不是时间过期测试                                                         |
| 已登记期限 alias 的 context 引用/body/deadline 被修改                 | alias 读拒绝，但原 request 仍有效；恢复 alias 后 alias 也重新有效 | 不付款；显式 close 后原与 alias 都无效                                               |
| 新 alias 尚未登记，提交等值但不同 context                             | inherit 不登记；scope undefined，原 request 保持有效              | 不付款；有效原请求仍可 commit                                                        |
| 另一 World、缺 scope、伪造 `{}` scope                                 | 只拒绝本次输入；正确原 scope 仍有效且可提交                       | 不付款，不消费选择                                                                   |
| 有效原 scope，非法目标 999 后改回 3                                   | 非法目标拒绝，仍允许合法重试                                      | 拒绝时 snapshot 不变；正确 choice 成功                                               |

另在真实 `AcpTurnRegistry` 与 `ActionTurn` 上测试一次 foreign session、连续四次错误 turn ID，然后正确 turn ID：拒绝原因分别为 `turn_not_open_or_session_invalid`、`turn_id_mismatch`；`rejectedActions=0`、failureCode=null、pending=1；正确动作 accepted=true/applied=false。这项使用普通 speak 窗口验证协议地址边界，**不是 Noble 特殊工具的完整 ACP 运输测试**，也未声称 ACP turnId 是 Noble capability。

### 第二机制对照：Animal

`animal_dream/request_envelope.ts` 的 `animalRequestEnvelopeCurrent` 对原及每个已登记 alias 逐一检查。任何 body/context/deadline 失配会设置 `withdrawn=true`：原 context.day 改错并读拒绝后，恢复仍无效；已登记 alias 的 allowedTools 改错后，恢复仍无法复活**共享** envelope。错误且尚未登记的新 alias 会抛 `animal_request_envelope_alias_invalid`，而有效原 envelope 仍可用。

所以单调撤权是 Animal 的既有行为，不能从此推断 Noble 已经满足；反过来不能为统一接口而削弱 Animal 的既有 fail-closed 边界。

### 条件性 C18a 判定与未来政策

**F02 已从静态疑点确认为真实差异；C18a 适用，不能在 C18 传播迁移中顺手关闭。** 当前 Noble 请求注释中的“revokes every alias”仅描述即时拒绝，实验不支持“已观察拒绝后永久撤权”的更强含义。

进入 C18a 前应将下表冻结为独立行为修正政策，并对所有实际 request lease 实现核对，而非将一个 Noble 修复宣称为全机制修复：

| 边界                                                                                                  | 新政策要求 / 建议冻结点                                                                                   | 与基线的关系                                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 已绑定原 envelope body/context/deadline 失配，且已被 current/scope/delivery/commit 边界实际读取观察到 | 原租约进入终态；所有已登记 aliases 永久撤权，恢复字段不复活                                               | Noble 有已证明差异；Animal 已满足。没有读过的先改后还原不在本批实验或该判定的覆盖内                                           |
| Noble 派生 alias 换壳失败：alias 独有 context 引用/body/deadline 与登记值失配，而原 envelope 完整     | 拒绝该 alias，不撤原请求；不得为了传播统一而扩大至整份原租约。是否将该 alias 本身永久关闭由 C18a 单独冻结 | Noble 当前原请求继续、alias 恢复后也继续。Animal 已登记 alias 具有既有共享 latch，保留该机制强边界，不能将它回退为 Noble 行为 |
| 尚未登记 alias、未知 scope/token、foreign World/session、错误 turnId                                  | 拒绝当前输入；不撤销另一有效租约，不自动消费有效窗口重试额度                                              | 本批已验证相应现有安全边界，必须保留                                                                                          |
| 有效租约下可恢复的工具参数/目标错误                                                                   | 保留机制允许的重试；资源、历史与事实不付款、不补写                                                        | 已验证 Noble 非法 target 后合法重试；协议合法输入错误额度仍按原 policy                                                        |
| 过期、取消、provider close、有效授权失效                                                              | 终态、关闭责任及迟到返回的拒绝由统一 lease 契约明确                                                       | 本批不覆盖真实时间、进程/MCP 回收；后续 adapter 实测不可被此表替代                                                            |

原 envelope 单调撤权、派生 alias 换壳不毒化 Noble 原请求、外来 turn/token 不污染有效授权，是已明确区分的三类迁移政策，均未在本批实施。alias 与原请求共享的 context 对象内部被修改，属于原 envelope 被修改，不能归入“alias 独有字段失配”来绕开原租约终态。其他 alias 本身的关闭细节留待 C18a 冻结。本批保留 unsafe baseline 测试断言，直到独立修正同时更新此记录、变更范围与新 fixture。

## 执行记录

```bash
cd backend
bun test --preload ./tests/setup.ts tests/architecture/refactor-characterization.test.ts
```

首轮为 13 pass / 0 fail / 111 expect，日志 `/tmp/awa-refactor-characterization-first.log`。之后增加独立非法目标重试测试，最终小批为 **14 pass / 0 fail / 117 expect**，日志 `/tmp/awa-refactor-characterization-second.log`。中间一次命令误在仓库根目录运行，因 `./tests/setup.ts` preload 不存在而未执行任何测试，原失败输出保留于 `/tmp/awa-refactor-characterization-final.log`，未与通过轮合并。测试类型检查 `./node_modules/.bin/tsc -p tsconfig.tests.json --noEmit`（backend cwd）退出码 0，日志 `/tmp/awa-refactor-characterization-types.log` 为空。未执行大规模或真实通信 gate；不把该小批通过计入角色完整验收。

## 供后续切片使用的责任清单

1. C18 只统一传播、期限收缩、completion、关闭责任，保留本记录已证明的各机制成功/失败轨迹。
2. C18a 独立落实真实确认的 terminal revocation 差异，加入原体恢复、已登记 alias、未登记 alias、foreign submit 与合法重试的逐项对照。
3. C33a 冻结受限观察生产 fallback 的新策略，再一起切换 SDK/ACP 装配与默认值；关闭所有声明生产例外。严格必选窗口不伪造 action。
4. mock 的 God 读权保留为显式测试权限；Tape/scripted 不读取生产结算生成自己的 oracle；ObservedPlayers 投影 adapter 与决策 strategy 的权限分开。
5. 包出口迁移核对 action_providers 的外部消费与兼容计划；测试移动保持本文件 14 个测试发现，不丢失 unsafe 差异证据。
