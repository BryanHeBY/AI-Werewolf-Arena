# Agent 回合预算与资源（P4 A02）

当前只交付 **SDK 的队列、整回合预算及关闭基础**。ACP session/MCP/进程的完整回收、混合玩家装配及 runner 的多错误收尾将在 A02 后续提交验收；不把本文件当作完整 A02 已完成。

## SDK 的一个回合预算

`LlmActionProvider.getAction` 入口计算：

```text
actualDeadline = min(request.deadlineAtMs, getAction开始时刻 + llmTimeoutMs)
```

未提供请求截止时间时，使用后者；阶段/全局提供的更早 deadline 保留。排队、初始提示准备、模型工具循环和 required-action 重试都消耗这一个预算。重试不会重新获得 llmTimeoutMs。

这是 API 语义变化：llmTimeoutMs 从过去“每次模型 attempt 的最多时长”改为“从 getAction 开始的整个回合最多时长”。真实服务排队较多时应根据所需等待配置整轮预算；并发限额不会使该预算自动增长。

外部取消信号只在后端协作者间传递，不添加进玩家 ActionRequest/context、模型工具参数、DTO 或 Tape。共同 ActionTurn 检查的是同一份已收紧的请求截止时间；SDK 另保留完成/取消后的封口，忽略迟到结果。

## 队列与租约

`ScopedRequestScheduler` 是一局运行时内按 provider key 分组的信号量。工厂的同 provider 玩家共用名额；跨 provider 独立。它不是跨进程或跨密钥别名的全局配额控制器。

- 排队有 deadline timer 和可选 signal，超时/取消立即撤销等待者。
- 释放名额时再检查等待者的截止时间与 signal，过期者不能之后收到租约。
- 名额直接交给队首合格等待者，新的 acquire 不能偷走已交接的同组名额。
- 释放幂等；旧 lease 不能重复释放新 owner 的名额。
- `close` 拒绝等待及后续 acquire；在途名额仍计数，直到真正的 owner 释放。它不会先把 active 清零制造假回收。

## 兜底与关闭

默认工厂兜底为本地 Baseline 选择，不增加模型请求。截止时间已耗尽时仍允许它在立即完成的微任务中做最后选择；异步兜底等待复用原 absolute deadline，不能重置长预算。

FallbackActionPolicy 的等待同时受关闭取消控制；取消后不会再执行自身的终端输出或录制。迟到 resolve/reject 已安装 Promise 处理，不产生动作或未处理拒绝。只把策略自身产生的 FallbackDeadlineElapsed 和本 owner 的关闭原因作为取消；注入兜底抛出的 TimeoutError/AbortError 仍按原实例传播一次，不能靠安全诊断分类吞错。

`LlmActionProvider.close()`：

1. 永久拒绝新回合；关闭队列。
2. 取消所有正在进行的 SDK/兜底等待。
3. 等待本 provider 的逻辑回合结束和 lease 释放。
4. 聚合仍在途的真实拒绝错误，交 runner 与原运行错误一并保留。

关闭造成的已授权取消返回 null，不再新调用兜底。兜底或记录真实失败不触发第二次兜底。factory 的 SDK close 已调用该方法，替换原 no-op。

`runtimeState` 是逻辑 owner 的只读副本计数（closed、turns、scheduler 的 closed/active/queued），不包含 actor、scope、模型、profile、密钥或环境。**计数为零本身不证明任意自定义传输的外部资源都已释放**；真实 AiSdkClient HTTP 响应取消另有实际测试。任意注入实现自行创建的外部副作用不能由这个计数证明回收；ACP 子进程/MCP 的物理回收仍须独立验收。

## 本批验证

- 已有每 provider 限流、公平交接、跨组独立、幂等释放；取消/超时队列撤销，关闭拒新任务和计数归零。
- 排队过期不启动第二个模型请求；required-action retry 不获得新预算。
- active + queued 关闭零新兜底，迟到 SDK callback 拒绝。
- 实际本地 SDK HTTP 挂起响应在 provider close 后触发服务器 ReadableStream cancel，非仅检查 signal。
- 慢兜底关闭、迟到成功/失败、异步兜底 deadline、外来 TimeoutError/AbortError 原错保留一次，以及 close 聚合原运行错误。
- 既有双语完整 SDK/ACP 18 对局、严格 Tape 重放与固定种子模拟保持回归。
