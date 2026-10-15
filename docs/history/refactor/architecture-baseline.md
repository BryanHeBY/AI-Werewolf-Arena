# P0 独立架构、数据与版本核对

## 范围与证据性质

- 固定实施快照：`27a97cb66e8f30fceb7cb20130154291559dd14a`。本报告只读，不修改源码、不访问本地认证/configs/环境变量、不启动模型、不重复完整测试。
- 已完整阅读 `/home/hby/dev/tmp/AWA/AWA-REFACTORING-PLAN.md`。该计划的结构目标可执行；其写作快照 `8a8d4be`、动物 WIP 协调项及“仅交付文档”均已经过期，不能覆盖当前用户授权与已提交验收。
- 当前目录记录 `55/64：23 verified、32 implemented、9 planned`，依据 `docs/expansion/reviews/p9e-animal-dream-acceptance.md:3` 及 catalog。白猫、子狐、河豚已实际完成完整局、协议、录制、复盘与双语验收，应从 P0 纳入迁移矩阵；新重构不能把它们退回 WIP，也不扩大到其余 9 个 planned 角色。
- JSON `/tmp/awa-refactor-p0-architecture-matrix.json` 给出每项源码、真实静态 import consumer 与 10 列职责定位；`/tmp/awa-refactor-static-architecture-audit.mjs` 仅解析固定 git commit 的 blob（排除本轮新测试/WIP），使用 TypeScript AST 读取 import/export/dynamic import/import type/require，不执行项目模块。
- JSON 共 89 行：49 个 roles 子目录、16 个共用机制目录（events/wall_notes 与 stages/night 用实际子模块）、3 个 mechanisms 根模块、21 个 roles 根共享模块。55 个执行 profile 不等于 55 个目录：initial_identity、role_inspection 是共用功能，animal、noble、fragrant、radiant、mist、scholar、pure_white 提供多个角色。
- 各格 `pending-migration` 表示目标尚未完成；`static-presence` 是导航证据，不能当作行为通过。无静态匹配格为 `needs-classification`，不是 N/A。职责负责阶段明确登记；正式完成需切片 commit、消费方切换和范围证据。

## 一、三类证据必须分别登记

| 类别           | 可登记内容                                                                              | 当前依据与限制                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 已证实既有行为 | 已提交角色有限板子、成功/拒绝/故障轨迹与归档结构；基线测试显式断言                      | 最近完整验收文件、既有对应测试与 fixture；本次只定位，不重新执行或宣称所有 N 条都通过                                                                      |
| 冻结规则要求   | N01–N20、各规则卡规定的生命周期、实际死因、公开顺序、有限组合                           | `docs/expansion/contracts/current-rule-behavior.md`、`action-observation-closure.md`、`event-replay-closure.md` 及各现行规则卡；不能以要求推断旧实现已满足 |
| 目标架构约束   | 无具体角色 adapter import、typed owner、唯一状态、统一 lease 传播、公开出口与独立包验证 | 本轮 R01–R18/P0–P9；当前依赖违规与欠缺是待迁债务，不修改规则来让门禁通过                                                                                   |

N02/N04/N05/N08 等已有复杂机制反例证据，仍需逐机制关联；不能从 Animal、Noble 或 Fragrant 的强保护推广到全仓。N03/N06/N10/N12/N15/N16/N18 的覆盖尤其需要成功与失败、请求与提交边界以及旧/新两构建共同输入。F01 已有明确静态实际消费事实，应单独保留行为修正；F02 由独立 characterization 执行者裁决，不由本报告直接关闭。

## 二、当前边界的具体债务

| 债务                       | AST 现状                                                                                                             | 真实路径与影响                                                                                                                                                                                                                     | 首次负责切片                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| AI 对具体 feature 内部依赖 | 107 条生产 import（包含 type）；prompt46、observation26、action_reception14、LLM9、ACP9、fallback2、observed native1 | `backend/src/ai/agents/player/{player_prompt_policy,observation,action_reception}.ts` 与各 transport。不是所有依赖都应立即视为 adapter 违规：观察组装可以作为 composition root，需迁到明确组装入口；LLM/ACP 的专属授权接线必须退出 | C04 登记，C18–C20/C33/C36 切换 |
| 独立 feature 横向内部依赖  | 114 条 /77 条独立目录边                                                                                              | seer 直接导入 radiant/scholar/time/magician/nightmare/evil/demon/cursed_fox，wolf 与 witch 也横向识别特殊板。普通技能应消费按规则集装配的资格、目标映射、检查及贡献；不能依赖更多 if branches                                      | C24–C28                        |
| engine 逐 feature 导入     | 122 条 /36 个 feature 目录                                                                                           | PhaseManager 1401行，37 imports/24 feature目录；DeathResolution1152行，22/15；NightPipeline795行，42/27（数字仅按本报告 AST 口径）。当前难点在时序与所有权，不只是行数                                                             | C23/C27/C29                    |
| core 依赖 game-text        | 15 条 import                                                                                                         | `actions.ts` MessageRef、`events.ts` 事实 map、`board.ts`/`board_schema.ts` preset/shape；六个组件运行时渲染。删除 renderPrompt 前必须转 consumer，事实 schema 与展示需要分层                                                      | C06–C09、C35–C36               |
| 通用扩展契约含专属类型     | HookResult `CharmBinding`；NightStageState导师 modifier 与 evil reflection绑定                                       | `hooks/hook_registry.ts`、`stages/night/contracts.ts` 仍传任意 World、机制私有对象。需要不同查询/转换/提交/提交后扩展点及窄端口，不能仅改类型名                                                                                    | C21/C25–C28                    |
| 三份期限传播               | 每份10个 inheritDeadline 调用                                                                                        | `runtime/game_runner.ts:117–126`、`llm_turn_orchestrator.ts:79–88`、`acp_action_provider.ts:174–183`。当前10个：wall、initial、wild、lonely、ghost、demonHunter、demonWitch、noble、fragrant、animal                               | C18/C19                        |
| 独立 verifier 装配集中     | reproduction parse顺序16条校验（含内置3）                                                                            | `recording/reproduction.ts:875–890`。Noble输出传Demon verifier，顺序有真实依赖，不可变成任意注册排序；audit算法保持独立                                                                                                            | C37                            |
| 原体/状态不够明确          | getComponent<T> 由consumer指定T；Role私有 Record，角色 camp与 Camp component并存                                     | `core/domain/world.ts:168`、`components/role.ts:7–27`、`app/bootstrap.ts:145`。typed map 必须不替换实际组件，Seer当前状态已经存于 native ability；不要再安装第二份 seerState                                                       | C16/C17/C30                    |
| 共享包未独立成立           | 三包只有 root出口，无scripts/tsconfig/tests目录                                                                      | root check/test只运行backend+frontend；依赖验证主要“顺便”。先补3包验证，保持 tests discovery，不虚构新包孤立test                                                                                                                   | C05a/C06                       |
| /src 深导入                | 两处实际跨包深导入                                                                                                   | 前端 scholar-mentor-draft 和 scholar-mentor-preset-draft tests。stage coverage测试的路径字符串是扫描输入，不是依赖 import；package内部相对src导入也不是跨包违规                                                                    | C04/C08/C09                    |
| 现有门禁范围不足           | importBoundary只检查相对边与少数layer，.ts scanner                                                                   | `backend/scripts/import_boundaries.cjs` 忽略 package import；无feature-to-feature、adapter专属、包内部跨入、独立包环境规则。声明债务应逐边精确、只减不增                                                                           | C04，P9全仓                    |
| fallback真实阵营           | 明确生产接入                                                                                                         | `player_agent_factory.ts:158,245` 安装 `new BaselineBotActionProvider(world)`；`action_providers.ts:217–222,254–257` 按真实role.camp选人。机械切片保留，F01后独立政策切换                                                          | C01、C33a                      |

权限 reader 不等于 runtime capability；运行 WeakMap scope 不进入 JSON 这一既有结构应保留。`core/domain/request_delivery.ts` 已有 guard/completion/settlement；统一传播应从这里的真实公共不变量开始，而不是再新建一套并行授权框架。

## 三、source identity 真实范围与 P1 必须承担的任务

`currentEngineVersion()` 位于 `backend/src/runtime/simulation/reproduction_context.ts:78–140`。当前严格 sourceHash：按固定6个root有序递归，**仅 `.ts`**，包含相对路径、源码字节和NUL分隔。lockHash只 hash `bun.lock`；Git commit独立metadata。规则与RNG另有显式匹配。公开 reader 与严格 Tape 不应混为一类兼容。

6个当前root：`backend/src/core`、`backend/src/game`、`backend/src/app`、`packages/game-catalog/src`、`packages/game-text/src`、`packages/replay-contract/src`。静态清单401个 `.ts`。

当前未纳入的生产 `.ts` 为150个：AI63、runtime43、recording33、audit10、replay1。实际请求期限包装、原知识/人格提示、MCP/action reception、checkpoint writer与严格Tape replay/read算法均位于遗漏范围。不能把当前 hash 命名或描述为全仓构建身份，也不能说 adapter 修改当前必然使严格Tape拒绝。`currentEngineVersion` 自己也在遗漏路径。

**P1/C04即可修复覆盖政策，不能等 C39：**

1. 明确 source身份责任：所有执行规则、请求产生/期限/提交路径、观察/模型提示、归档writer/reader/独立审计和因果复现代码均应有精确来源覆盖。最小可解释默认是全部已跟踪 `backend/src` 与所有实际生产共享包 src，加影响模块解析/生成运行产物的明确入口数据；前端源码是否纳入 engine身份应单独说明，不能隐式混入或遗漏真正共享presentation请求实现。
2. 覆盖扩展名以实际支持的生产输入声明：`.ts/.tsx/.mts/.cts`，真实使用的 JS/JSON/schema/生成输入及 package exports/相关构建解析元数据按责任判定；不是把任意本地 configs、认证、record、node_modules 纳入hash。`.d.ts` 是否仅类型也需明确，现算法它们已属于`.ts`。
3. 确定排序、路径与字节算法；新增manifest公开实际hash输入，门禁与hash共用路径规则，验证重命名、新包、新扩展名、删除、exports解析改变不会漏过范围。扫描门禁不把黑名单当覆盖证明。
4. 首次扩大指纹是独立版本边界：旧 sourceHash原样保留；旧严格Tape通常新构建明确拒绝；各构建用同transcript生成自己的合法新Tape，不改历史hash。公开历史reader仍按schema政策。
5. C06/C08/C09/C35/C41每笔同提交更新新增/移出root输入。C39只能整理已完备的identity字段，不能声称此前遗漏已事后恢复。

P0/C02差分的输入需同时冻结 transcript、config、seed、fault transcript、逻辑钟；输出窄规范化真实构建identity、deadline/timestamp字段，ID若映射要双射保因果。不得直接用旧strictTape驱动新build，亦不得从新引擎导出动作重写旧golden。真实时间cancel/late/session资源回收独立验证。

## 四、建议试点与有限退出标准

### 普通：Seer 状态与请求访问

现有 `private_state.ts:244–250` 的 set/getSeerState 已写/读同一个 `native:seer_check` 能力状态；先typed accessor外壳与ComponentMap，保持object reference及旧checkpoint形状。不从Role复制state到新store。

旧状态提交順序包括：time映射effect → seerstate记录 → cursedFox claim → nightsummary → ability use → scholar target → evil reflection → own action → actor event。不能在“整理”中移动这些提交，尤其付款后错误prefix。普通请求当前依赖 captureNightAbilityScope 前/后资格与目标身份，不应宣称已经用专属 opaque request lease 全部封闭。

代表测试入口：`seer_policies.test.ts`、`seer_default_tape.test.ts`、`scoped`能力与night_stage相关反例；普通/native plus gift/copy当前实例、目标替换、await变化、必选/optional、特殊板error语义。Seer完整night_stages横向依赖非常多，C17应先访问接口，C24以后通过具名贡献退出依赖，避免第一个试点同时改映射/反射/毒死规则。

### 复杂：先 Fragrant传播或 Noble（F02澄清后）

Fragrant请求 `current/envelopeCurrent` 以原context/body/最早绝对期限等绑定，并在已观察失配时置closed；Animal独立envelope也已完整验收。建议首个公共bounded-request consumer用Fragrant：已具有最终callback后的纯envelope检查、独立knowledge、付款后的binding、SDK/ACP/mixed与错误恢复轨迹。只迁传播和completion，保留choice predicate与独立死亡规则。

Noble更适合第二个复杂迁移：`requests.ts:52–67 current()` 在原body/context不匹配时本地只返回false，其lease是否同时终止需要 characterization。当前不能把“恢复失配后拒绝”当作已有事实；F02证实差异再单独C18a，区分原体失配、派生alias失配、错误turn/token外来提交。Noble preflight/commit/付款及 reveal speech继续各有契约。

退出范围：三个消费者只调用统一 bounded propagation；新mechanism不再添加adapter feature import；原body/context/earliest deadline/共享completion身份保持；没有scope进入JSON；原prefix、错turn不毒化、拒绝重试、cancel/late/close的既有证据保持。抽象至少用Seer+Fragrant/Noble两个真实机制证明，不能以一机制的强策略覆盖其它机制。

### 生命周期：TimeWolfConsort

`night_frame.ts:254/390/397` open/close/abort真实frame与实际night单位，当前NightPipeline和PM分别持有handoff分支。有有限完整轨迹与故障tests；适合作为P4生命周期第一个试点。正常handoff与abort不得回滚已经commit的target映射事实；所有权对象可先装配成明确值，保留实际frame引用/关闭error政策。不要以通用finally swallow替代原异常汇总。

## 五、全矩阵的消费方闭环

每个机制都存在 profile装配路径，因此 simple Villager/WhiteWolfKing 不自动省略metadata、text与exports；无独立lease并不等于无请求，由通用阶段拥有的request必须登记。checkpoint常为generic players.privateState，某机制没有专属 `_checkpoint.ts`也需保持该归档形状。独立 verifier常在共享 reproduction.ts，不能按文件名缺失登记N/A。

C44桥接删除前：old入口、`core/index.ts`/model、mechanisms index、catalog、`private_state/player_state/player_extended_state`、all3adapter硬接、shared包rootbarrel都应实际搜索消费者；每份bridge有consumer与删除切片，不永久保留两份真相。

JSON的consumer清单包含生产及应用测试，API兼容测试与custom RoleCatalog profile consumer仍需留在切换清单。新包owner测试迁移后旧测试路径应在discovery映射表中出现一次，不以变更后的pass总数代替枚举。Fixture文本字节、词典key/value/placeholder、机器RoleId/ToolName/error码/原文均保持，目录slug变化不改协议ID。

## 结论

计划适合实际55角色快照，需在执行文档中更新已交付Animal状态与实施授权。P0没有发现需要扩大玩法范围或改选全量ECS的理由。结构债务已经可枚举，F01必须独立行为修正，F02需实测。P1首要风险是精确来源扫描遗漏与包出口职责；若仅移动目录而不在同笔闭合指纹/consumer/独立验证，不能通过阶段门槛。

本结论覆盖本报告的静态架构和计划核对。未运行测试，未将现有验收数字累加进本轮结果；正式阶段完成由主实现给出固定输入和实际验证证据。

## 附：全部机制路径（详细10列与consumer见JSON）

| 类别                     | 模块                                                            | 源文件数 | 静态consumer边 | 状态                   |
| ------------------------ | --------------------------------------------------------------- | -------: | -------------: | ---------------------- |
| role-feature             | `backend/src/game/mechanisms/roles/animal_dream`                |        9 |             43 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/awakened_hidden_wolf`        |        9 |             16 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/bear`                        |        2 |              4 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/black_market_merchant`       |        3 |              6 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/cupid`                       |        5 |             14 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/cursed_fox`                  |        3 |              6 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/debater`                     |        4 |             13 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/demon_hunter`                |       14 |             76 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/dreamer`                     |        3 |             19 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/evil_knight`                 |        3 |             16 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/fragrant_pair_seer`          |        7 |             28 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/gargoyle`                    |        2 |              9 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/ghost_bride`                 |        5 |             27 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/gravekeeper`                 |        2 |              4 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/guard`                       |        6 |              6 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/hidden_wolf`                 |        2 |              6 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/hunter`                      |        5 |              8 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/hybrid`                      |        3 |              6 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/idiot`                       |        3 |              3 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/initial_identity`            |        3 |             19 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/knight`                      |        2 |              3 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/lonely_girl`                 |        4 |             17 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/magician`                    |        4 |             27 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/mechanical_wolf`             |        9 |             17 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/miracle_merchant`            |        4 |              9 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/mirror_girl`                 |        1 |              2 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/mist_raven`                  |        8 |             23 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/nightmare_shadow`            |        4 |             18 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/noble_secret_body`           |        8 |             44 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/order_prince`                |        4 |             11 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/psychic`                     |        1 |              1 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/pure_white`                  |        3 |              2 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/radiant_eclipse`             |        6 |             42 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/red_moon_apostle`            |        3 |             14 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/role_inspection`             |        4 |             29 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/scholar_mentor`              |        4 |             26 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/seer`                        |        6 |             11 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/shapeshifter`                |        4 |             11 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/thief`                       |        4 |             15 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/time_wolf_consort`           |        5 |             20 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/trickster`                   |        5 |             16 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/villager`                    |        1 |              1 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/white_wolf_king`             |        1 |              1 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/wild_child`                  |        4 |             17 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/witch`                       |        9 |             12 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/wolf`                        |        9 |             34 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/wolf_beauty`                 |        4 |             15 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/wolf_king`                   |        1 |              3 | 待迁；不以存在证明正确 |
| role-feature             | `backend/src/game/mechanisms/roles/wolf_sorcerer`               |        5 |             13 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/events/wall_notes`                 |        2 |             14 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/sheriff`                           |       10 |             26 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/self_destruct`                     |        2 |              5 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/last_words`                        |        2 |             10 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/win_conditions`                    |        3 |             10 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/broadcast`                         |        2 |              8 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/stages/night`                      |        2 |             79 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/validation`                        |        2 |             35 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/config`                            |        2 |              5 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/prompt`                            |        1 |             11 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/script`                            |        2 |             16 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/registries`                        |        2 |              8 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/common`                            |        4 |             12 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/hooks`                             |        1 |             19 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/llm`                               |        4 |             34 | 待迁；不以存在证明正确 |
| common-mechanism         | `backend/src/game/mechanisms/shared`                            |        2 |             10 | 待迁；不以存在证明正确 |
| shared-mechanisms-module | `backend/src/game/mechanisms/contracts.ts`                      |        1 |             12 | 待迁；不以存在证明正确 |
| shared-mechanisms-module | `backend/src/game/mechanisms/index.ts`                          |        1 |              0 | 待迁；不以存在证明正确 |
| shared-mechanisms-module | `backend/src/game/mechanisms/night_death_timing.ts`             |        1 |              2 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/death_ability_activation.ts` |        1 |              2 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/wolf_team.ts`                |        1 |             18 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/death_abilities.ts`          |        1 |             12 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/inspection.ts`               |        1 |             20 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/death_action_policy.ts`      |        1 |              3 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/player_extended_state.ts`    |        1 |              8 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/death_shot.ts`               |        1 |              9 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/catalog.ts`                  |        1 |             73 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/self_destruct_capability.ts` |        1 |              3 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/ability_changes.ts`          |        1 |             27 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/recipient_ability_stage.ts`  |        1 |              3 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/original_player_scope.ts`    |        1 |              6 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/board_presets.ts`            |        1 |              2 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/player_state.ts`             |        1 |             10 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/gift_gun_death_hook.ts`      |        1 |              2 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/permissions.ts`              |        1 |              3 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/ability_scope.ts`            |        1 |             10 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/private_state.ts`            |        1 |            115 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/contracts.ts`                |        1 |             54 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/abilities.ts`                |        1 |             90 | 待迁；不以存在证明正确 |
| shared-roles-module      | `backend/src/game/mechanisms/roles/night_action_history.ts`     |        1 |             12 | 待迁；不以存在证明正确 |
