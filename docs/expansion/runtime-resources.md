# Agent 回合预算与资源（P4 A02）

当前已交付 **SDK 的队列、整回合预算及关闭基础**，本批接续 **ACP session/MCP/进程与审计回收**。混合玩家装配与 provider 并发已接续交付，runner 的多错误收尾已接续交付；M21日志开关跨传输语义也已交付，见 [运行日志矩阵](runtime-display.md#p4-m21sdk--acp-日志开关)；G01–G04已接续完成，见[P4验收](reviews/p4-activation.md)。

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

## 混合玩家与 provider 并发

PlayerAgentRuntime.kind 可为 llm、acp 或 mixed；这是聚合 owner 的类型。每个玩家本身的 agent.kind 仍是 llm/acp，由既有座位/角色/默认绑定解析后分派。SDK 与 ACP 各自执行、复用与失败流程保留；没有 Agent 基类或通用投票框架。

factory 在入口复制每个完整 profile/provider 的独立快照，固定本局的 actor→kind/provider/model/人格/预算/启动配置。同 providerName 必须提供相同 provider 配置，否则在初始化前拒绝；改变调用者原 Map/profile/provider 不会修改已运行的路由与限额。陌生 actor 直接拒绝，不能借用另一位玩家的默认客户端。

SDK 共用按 provider ID 分组的 scheduler。ACP 为每个 provider ID 创建自己的 provider/pool/scheduler，限额覆盖初始化提示与实际 prompt；排队包括在原 deadline 内，超时者不启动工厂。对 discard/force 的等待计入 lease 所有权，确认退役完成后才向等待者交接名额。不同 ACP provider 可以同时独立推进，不受另一个 provider 的等待或关闭阻塞。

当回收超时/失败、尚不能证明底层资源已释放时，该 provider 的 scheduler 在放名额前封口，等待和后续新模型请求都拒绝 acp_resource_reclamation_failed；不能因逻辑释放而启动第二个模型。晚到会话仍退役，错误留给最终 close；成功的晚到回收也不自动解除封口，需要显式创建新 runtime。其它 provider 的 owner 不共享这项封口状态。

顶层工厂部分初始化失败时关闭已构造 owner，并把初始化与清理错误同时保留。最终 close 使用 allSettled 尝试全部 SDK/ACP owner，逐个 flush ACP observer；任一错误不跳过其它清理，也不覆盖先前错误。runtimeState 只暴露逻辑状态/计数，仍需物理证据证明进程/网络释放。

兼容说明：纯 SDK/ACP 的 kind 保留，聚合 mixed 是新合法值；外部按 kind 穷举的调用者应处理它。每 actor 的传输类型记录在 Tape.metadata.players[].agent 与配置报告中，manifest 的玩家摘要仍只有原有角色/存活/名称等字段。旧 mixed-not-supported 错误码留在 closed 诊断表作历史兼容，正常路径已不主动抛出。等待工具/语言/旧录制读取规则不变。

### 混合验收证据

共享 SDK 与 ACP provider 各 cap2，S01/S04 六人、S02/S03 十二人、两种奇偶分派、两语共16个新增实际完整对局；与原18局合计34局，均自然结束、零拒绝/回退并逐局严格 Tape 重放。两种分派使七基础角色均经过两条传输；原名、agent 人格继承、席位覆盖和 null 清除在实际 system/init wire 验证本人 marker且无他人 marker。手工胜者/存活/资源/阶段/请求顺序 oracle 沿用原场景，不用引擎计算预期。

quota 回归另外验证过期不创建、强制回收前不交接、回收未完成时不启动等待工厂、caller 原对象变更不改 route/预算、部分初始化/多 owner 清理错误，以及真实不同 ACP provider 同时进展和物理回收。runner 的并发动作多错误与最终收尾已在后续节交付；本节证据不扩展为整个P4或新增角色已完成。

## Runner 并发失败与最终保存

runner 统一持有决定的在途集合、停止状态、关闭 Promise 与错误列表，不把异常策略藏进通用清理层。首个决定失败先由 Tape 结算，再立即关闭 runtime；只有一个关闭调用。停止后拒绝新的模型入口，已启动底层返回的迟到成功在录制前变为 null，不能进入阶段验证。

失败周期在关闭和决定排空后采集真实世界/事件检查点；没有跳阶段或伪造世界冻结。引擎已启动的本地纠错流程可能再请求行动，这些请求记录为停止拒绝，不再调用模型。阶段原错误仍是失败CP与cycle证据；其他决定错误单独用既有controller范围记录，不覆盖第一错误。清理与持久化错误各自汇总，返回原异常实例或AggregateError。

Tape 是含牌面/privateState/完整请求的私有复现资料；错误证据只保存既有范围及有限标准错误名，不保存原错误字符串、堆栈、认证配置或URL。错误名只取受控单次快照：真实native Error的数据descriptor或DOMException内置getter；外来name getter、Proxy/Proxy prototype和未知名字回退Error，不能污染schema或替换原错。原异常对象仍可向后端调用者传播，不进行JSON化。

Runner 失败场景通过真实十二人阶段验证：一名等待、两名分别抛TypeError/RangeError；关闭释放空结果或合法迟到动作，都不能产生晚到提名验证。另叠加清理和最终写盘错误，四个原异常同时保留；关闭一次、决定无pending、失败Tape严格重放与无晚写均验证。并行放逐中取消后的本地retry也经独立审查验证无新模型、无计票终局、严格重放。

本节完成A02的资源/混合/并发收尾门槛。M21日志开关的跨传输输出语义已专项核对，详见 [运行日志矩阵](runtime-display.md#p4-m21sdk--acp-日志开关)。G01–G04规则/权限基础已交付；后续角色与P10发布级长局/组合矩阵继续按路线推进。
