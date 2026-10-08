# Agent 回合预算与资源（P4 A02）

当前已交付 **SDK 的队列、整回合预算及关闭基础**，本批接续 **ACP session/MCP/进程与审计回收**。混合玩家装配及 runner 的多错误收尾仍由 A02 后续提交验收；不把这些子批当作完整 A02 已完成。

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


## ACP 会话与控制面

ACP 的初始化、当前工具回合、取消与响应尾部沿用从 getAction 开始计算的同一个收紧 deadline，注册表使用同一请求副本。耗尽预算的即时本地 Baseline 例外与 SDK 相同；异步 fallback 使用原 deadline 和关闭取消，不重获预算。同玩家同时发起两个 getAction 直接拒绝 `acp_actor_turn_already_open`。

### wire ID 与内部 key

ACP 远端 sessionId 只在其连接内唯一，不是所有玩家/进程的全局身份。AcpProcessClient 为每个新会话创建内部随机 registry key；注入 MCP 控制面绑定此 key，真实 prompt/cancel/session.close 继续使用原 wire ID。模型看到的 turn_id 仍是短的 t1、t2，内部 key 不进玩家提示、私有 round metadata 或 Tape/public 事件。

**API 兼容变化**：AcpProcessClient 返回的 AcpSession.sessionId 现在是内部 opaque key，不能把它当作远端 ACP RPC sessionId。提供自定义 AcpSessionFactory 的后端调用者仍需为不同 owner 提供独立 session key。MCP 控制面只允许绑定自己的单一 owner；关闭后禁止 restart/rebind，关闭与 listen 启动同时发生也会收走已申请的监听器。

### 资源归属与错误

AcpSessionPool 持有初始化 Promise、可复用会话、discard 后的关闭操作和迟到回收。discard 不再丢弃清理错误；close 先取消创建/封口，再等待创建清理和退役操作，收集全部错误交 provider/runner。已取消的初始化如果晚到会话，必经强制退役。

closeAcpSession 的语义从“忽略拒绝/超时”改为有界 normal close，失败后仍尝试 force close，并保留原错误；两个不同错误用 AggregateError 同时返回。ProcessSession 的 force 请求可打断正在 graceful teardown 的进程；完成后不重复发送强制信号。进程组信号仅忽略 ESRCH，其他拒绝不能隐藏；进程未退出或 MCP 清理失败均报告。

每个真实 ProcessSession 顺序尝试取消/可选 ACP close、释放 session/连接与 stdin、有界退出、TERM/KILL 升级、清理拥有的进程组和 MCP 控制面。前一步出错也继续后续回收。初始化阶段同时有原操作错误与回收失败时，AcpInitializationCleanupError 保留二者。

取消通知属于有界最佳尝试：超时触发强制 discard；合法选择可保留，强制回收若失败仍在最终 close 报告。真实 cancel RPC/adapter 拒绝按原实例留给资源负责人，不能用 settleWithin 的 false 淹没它。关闭后不返回已选动作，取 auditTrace 或自定义提示/记录回调触发关闭也不再写被丢弃的私有 finalAction。

### 审计与等待工具

ACP 审计每任务拥有自己的 registry、创建与退役操作；close 等待所拥有的资源。prompt 失败且清理成功仍返回 null；若清理也失败，原 prompt 与清理错误都保留，晚到 prompt 错误不能覆盖已有取消原因。审计与游戏 MCP 权限、任务 locale 和环境授权范围未扩大。

awaitBeforeDeadline 是等待工具，只持有该次等待的 timer/listener，物理资源仍由调用者回收。SDK 的 FallbackDeadlineElapsed 导出保留为共享 TurnDeadlineElapsed 的 alias，instanceof 与稳定 message 保持；不靠宽泛诊断分类吞掉外来 TimeoutError/AbortError。

### 可证明的范围

snapshot/runtimeState 只显示 closed 与逻辑计数。真实 ACP 验收另外核对 agent、MCP、嵌套子进程的 ESRCH 与控制面端口失联；相同远端 wire ID 两个玩家的正常动作/复用和双语任务也实际运行。

不配合取消的自定义创建超过 cleanup 等待预算时，close 必须报未完成，creating 可以仍非零；不会先清掉计数伪称释放。该 Promise 若以后返回会话，回收处理仍在，后续 close 可再次汇总它的失败。没有有限等待能证明一个尚未返回句柄、任意自定义实现创建的外部资源已经释放；内置 AcpProcessClient 的真实进程/MCP 协议已按上述物理证据验证。
