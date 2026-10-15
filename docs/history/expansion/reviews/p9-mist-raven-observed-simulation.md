# P9d：迷雾鸦影受限观察与固定种子

前置 `639d886`。本批覆盖T3与模拟分支，两个角色仍planned，正式 **44/64**；实际前端和P9d阶段门禁继续。

## 策略边界与分支

策略通过现有 ObservedPlayersActionProvider 接收本人身份/状态、授权事件与显式候选的冻结DTO。Bot只持有玩家自己的RandomDraws与style；World、隐藏底牌、全局seed仍只由controller/投影适配器拥有。

保守炼金第1夜保留雾，后续有合法机会时选择三个目标；随机策略可保留雾/蛇/鸦刀，竞争策略第1夜保留蛇。仅在MIST板显式wolf_kill_candidates存在时，保守狼明确弃刀；其他板子沿用原候选过滤与相同RNG调用。没有为了通过模拟降低自爆概率或回避失败种子。

SimulationReport保留原事件type计数，另外从成功提交的三类chosen事实计 `spend/pass/later_spend`。非null意味着本次消费选择，null是保留；later_spend仅day>1。skipped事实不伪装为动作pass，重复spent通知不计新消费；这三个指标不代表蛇实际救活或额外刀实际杀死。梦境/救治/刀源的物理效果由独立核心账本和具名人工完整局验收。

## 实际固定种子验收

- mixed：`mist-raven-observed-v1:0..29`，四种风格按原独立样式流分派。
- conservative：`mist-raven-conservative-v1:0..19`，全体保守策略，覆盖明确弃刀及第2夜雾圈随机刀。
- 上述50个不同种子各用en/zh-CN执行，共 **100个真实完整录制局**；没有捕错跳过、替换seed或max_days伪终局。每局自然结束、零拒绝/回退、checkpoint全部complete、决定全部action。
- 每局读取实际磁盘replay/reproduction，经公共解析器、独立Mist角色/观察账本与严格Tape回放，核最终snapshot。中英逐seed的结果/分支/拒绝/回退摘要完全一致。
- 原触发问题的seed6额外单独执行一次，验证批次位置不改变摘要；这一重复局没有再单独执行exact Tape，不加进100局严格重放数量。

mixed群体实际覆盖雾消费/保留/后夜消费、蛇消费/保留/后夜消费、鸦刀消费/保留、解封、自爆和查验。保守群体每个第1夜雾均pass，普通狼每票均显式null/abstain；20个单语样本中17局第2夜用雾且17次抽刀，另3局未获得后续用雾机会。两语测试均检查实际抽刀次数等于雾消费次数；不宣称每个保守局必抽刀。

## 交叉审查与门禁

- A：DTO/候选复制、玩家独立RNG、非MIST兼容及消费计数审查通过；原观察权限回归 **5 pass / 27 assertions**，`/tmp/awa-mist-observed-boundary-a-review.log`。
- R：50个完整seed列表、100局解析/Tape逐项调用与原seed6保留审查通过；独立从仍在磁盘的旧20 mixed+20 conservative档案公开解析、逐局重算分支及弃刀/抽刀 **40 pass / 0 fail**，`/tmp/awa-mist-observed-r-archive-check.log`。该40档只作独立审查样本，不冒充最终100局的另一重跑。
- T：前端现状独立盘点及未知/旧档 **94 pass / 856 assertions**，`/tmp/awa-mist-front-inventory-review.log`；这不是新MIST前端验收，新的fixture、私有视角和浏览器仍待执行。

主任务维护门禁 **4 pass / 2521 assertions / 0 fail**，199.38秒，`/tmp/awa-mist-observed-final-first.log`，包含100局录制/严格重放及一次seed6重复摘要。root check、lint、format与diff通过，`/tmp/awa-mist-parallel-observed-check-final.log`、`/tmp/awa-mist-parallel-lint-final.log`、`/tmp/awa-mist-observed-parallel-format.log`；测试nullable结果的编译错误已修正，保留原check日志，不改变运行断言意义。

新增策略首次混合模拟暴露的并行自爆记录错误及两轮未发布批次漏洞，见[独立账本修正](p9-mist-raven-parallel-blast.md)，已单独提交并完成三路原反例复查。首次失败日志和原始raw档保留，本批全部seed修后通过。没有调用外部模型。

## 接续

下一步从实际后端落盘导出MIST normal/自爆/双移徽/并行败选刀口fixtures，核God/炼金/狼鸦及非owner视角、公告前后逐frame/seek与中英Chromium。当前工作台只导入God回放，席位筛选不等于私有视角。全部交付后才登记两个角色implemented，并运行新源码P9d阶段全量；其余P9d–P10与T6仍继续，main本地提交、不推送。
