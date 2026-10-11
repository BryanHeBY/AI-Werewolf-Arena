# P9d 觉醒之夜：实际通信验收切片

前置 `37d93c6`。本批增加本机真实 SDK HTTP、ACP 子进程与 MCP、混合接入的双语完整／失败场景及独立 wire 校验。**贵族／觉醒愚者仍 planned、正式 48/64 不变**；受限观察、完整窗口／撤权变体、实际前端／Remotion和冻结同源全支持门禁仍接续。

## 人工完整场景

计划先以固定原角色席位手写，再按固定 seed 发牌结果映射，模型 fixture 仅消费动作，不能读取 World 或生产伤害系统生成选择／预期。

15 族覆盖：建立→到期→重选、新／旧夜仆被猎魔清除、刀毒与身体／到期双来源、到期后末狼死亡、活人翻牌持徽及再次真实放逐、终局仍 pending 不追加未来夜、贵族被刀后旧约照到期、救起选定目标后转自护并同日真实放逐、自己毒＋到期只挡毒、猎魔毒免、毒免后的反噬被身体抵消、贵族白天先死后到期、目标白天死后次夜重选、首夜死亡／遗言先于选举，以及解除不能吞独立毒。

`pending_last_wolf` 保留原到期后终局案例，不称它是终局 pending 证据；独立 `pending_at_end` 和 `first_night_death_pending_end` 直接验证第二夜自然终局仍有 paid pending 契约、没有第三夜。初次只用空首夜的计划已补首夜遗言及选举前死者筛除。

独立 golden 以手写终态／死因表逐 CP 检查实际契约、身体和选择，另按字面夜初存活表校验知情延迟／通知槽位；药量／实际使用计数和当前夜药标记、翻牌保留 1.5 票／徽及真实移徽单独断言。不是读取 CP.actual 再拷贝为 expected。原 R 手算／复查在 `/tmp/awa-noble-r-transport-family-review.txt` 和 `/tmp/awa-noble-r-transport-resource-golden.txt`。

## 实際发送的数据

- SDK 保存每次真实 HTTP `messages`，ACP 保存初始化、全部 current prompts、arrival ordinal 和当前已绑定 MCP schema；没有用最终玩家 timeline 代替发送证据。
- 通信消息按 actor／ordinal 对齐独立账本接受的请求前缀。ACP 要求精确完整新 delta；SDK 允许合法连续历史后缀，但本轮新 delta 不能缺失，避免把 96 消息窗口误写成无限历史要求。每个实际记录请求必须有 wire 覆盖。
- 每轮本人状态摘要按已授权事实独立折叠核验，所有保留的 SDK 旧行动提示也核其原回合状态，旧回合号不得超过当前号；不只检查最后一次 current。当前状态行必须唯一，其他角色不出现贵族／身体状态。
- 所有初始化／system／current／历史扫描逐玩家私人 persona canary，数字段精确区分 1 和 10、不能借下划线后文绕过。God 提交、清除和真实抵伤永不进入玩家 wire。
- SDK 实际 `submit_action` 参数及 ACP `listTools` 验精确三字段 envelope／英文说明。每个 ACP 活跃回合实际查询 `get_game_schema`，要求独立字面的 `protocol_version`／三工具说明精确且静态，不允许额外库存或 `{}` 通过。session/new 的 session_not_ready 校准与活跃查询分开记录。
- 三族 8 个字面当前锚点必须命中：到期／耗身当天仍是 pending／intact、下一夜才 expired／spent；清除当天仍 pending、下一夜 cleared；公开翻牌当场及次日立即 exile_revealed。无技能请求的活人也必须收到通知，死者不补通知。

## 配置与失败

四个政策组合分别运行 SDK／ACP／mixed × 中英。相邻同一主动保护目标仅重复允许策略采用；禁连方案使用独立合法相邻目标。restricted 贵族仍狼聊／刀票，但不发自爆窗口请求。普通狼人行为保持。实际贵族自刀由 standard 的 `caster_death` 验证；完整真自爆及其余窗口／越权变体仍需随后完成，不把“没有自爆的合法选择”称为实际自爆分支。

八个必答阶段各 missing／late × SDK／ACP × 中英：身体、贵族、狼聊、刀票、女巫、预言家、猎魔和活人翻牌发言。验证 runtime_error、真实失败 CP／严格 Tape、零 fallback／晚写、队列预算、ACP／MCP PID 和控制端点关闭。翻牌失败保留公开角色、Alive、身体消费、1.5 票和警徽，没有伪造专属发言完成。

## 命令结果与证据范围

| 输入与检查时点                                                  | 结果                            | 日志                                                                            |
| --------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| 默认组合15族 ×3传输×2语言，完整动作／wire／终局／Tape           | 45测试、90局、0失败、133044断言 | `/tmp/awa-noble-transport-complete-expanded-first.log`                          |
| 四政策组合×3传输×2语言，政策行为与wire（未调用golden／anchors） | 12测试、24局、0失败、13148断言  | `/tmp/awa-noble-transport-policy-first.log`                                     |
| 6阶段失败，首次排除错误狼席位的24绿色项                         | 24测试、48局、0失败             | `/tmp/awa-noble-transport-failure-expanded-first.log`（同时保留8个fixture错误） |
| 修正为第二夜仍活的狼11后，狼聊／刀票失败                        | 8测试、16局、0失败、3900断言    | `/tmp/awa-noble-transport-wolf-failure-fixed.log`                               |
| 15族SDK×2语言，新增逐CP身体／契约／已知状态golden               | 15测试、30局、0失败、51996断言  | `/tmp/awa-noble-transport-golden-sdk-first.log`                                 |
| 3族×3传输×2语言，当前跨夜知情字面锚点                           | 9测试、18局、0失败、30968断言   | `/tmp/awa-noble-wire-final-anchors.log`                                         |
| 最新历史约束／schema精确校验，expiry mixed两语                  | 1测试、2局、0失败、3354断言     | `/tmp/awa-noble-wire-final-history-actual.log`                                  |
| 新增女巫库存golden，4族SDK两语                                  | 4测试、8局、0失败、15118断言    | `/tmp/awa-noble-transport-witch-golden-final.log`                               |

各轮有重叠，不能相加成唯一场景数，也不能称所有早期局已重跑最后增强断言。完整同源门禁随最终角色验收执行。最初5族30局只作为早期通信校准，不冒称四政策或完整人工来源矩阵。首轮状态行 JSON 解析及中文标签是 oracle 校准错误，原日志保留；初次狼故障计划错选已死亡狼10的 fixture_failure_target_missing 保留，不记为生产规则缺陷。

## 独立交叉审查

- A：6 个共享 wire 漏检反例和两正例原样 **8/0** 闭合；随后发现 schema 额外库存／空值和重复 current 状态漏检，原6项修后独立 **6/0**，`/tmp/awa-noble-wire-schema-current-a-review-fixed.log`。完整记录、角色映射、逐actor请求、suffix/delta和pending终局复核，无剩余原发现。
- R：15族手写动作／死亡／存活／请求资格复核，无抄错或规则阻塞；详细 actual／known／夜初通知及药徽预期在上述独立报告，不调用生产 reducer。
- T/L/D：原17项发现 foreign canary 后文及SDK旧提示 foreign／提前spent漏检；修后仅将原 `{ok:true}`校准stub换为独立合法静态schema并加入locale，所有攻击保持，新版独立 **17/0**。另一个未来t3状态塞入t1的原单项修后 **1/0**。原红及新版分别保留；最后golden／anchors挂载与实际日志只读复核没有新增阻断。

原反例已迁为四个仓库维护文件，**14/0** 与 **18/0** 分组验证；它们是校验器的纯数据测试，不冒称引擎整局。类型适配仅给故意不完整的 fake record 经 unknown 的边界断言，不宽化生产类型；初次类型错误日志保留。测试类型／格式及diff另行验证。

四文件最终合并复验 **32/0/32**，`/tmp/awa-noble-transport-oracle-all-final.log`；测试类型最后退出0，`/tmp/awa-noble-transport-types-final-fourth.log`，格式检查和 `git diff --check` 通过。

## 接续

补受限观察 handlers及固定种子／分支、剩余真实窗口／撤权和配置差异，导出真实 God／玩家回放fixtures、完成frame／seek与浏览器／视频门禁，再冻结执行全部支持范围回归和独立最终审查后登记50/64。当前仅本地合成模型通信，没有读取认证／用户configs、调用真实计费模型或push；剩余P9／P10及T6授权边界不变。
