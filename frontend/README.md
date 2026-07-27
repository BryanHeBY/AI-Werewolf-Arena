# AI Werewolf Arena · Replay Studio

当前前端是一个 React + Remotion 的离线复盘工作台。它不连接游戏服务器、不参与在线观战，只读取后端从 `record/session_*` 导出的单个 `.replay.json` 文件。

## 本地流程

```bash
# 先运行一盘已启用记录的对局；然后导出该 session
bun run --cwd backend export:replay --session <session_id> --out /tmp/game.replay.json

# 启动播放器并在浏览器中选择该文件
bun run --cwd frontend dev
```

默认播放器地址为 `http://localhost:5173`。播放器使用 `@remotion/player`，因此相同的 `ReplayDocument` 可在下一阶段直接复用为 Remotion 的服务端渲染输入。

## 验证

```bash
bun run --cwd frontend test
bun run --cwd frontend typecheck
bun run --cwd frontend build
```

## 迁移状态

- 当前入口：`src/main.tsx` → `src/App.tsx`。
- 当前数据源：`@ai-werewolf-arena/replay-contract` 的 `ReplayDocument`，第一版为完整的 `unredacted` 离线记录。
- 已删除旧 Vue、Pinia、Socket 和 mock 实现；后续如恢复在线观战，应从 React 入口与后端正式协议重新设计。
- 角色视角、公开脱敏、在线观战和 MP4 任务队列均不属于这一版范围。
