# Agent回合预算、取消与资源

LLM／Pi／ACP的选择只通过同一ActionRequest及完成端口交给领域。回合绝对deadline取请求期限与provider预算中更早者；排队、初始化、工具循环和required-action retry共用，不因重试刷新。

provider内scheduler按明确provider ID共享限额，跨provider独立；不宣称控制同密钥别名或多进程的全局并发。关闭拒新工作、取消并等待本owner操作和lease释放；逻辑active／queued归零不等于任意注入传输物理资源已释放。

ACP wire session ID只在连接内有意义，内部registry key绑定具体owner，模型turn_id仍原短ID。MCP无效turn先核owner／开放状态；原JSON返回引用和受众不被文档整理改成新schema。

ACP 更新先处理工具授权登记与审计缓冲，再调用同步显示回调。显示回调抛错后仍消费后续更新，错误在本轮结束时报告；协议消费失败立即向调用方传播，不等待可能依赖工具授权的 prompt。prompt 自身失败仍排空已到达更新，多个独立错误一并保留，结束回调不能覆盖原失败。

创建等待中止不抢占任意Promise，也不等于向已建立会话发送cancel。晚到创建仍归原owner回收；有界close超时要报告未完成，不能先清计数伪释放。内置session／MCP／进程的取消、graceful、TERM／KILL和清理保各自实际捕获失败范围，不能承诺任意getter／wait／destroy／unref throw都已被统一catch。

Fallback可在原政策下处理模型失败或预算耗尽；外来TimeoutError／AbortError不因名字相同就当自己的取消。body、关闭、最终保存／observer flush真实错误不能被晚回调覆盖或静默二次兜底。

`runtimeState`是逻辑只读摘要，不含密钥／命令／actor scope。真实HTTP abort、子孙进程退出与控制面端口回收需要本机传输证据；完全离线unit不证明物理资源。运行方式见[指南](../guides/run-locally.md)，完整验收范围见[验证指南](../guides/validation.md)。

## 日志开关

两个传输沿用同一运行配置，开关只控制终端观察，不改变提示构建、动作接收、私有记录和资源回收。

| 开关            | SDK                                  | ACP                                                    |
| --------------- | ------------------------------------ | ------------------------------------------------------ |
| `printLlmIo`    | 实际请求消息与原始模型响应           | 首次初始化系统提示、实际每轮提示与合并后的模型 message |
| `printThinking` | assistant 文字、工具调用及结果轨迹   | 合并后的 thought / message 与工具状态变化              |
| `trace`         | 请求、排队、接受、恢复及安全失败诊断 | 同样的生命周期标记与安全失败诊断                       |

两种详细开关同时关闭时，不显示提示、模型 message / thought 或工具轨迹；单独开启 IO 不显示 ACP thought 或工具状态。SDK 的 assistant 输出与 ACP message 同时属于 IO 和轨迹，因此任一相关开关开启即可显示。ACP IO 从流式观察器输出一次，逐 token 合并及工具状态去重保持；没有额外复制整份 response。`createAcpConsoleLogger` 三参数 API 仍沿用既有轨迹输出默认值，runner 明确传入本局两个 flags。

显示标签按独立 `displayLocale` 渲染，原提示、模型文本与参数保留原文。开启 `trace` 仍会显示已接受动作的 args，这是既有 SDK 语义；它不是无内容日志。配置认证/env不作为日志输入，失败仅输出安全诊断。日志属于本地运行观察，私有轮次保存也不受详细日志 flags 控制；不要把这些输出当作公开复盘。

直播事件由终端 presenter 统一补齐 `[live]` 及本地化分类标签。已有席位、行动或阶段专用标签原样保留；熊公告等复用展示文案的事件按现有分类补前缀。明确空受众的 God 事实标为“上帝私有”，公开熊公告仍标为“上帝”。该包装只改变终端行，不改共享回放标签、事件字段或私有信息筛选；被 `printPrivateEvents` 隐藏的技能通知仍保持隐藏。

`printPrivateEvents` 统一控制直播事件中的底牌、狼聊／刀票、守护／用药、查验与机制私有通知。开启后可在本地上帝视角看到子狐选择、真实封刀效果及每只狼的刀权；关闭后这些非公开事件不打印，熊公告等公开事实仍打印。子狐本人只知道自己的选择，每只狼只知道自己的刀权；真实命中效果不通过终端文案反馈给任何玩家。

该开关只筛选直播事件，不覆盖独立的 `printThinking`、`printLlmIo`、`trace`、`printAllEvents` 或聊天汇总。录制的 `replay.json` 按现有契约仍是完整 God 视角；不能把关闭私有直播理解为已生成公开观众版归档。

## 共同私有输出端口

三种传输的模型输出使用 `AgentOutputEvent`，受众固定为 `private`。传输只归一事实；终端和 Web 共用 `game-presentation` 的分类、可见开关及语义色调，模型原文保留原语言。ANSI 只在终端 sink 添加。显示开关不影响原生输出收集与玩家档案。

正常工具调用在终端仅于完成时打印一行，失败打印警告；`trace: true` 时才额外打印开始和中间状态。所有结构化消费者仍收到完整工具事实，Web 可展开调用与回执。ACP 工具状态按调用 ID 去重，文本分段继续保护 Unicode。

私有输出端口不承接 ACP 权限登记。显示异常仍由原传输隔离、在回合结束时报告，不能阻断后续 MCP 工具授权或覆盖原始失败。工具接受和归档中的 `accepted` 只表示候选接受，`applied:false` 仍由引擎实际提交改变。

## 自爆的二次确认

LLM、ACP、Pi 共用 `ActionTurn` 的确认窗口，仍只开放原来的三个游戏工具。`submit_action` 新增可选顶层字段 `confirmation_id`，协议版本 1 保持兼容；普通行动的提交方式不变。

- `self_destruct` 与白狼王的 `self_destruct_with_target` 在机制工具规格中声明确认要求。第一次即使带 `arguments.confirm=true`，也只返回 `ok=true, status=confirmation_required, accepted=false, applied=false`，附原行动参数、双语警示与随机 `confirmation_id`。`ok` 只表示成功处理请求，不能作为停止模型或选定行动的条件。
- 模型阅读警示后，再次提交同一 `turn_id`、`action`、完整 `arguments`，并在顶层附回执编号，才返回 `status=confirmed, accepted=true, applied=false`。确认时重新进行 schema、角色资格、目标和请求约束预检；实际生效仍以引擎最终校验和结果事件为准。
- 编号只存在于当前选择窗口的内存中，绑定当前会话 owner、玩家、日期、阶段、窗口与规范化后的完整参数。同样的首次请求重传只返回原警示；仅连续调用两次自爆而不带编号不会确认。改变目标或理由须重新提案，旧编号失效；错误编号不会自动变成新提案。
- 提案不占用有效行动名额，也不计拒绝次数。可选窗口中模型直接结束即跳过，不因未确认而触发必选重试。关闭、取消、过期会封窗；编号不能带到下一回合。自动回退即使返回自爆候选也被过滤，不能替模型确认。
- 警示与两次工具回执进入同一玩家的私有录制。终端与 Web 共用确认分类，详细输出关闭时仍标明“需要二次确认（尚未选定）”和“已二次确认（尚未生效）”。它们不是公开游戏事件，不给其他玩家追加知识。终端常规工具只显示结果，携带完整提交包时同时展示真实行动参数。
- 这一握手属于 Agent 提交协议。模拟策略、测试中的可信领域驱动仍可直接提供 `ToolCall`，由原领域网关与自爆机制校验；不把确认编号写进领域动作、库存或死亡结算。

示例，第一次提交：

```json
{
  "turn_id": "p7",
  "action": "self_destruct",
  "arguments": { "reason": "决定中断白天", "confirm": true }
}
```

收到警示后确实决定继续，第二次提交：

```json
{
  "turn_id": "p7",
  "action": "self_destruct",
  "arguments": { "reason": "决定中断白天", "confirm": true },
  "confirmation_id": "原样复制第一份回执的编号"
}
```

若决定不自爆，直接结束模型回合，不调用占位行动。旧的单次自爆脚本需显式接入这一握手；测试驱动消费真实回执追加确认，历史冻结 fixture 不修改。
