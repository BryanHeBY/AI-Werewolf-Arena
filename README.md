# AI Werewolf Arena

多智能体狼人杀对局引擎，以及用于离线复盘和视频生成的 React 工作台。

## 当前架构

- `backend/`：Bun + TypeScript 的对局引擎、LLM/ACP 调度、复盘落盘与导出 CLI。
- `frontend/`：React + Remotion Player 的离线复盘播放器；当前只读取导出的 `.replay.json` 文件。
- `packages/replay-contract/`：前端播放器与后端导出器共享的复盘数据类型。
- `configs.example/`：本地运行配置模板，默认经 OpenRouter 使用 DeepSeek V4 Flash。

对局由 `run_llm_game` 或 `run_mock_game` 启动，游戏引擎将事件和最终结果写入 `record/<session>/replay.json`；前端直接加载这一唯一产品文件进行播放。当前没有在线观战、权限隔离或兼容层。

运行配置只接受固定文件结构：`runtime/providers.json`、`runtime/agents.json`、`games/<name>.json`，以及可选的 `runtime/debug_summary.json`。每个 Agent 都必须显式声明 `kind: "llm"` 或 `kind: "acp"`；调试汇总通过 `agentName` 引用一个 Agent，不能内联覆盖模型参数。

对局异常时仍会关闭 Agent 并保存带有 `runtime_error` 结束原因的部分复盘；初始化或最终 `replay.json` 写入失败会使运行命令失败，而不是仅打印警告。若对局和收尾同时失败，调用方会收到包含两者的 `AggregateError`。

首日警长选举后的夜间死亡链结算一旦满足胜利条件，会立即终局，不再请求白天发言或投票。配置的初始警长也会写入复盘事件。导出器和播放器共用运行时校验，拒绝损坏的玩家、事件结构及非连续事件序号；未结束的部分复盘仍可加载。

记录器仅负责持久化，调试摘要由运行入口在核心复盘写入后单独生成；摘要失败不影响已完成的复盘。记录作用域使用 `runWithSessionRecorder` 隔离异步对局，不再共享进程级活动记录器；单独装配规则引擎不会加载 AI SDK。

## 本地运行

```bash
bun install
cp -R configs.example configs
cp .env.example .env
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
