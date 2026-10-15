# Tape3 pending 前缀夹具适配

源码前态为 `07ef28ef`。Tape3 会为实际 false 结算保留已返回候选；两个旧测试把已关闭的错误决定改成 `pending` 时，也必须删除这份终态返回证据。

仅修改 Radiant 两处和 Ghost Bride 一处合成输入。原输入、断言、截断位置和结算序号处理保留；生产格式、审核器与游戏规则未改。逐处逆去三条新增删除语句后，原 TS 结构和 token 相同，两个文件格式稳定。

| 验证                   | 实际结果                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| Radiant 原正例         | 完整07ef场景首红：残留候选导致结构拒绝；原始运行日志前缀保留。    |
| Radiant 后继两个原声明 | 2 通过、0 失败、2 断言；合法 pending 接收，finalized 矛盾仍拒绝。 |
| Ghost Bride 原声明     | 0 通过、1 失败；修正后 1 通过、0 失败、2 断言，17 项过滤。        |

另用实际 Radiant 录制确认：显式 null 候选存在时 pending 被结构拒绝；去掉候选后未终档前缀合法，而 finalized 前缀仍由领域审核拒绝。该诊断不作为额外测试数。

[收据](tape3-pending-prefix-fixtures.receipts.json)、[独立审查](tape3-pending-prefix-fixtures.peer-review.json)和[原始封包](tape3-pending-prefix-fixtures.tar.gz)保存首次失败、启动工具修正及有界后继。三条是原测试声明，不能称为三个新增测试；本笔不声明当前完整 C47 或 P9 已通过。
