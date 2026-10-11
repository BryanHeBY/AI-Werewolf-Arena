# P10 功能切片：逐请求预算与关闭快照

前置 `23bfecd`。此切片提供精确故障验证所需的运行输入；不关闭 P10，也不增加角色完成数量。

## 资源与输入边界

`runGame(setup, dependencies)` 的可选依赖只属于一次运行，不是板子、玩家 DTO、配置文件或环境变量字段。

- `selectRequestDeadline` 接收 actor/day/stage、全局与本人请求序号、retryAttempt、当前时钟。序号按引擎 getAction 计数，含引擎重试；不按模型 HTTP 重试计数，不提供 World、context 或可变请求引用。
- 截止时间取全局游戏、原请求、当前请求正常预算及选择器的最早值；选择器只能收紧。非有限值明确失败。普通预算在进入引擎请求时开始，包含队列及会话准备时间。
- 同 actor/day/stage 的引擎 retry 保留首个绝对截止时间；没有 retry 标记的新机会重新建立预算。预算表归本局 runner 所有，不跨玩家或运行共享。
- deadline clone 继续执行原有七条能力授权继承，不改原请求的 context/tools 引用。
- `onRuntimeClosed` 在停止运行、关闭 Agent、排空行动后收到结构化副本，暴露 closed、turn、scheduler、registry、pool 等计数；不暴露运行对象。同步观察回调抛错归 cleanup，runner 仍汇总原执行错误与清理错误。

## 验证与审查

维护测试 `runner_execution_dependencies.test.ts` 验证单次关闭快照、选择器的纯标量输入、原异常与观察异常同时抛出并写入 termination，以及非有限 deadline 的失败收尾。测试不连接模型；已耗尽运行的测试直接构造执行边界，正常 JSON 配置继续要求正数。

A 独立从当前源码提取原预算类到临时测试，**6 pass / 16 assertions**，覆盖精确一秒、普通十秒、并发隔离、原请求/全局取最早、retry 不延期、同阶段新机会与新运行重置；日志 `/tmp/awa-request-deadline-review-green.log`。另真实 runner 两项 **2 pass / 9 assertions**，日志 `/tmp/awa-runtime-closed-review-green.log`。提取测试是独立审查证据，维护测试留在仓库中。

实际新角色协议测试进一步验证仅字面指定 actor/day/stage/actorOrdinal 收紧为一秒，普通请求十秒、前一夜同阶段 1300ms 正常完成。真正到达、HTTP 取消、MCP 迟到拒绝及进程回收的范围见[失败通路验收](p9-mist-raven-failure-transport.md)。不能仅根据选择器返回值宣称通信或物理回收已完成。

最终源码与静态命令、首次失败及复验记录统一列于该失败通路验收。FD/RSS、长局/并行重复资源及 P10 总体验收继续开放。
