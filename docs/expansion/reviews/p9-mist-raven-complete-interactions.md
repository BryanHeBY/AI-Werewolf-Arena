# P9d：迷雾鸦影六种梦境交互的完整 Tape

状态：完整人工交互测试切片完成；前置 `2acdce0`。两个角色仍 planned、44/64 不变，四自爆完整 Tape、实际通信、多种子和前端尚待接续。

## 人工完整情景

固定原座位：1 炼金、2 预言家、3 摄梦人、4 白痴、5–8 平民、9 狼鸦、10–12 普狼。新增五份三夜字面行动计划，各中英真实 PM→Trace→SessionRecorder→finalize→磁盘读取→公共独立解析→精确 Tape 重放；第 3 日自然放逐 9 后好人胜利，不采用 max_days 终局。

| 新情景             | 三夜夜死               | 蛇选择序列 | 额外刀选择序列 | 第 2 夜重点来源                                     |
| ------------------ | ---------------------- | ---------- | -------------- | --------------------------------------------------- |
| pure-saved-dreamer | `[11] / [] / [6]`      | `[null,3]` | `[null,null]`  | 救 3 后无伤害，不牵连 5                             |
| consecutive-heal   | `[11] / [5] / [6,3,7]` | `[null,5]` | `[null,3]`     | 5 的 dream 不能由救治消除                           |
| ordinary-double    | `[11] / [6] / [8]`     | `[null,6]` | `[6]`          | 6 非梦游者，仅 Raven 来源保留                       |
| mixed-order        | `[11] / [3,5] / [6]`   | `[null,3]` | `[3]`          | 3 保留 Raven，5 保留 dream；理由 consecutive→linked |
| self-heal          | `[] / [11] / [6,3,7]`  | `[1]`      | `[3]`          | N1 自救；N2 恰三狼封印；N3 解封知识 `[]`            |

死亡／来源、梦境理由全序、蛇及额外刀的实际请求日期、三个完整 CP 的三份库存、Snake 早于夜死公开均为独立字面断言。pure 两次额外刀 pass 后库存仍 1；其他消费仅发生一次。计划不从生产伤害系统计算预期，第 4 日意外进入直接报夹具错误。

与既有 saved-dreamer、linked、protected-heal 联合，规则卡六条梦境人工账本均已有维护中的完整 finalized Tape：①pure N2；②saved N2；③linked N2；④consecutive N2；⑤protected N1；⑥ordinary-double N2。draw 仍单独覆盖命名 RNG。固定角色人工控制器不属于 observed player，也不能替代通信或 UI。

## 审查与门禁

- R：独立手算五份 oracle、六行对应和库存／请求要求，未用生产 damage 算期望；无规则阻断。
- A：新 10 项／180 断言全绿。另从 HEAD 提取原控制器，与新字面计划控制器各跑四份原情景，完整比较 decisions、去 timestamp 事件、全部 CP、operations 与终局，4 项／20 断言全绿，旧可达行为等价。日志 `/tmp/awa-mist-complete-interactions-a-review.log`、`/tmp/awa-mist-manual-plan-equivalence-review-green.log`。审查临时板路径首次 ENOENT 已修正，未算生产错误。
- T/L/D：新 10 项／180 断言全绿；确认真实落盘与精确重放会比较请求、结算边界、全部 CP、事件和操作记录，而非仅最终 snapshot。日志 `/tmp/awa-mist-complete-interactions-delivery-review.log`。玩家 JSON、实际 SDK／ACP 文案和浏览器不在本切片。

本批只改变测试计划与维护断言。新 10 项加原相关 104 项，共 **114 pass / 0 fail / 497 断言／5 文件**，14.54 秒，日志 `/tmp/awa-mist-complete-interactions-final.log`。root check（含两端及后端测试类型）exit 0，日志 `/tmp/awa-mist-complete-interactions-check.log`；格式与 diff 检查通过。未重复声称 405 录制综合门禁或 P9c 全量适用于本批新输入。

下一步升级四自爆窗口到完整 finalized Tape，补爆死原刀口 pass-only、交徽至待死者再交徽、末狼等待救治和 preVote 不重开。随后继续新角色双语实际通信、精确迟到／资源、多种子与前端验收。
