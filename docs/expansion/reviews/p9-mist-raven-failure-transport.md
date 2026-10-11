# P9d：迷雾鸦影严格失败与精确迟到

前置 `23bfecd`；本批结束后角色仍 planned、正式进度仍 **44/64**。固定种子受限观察局与真实前端 fixture 尚待交付。

## 真实失败矩阵

沿用四份正常计划中的 linked 字面场景，只保留目标阶段之前的真实行动前缀；计划不根据生产请求或实际记录生成。

| 目标                 | 日次 | 缺失/迟到      | 非法                                 |
| -------------------- | ---- | -------------- | ------------------------------------ |
| 迷雾                 | 1    | SDK、ACP，两语 | SDK、ACP，两语                       |
| 蛇药                 | 1、2 | SDK、ACP，两语 | SDK、ACP，两语                       |
| 额外鸦刀             | 2    | SDK、ACP，两语 | SDK、ACP，两语                       |
| 狼聊、普通狼票、查验 | 2    | SDK、ACP，两语 | 既有公共技能校验沿用，不另算新增反例 |

上述 **36 个测试、72 个双语实际失败局**，另有生效雾圈普通狼缺失/迟到 **4 个测试、8 个双语局**，共 **40 个测试、80 个实际失败局**。SDK 使用本机合成 OpenAI 兼容 HTTP 和真实 AI SDK；ACP 使用真实 stdio Agent 与注入 MCP。没有调用外部模型。

补充场景使用 draw 字面雾圈 `[5,11,8]`：普通狼5通信失败，狼8/11均已有真实实录的明确弃刀。缺失响应先正常等待1300ms，使其他票确实完成。必须严格失败，不能把传输失败计成弃刀后触发随机刀；验证雾已消耗、蛇药未消耗、无随机刀/夜公告/救治/终局及失败Tape。

普通请求保持十秒，仅选中的迟到 actor/day/stage/actorOrdinal 收紧为一秒。模型夹具延迟 2200ms。SDK 与 ACP 在延迟前保存真实到达时间、turnId、日次、阶段及本人请求序号；验收必须找到指定失败请求，且到达时间早于截止。前一日同角色同阶段的蛇药/查验特意等待 1300ms，仍成功进入后续失败局；不能把上游意外超时当成选定失败通过。

失败记录验证指定请求 outcome:error、此前本人请求为 action、末 checkpoint 未完成、原日次/库存/选择历史、尚未发布本夜死亡、无 game_over 与 fallback；公共 replay、全部 player view、私有 wire 授权与严格 Tape 重放均检查。非法反例使用不在候选中的目标，确认真实 SDK/MCP 拒绝后严格失败，不消费待执行库存。

## 三种不同证据

1. **SDK 超时取消**：实际返回部分 JSON 响应流；截止后读取未完成、cancelledBy:client，在测试 finally 之前断言。测试清理取消单独标为 fixture_cleanup，不能替代运行取消。夹具拥有的延迟定时器最终清空。
2. **ACP 到达与物理回收**：真实行动提示在 deadline 前到达，Agent 尚在延迟中被超时回收。保存 Agent/MCP PID，关闭后对保存值检查 ESRCH；runtime 关闭快照的 turns、scheduler active/queued、registry pending、pool sessions/creating/retiring 全零。每个正常/失败局实际注入的MCP localhost控制端口另用直接TCP探针检查，只有ECONNREFUSED通过；连接成功、超时或其他错误均失败。探针finally清理并等待自身socket关闭，清除自身定时器。被回收进程通常不会执行后续 submit，不能把它表述为已发送迟到提交。
3. **真正迟到 MCP 提交**：`mist_raven_late_mcp.test.ts` 在真实 PhaseManager 能力窗口暂停，保留当前能力授权；测试自己持有 control/client/stdio sidecar，等待 2200ms 后真正 callTool 并读取拒绝。三项新能力两语六例，还覆盖未来有效 turn 被 closeTurn 或 registry.close 后的提交、旧 ID 不能污染新回合、同一授权窗口的新有效 ID 可以接受。库存/事件在接收层不变。测试独立资源最后关闭并检查保存 PID 的 ESRCH；这组证据不替代第 2 项 provider 自有资源回收。

## 审查与门禁

- A：runner 预算及异常所有权审查通过，详见[请求预算切片](p10-request-budget.md)。七条继承完整、deadline 只能收紧、输入与关闭快照不暴露 World/运行引用。
- T：矩阵定向独立复验 **8 pass / 16 双语失败局 / 5268 assertions / 0 fail**，`/tmp/awa-mist-failure-delivery-review.log`。MCP 最后复验 **6 pass / 132 assertions / 0 fail**，`/tmp/awa-mist-late-mcp-delivery-review-v2.log`。
- R：要求关闭尚有效回合再提交的独立证据，已补 future-deadline closeTurn/close 正反例；实际迟到与进程被回收的声明分开。

R 独立复验生效雾圈补充 **4 pass / 530 assertions / 8 双语局 / 0 fail**，`/tmp/awa-mist-active-circle-r-final.log`。T 复验端口探针 **2 pass / 812 assertions / 4 双语正常/失败局 / 0 fail**，`/tmp/awa-mist-control-listener-delivery-review.log`；清理路径与严格拒连条件通过。

初轮矩阵 **36 pass / 21920 assertions / 0 fail**，`/tmp/awa-mist-precise-failure-matrix-first.log`。旧兼容门禁 **78 pass / 18486 assertions / 7 文件 / 0 fail**，`/tmp/awa-precise-deadline-compat-first.log`，包括新角色 24 个正常协议局、蚀时狼妃失败、魔术师迟到、runner 并发错误、SDK 预算、ACP 资源与真实 MCP schema。

最终候选统一功能门禁 **61 pass / 38506 assertions / 4 文件 / 0 fail**，219.84秒，`/tmp/awa-mist-precise-listener-final-v3.log`，包括80个双语失败局、24个双语正常协议局、6个真实MCP迟到/关闭/旧ID例与3项runner收尾。正常/失败局的所有已启动ACP角色逐一检查PID、控制端口及runtime计数。runner功能提交 `ea5ebf2`；本批协议测试按独立功能提交。

root check、lint、format:check和git diff --check通过；日志 `/tmp/awa-precise-final-check-v3.log`、`/tmp/awa-precise-final-lint.log`、`/tmp/awa-precise-final-format.log`。文档在最后统一格式化；不使用旧 P9c 全量冒充当前源码的阶段验收。FD/RSS、长局与并行P10资源门槛仍开放。

首次 runner 测试把零时限传给正数配置解析器而失败，已改为解析合法输入后直接构造耗尽执行边界，保留 `/tmp/awa-runner-dependencies-first.log`；早期 MCP 测试语法与测试 rank 索引类型错误也已修正，保留相应 first/check 日志。T 发现 MCP SDK 在 close 后将 pid getter 清空，原测试退出分支没有执行；已在连接后保存并检查真实数字 PID，复验新增每例两条 PID 断言，未将原绿色日志充作退出证明。

增加监听证明时，首轮夹具错要求控制URL带尾斜杠，实际注入的是origin，日志 `/tmp/awa-mist-precise-listener-final.log` 保留并中止；修正后fetch版每个探针耗时一秒且可能受代理环境影响，第二轮 `/tmp/awa-mist-precise-listener-final-v2.log` 也保留并中止。最终使用直接TCP及明确ECONNREFUSED证明，不把任意HTTP拒绝/超时等同于端口关闭。

## 接续

下一步 20–50 固定种子、DTO 受限观察策略的有效分支计数、真实 replay/player/public fixture 与 seek/frame/Chromium；全部完成后才登记两个角色 implemented。其余 P9d、P9e、P9f、P10 与 T6 指定配置/预算的授权门槛仍开放。main 本地按功能提交，不自动推送。
