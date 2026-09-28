# AI Werewolf Arena

多智能体狼人杀对局引擎，以及用于离线复盘和视频生成的 React 工作台。

## 当前架构

- `backend/`：Bun + TypeScript 的对局引擎、LLM/ACP 调度、复盘落盘与导出 CLI。
- `frontend/`：React + Remotion Player 的离线复盘播放器；当前只读取导出的 `.replay.json` 文件。
- `packages/replay-contract/`：前端播放器与后端导出器共享的复盘数据类型。
- `configs.example/`：本地运行配置模板，默认经 OpenRouter 使用 DeepSeek V4 Flash。

真实 Agent 对局由 `runtime/cli/run_game.ts` 启动，并将事件和最终结果写入 `record/<session>/replay.json`；`runtime/run_mock_game.ts` 只运行本地基线机器人对局并打印结果。前端直接加载 `replay.json` 进行播放。当前没有在线观战、权限隔离或兼容层。

运行配置只接受固定文件结构：`runtime/providers.json`、`runtime/agents.json`、`games/<name>.json`，以及可选的 `runtime/debug_summary.json`。每个 Agent 都必须显式声明 `kind: "llm"` 或 `kind: "acp"`；调试汇总通过 `agentName` 引用一个 Agent，不能内联覆盖模型参数。

LLM Agent 的 `reasoningEffort` 可选，通过 AI SDK 的 `providerOptions` 发送；OpenAI 兼容接口可选 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`，Anthropic 只接受 `low`、`medium`、`high`，具体档位仍取决于模型。不填则不主动指定推理档位。`thinkingEnabled` 仅在显式设为 `true` 时生效：支持该能力的 Anthropic 模型使用 SDK 的自适应 thinking，OpenAI 兼容网关沿用 `extra_body.thinking` 扩展。Anthropic 自适应 thinking 不支持同时指定 `temperature`。`maxTokens` 与 provider 的 `maxConcurrentRequests` 必须是正整数。

请求头的 `userAgent` 只从对应 provider 配置读取；未配置时使用 `AWA-Werewolf/1.0`。指定推理或 thinking 时不再自动补 `temperature`，如模型支持，可在 Agent 上显式设置。模型调用使用 AI SDK 自带的最多 3 次重试。

对局天数、超时、审计次数和并发数必须是正整数。审计的 `publicMaxItems` 与 `playerMaxItems` 至少为 60，`maxItems` 至少为 50；低于下限会在加载配置时明确报错。

旧配置中的 `forceJsonResponse` 从未控制实际请求，`reasoningEnabled` 曾对所有 OpenAI 兼容接口默认启用推理参数；这两个字段现已移除。升级已有配置时删除它们，并在需要指定推理档位的 Agent 上填写 `reasoningEffort`。

对局异常时仍会关闭 Agent 并保存带有 `runtime_error` 结束原因的部分复盘；初始化或最终 `replay.json` 写入失败会使运行命令失败，而不是仅打印警告。若对局和收尾同时失败，调用方会收到包含两者的 `AggregateError`。

首日警长选举后的夜间死亡链结算一旦满足胜利条件，会立即终局，不再请求白天发言或投票。配置的初始警长也会写入复盘事件。导出器和播放器共用运行时校验，拒绝损坏的玩家、事件结构及非连续事件序号；未结束的部分复盘仍可加载。

记录器仅负责持久化，调试摘要由运行入口在核心复盘写入后单独生成；摘要失败不影响已完成的复盘。记录作用域使用 `runWithSessionRecorder` 隔离异步对局，不再共享进程级活动记录器；单独装配规则引擎不会加载 AI SDK。

ACP 的初始化受 provider 的 `initializeTimeoutMs`（默认 45 秒）、当前回合超时和对局截止时间共同约束；超时会取消初始化并回收 Agent/MCP 资源，迟到建立的会话也会关闭。`maxConcurrentSessions` 过去未生效，现已移除并拒绝该配置字段；ACP 仍为每个玩家保留独立会话。

## 本地运行

```bash
bun install
cp -R configs.example configs
# 在 configs/runtime/providers.json 中填入 OpenRouter API key。

# 使用 DeepSeek V4 Flash 跑六人或十二人对局
bun run --cwd backend run:six
bun run --cwd backend run:twelve

# 使用 configs 中配置的 Codex ACP agent 跑十二人局
bun run --cwd backend run:twelve:acp

# 导出复盘；将 <session-id> 替换为 record/ 下的对局目录名
bun run --cwd backend export:replay -- --session <session-id> --out ./<session-id>.replay.json

# 启动离线复盘播放器
bun run dev:frontend
```

## 验证

```bash
bun run check:backend
bun run test:backend
bun run check:frontend
bun run test:frontend
```

复盘格式与开发方向以代码和测试为准；不维护独立的详细规格文档。
