# 狼人杀竞技场 - 前端（当前）

当前前端是 React + TypeScript + Vite 的离线复盘工作台，使用 `@remotion/player` 预览后端生成的 `.replay.json`。它不连接 Socket，也不承担在线观战或身份隔离。

## 入口与数据流

```text
record/session_* ── export:replay ──> .replay.json ──> React Player / Remotion Composition
```

1. 页面入口：`frontend/src/main.tsx`
2. 页面壳：`frontend/src/App.tsx`
3. 离线文件解析：`frontend/src/replay/offline-replay.ts`
4. Remotion 组件：`frontend/src/replay/ReplayComposition.tsx`
5. 跨端数据类型：`packages/replay-contract/src/index.ts`

## 本地命令

```bash
bun run --cwd backend export:replay --session <session_id> --out /tmp/game.replay.json
bun run --cwd frontend dev
bun run --cwd frontend test
bun run --cwd frontend typecheck
bun run --cwd frontend build
```

`ReplayDocument` 当前是可信本地环境使用的完整 `unredacted` 记录。公开分享、玩家/上帝视角和在线观战需要后端投影与授权，不能由浏览器隐藏字段实现。
