# AI Werewolf Arena

多智能体狼人杀对局引擎，以及用于离线复盘和视频生成的 React 工作台。

## 当前架构

- `backend/`：Bun + TypeScript 的对局引擎、LLM 调度、复盘落盘与本地 HTTP 服务。
- `frontend/`：React + Remotion Player 的离线复盘播放器；当前只读取导出的 `.replay.json` 文件。
- `packages/replay-contract/`：前端播放器与后端导出器共享的复盘数据类型。
- `configs.example/`：本地运行配置模板，默认经 OpenRouter 使用 DeepSeek V4 Flash。

对局由 `SessionManager` 启动，游戏引擎将事件和最终结果写入 `record/`；随后用导出命令生成复盘文件，前端加载该文件进行播放。当前没有在线观战、权限隔离或兼容层。

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
bun run --cwd backend export:replay -- --session-id <session-id>

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
