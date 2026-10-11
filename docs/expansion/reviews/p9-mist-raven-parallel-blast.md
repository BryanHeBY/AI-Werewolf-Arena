# P9d：并行自爆意图的独立记录账本

前置 `c4a53b6`。本批修复记录解析，不改引擎的自爆规则；两角色仍 planned，正式 **44/64**。

## 真实触发与规则

扩展受限观察策略后，固定种子 `mist-raven-observed-v1:6` 第2日第二个发言间隙中，6/7同时确认自爆：共同打开序号125、完成序号126/127。引擎实际只执行6，7仍存活并在第3日再次自爆。真实原始记录 `/tmp/awa-mist-observed-rejected.json` 及首次失败 `/tmp/awa-mist-observed-policy-v2.log` 保留。

旧请求账本错要求自爆意图至多一个；未发布伤害账本又移除了所有确认意图。引擎原有规则是 Promise.all 收集同批全部回复，再按号码选择最低的仍合法玩家，只执行这一份选择。未胜出者不消耗生命或后续自爆资格，也仍可成为原刀口。不能减少自爆概率或回避种子来隐藏问题。

独立 archive helper 只读记录：按每个 actor 在 day/stage 数组中的实际请求次序恢复批次，核验 turn 连续、window===stage、同批共同 opening。取同轮全部角色回复，包含 null；必须全部 outcome:action 且完成，接收请求的 cutoff 前完成。Snake/Core另核全体 eligible 普通狼成员集合，然后对确认选择按数字号码取最小值。晚完成、pending、error 或改 turn/window/opening 排除同批成员均不能授权下一步。

三个账本同步核验：核心公开自爆对应真正选择；Snake合法目标/未发布伤害只移除赢家；玩家feed等待完整批次，来源定位匹配已确认的当前轮，不能把同日较早的null gap当成唯一来源。

## 人工完整场景

三份字面脚本两语共六个真实完整局，经 PhaseManager、SessionRecorder.finalize、磁盘公共解析与严格Tape重放：

| 场景               | 三夜夜死              | 狼鸦知识                     | 最终Alive     |
| ------------------ | --------------------- | ---------------------------- | ------------- |
| 首间隙双意图       | `[5] / [11] / [3,7]`  | N3解封，`[]`                 | `[1,2,4,6,8]` |
| 原刀口是未胜出者11 | `[11] / [12] / [3,7]` | N2解封，`[12]`，其死亡后保留 | `[1,2,4,5,6]` |
| 第二间隙双意图     | 同上                  | 同上                         | 同上          |

均仅10实际自爆，第3日Good自然终局。原刀口11在Snake等待时仍合法；pass后以普通刀死亡。两份原刀口脚本第2日放逐8，不能复用另一方案第3夜才解封的预期。

维护反例包括完整记录的不同轮/提前Snake、完整真实trace派生的未发布前缀（确认输家或null回复改pending/error，window/turn/opening篡改），以及真实运行时 `mistPrefix` 截获的 pre-election pending Snake。两种前缀来源明确区分，派生文件不是新的完整运行证据。

## 三路复查与验证

- R：六字面局独立手算、实际复跑；另外发现未发布前缀提前发布P2。原脚本不变最终 **1 pass / 5 assertions**，`/tmp/awa-mist-parallel-r-unpublished-final.log`；维护16项 **16 pass / 75 assertions**，`/tmp/awa-mist-parallel-blast-r-closed.log`。
- A：发现同批 pending/error 与缺失/错误window、通过turn排除null成员的P2。两份原反例输入不变最终 **11 pass / 12 assertions**，`/tmp/awa-mist-parallel-blast-independent-final.log`；维护及旧增量/公共软回复 **51 pass / 173 assertions**，`/tmp/awa-mist-parallel-blast-compat-final.log`。批次问题已关闭，未把软投票/发言改成严格必交。
- T：维护 **16 pass / 75 assertions**，`/tmp/awa-mist-parallel-delivery-review.log`；核实六完整局实际落盘/Tape、第二gap与未胜出原刀口，并确认引擎规则没有修改。

主任务最终受影响门禁 **173 pass / 2690 assertions / 9 文件 / 0 fail**，26.94秒，`/tmp/awa-mist-parallel-final-feature.log`。包含完整交互/自爆/终局、核心及玩家账本/兼容/增量、运行失败边界。独立反例和维护联合 **28 pass / 92 assertions**，`/tmp/awa-mist-parallel-source-review-green.log`。root check/lint/format与diff检查通过；测试enum/nullable结果的类型错误已修正，原check日志保留。

首轮新增四完整局在旧账本均失败，保留 `/tmp/awa-mist-parallel-blast-red.log`；后续初版未覆盖未发布同批完成、null/error与身份绕过的独立红日志也保留。20混合种子修后自然结束/零拒绝和回退属于后续观察切片，不代替当前独立人工账本证据。本批不冒称P9d全量、角色完成、前端或P10完成。

## 接续

接续50固定种子的两语观察/严格重放、有效消费与保留/抽刀计数，再交付真实前端fixture与seek/frame/Chromium；其余P9d–P10仍开放。main本地线性提交，不推送。
