# AI Werewolf Arena · Replay Studio

当前前端是一个 React + Remotion 的离线复盘工作台。它不连接游戏服务器、不参与在线观战，直接只读后端 `record/session_*/replay.json`。

## 本地流程

```bash
# 先运行一盘对局，再把 session 目录直接交给播放器
bun run replay:dev -- --input ../record/session_<id>
```

也可以直接传入 `../record/session_<id>/replay.json`。命令只读取该文件并由 Vite 提供为 `/api/replay`，不会复制或改写 record。默认播放器地址为 `http://localhost:5173`。播放器使用 `@remotion/player`，与离线渲染共用同一个逐帧画面。显示语言缺省跟随文件locale（旧档中文），时区缺省UTC；切换不修改文件或播放/筛选状态。

## 验证

```bash
bun run --cwd frontend test
bun run --cwd frontend typecheck
bun run --cwd frontend build
```

## 迁移状态

- 当前入口：`src/main.tsx` → `src/App.tsx`（加载状态）→ `src/replay/ReplayWorkspace.tsx`（工作台）。播放控制集中在 `useReplayPlayback.ts`，舞台、席位、时间线分别由 `ReplayStage`、`PlayerSeats`、`EventTimeline` 呈现。
- 当前数据源：`@ai-werewolf-arena/replay-contract` 的 `ReplayDocument`，当前为完整的 `god`（上帝）离线复盘视角。
- 文件加载与校验在 `offline-replay.ts`，事件文案在 `event-labels.ts`，状态投影在 `replay-projection.ts`；Remotion 画面仍按 frame 推导事件，不依赖工作台的筛选状态。
- 已删除旧 Vue、Pinia、Socket 和 mock 实现；后续如恢复在线观战，应从 React 入口与后端正式协议重新设计。
- 角色视角、公开脱敏、在线观战和 MP4 任务队列均不属于这一版范围。

## 双语图片/视频

```bash
bun run --cwd frontend replay:render -- --input ../record/session_<id> --output /tmp/game.en.mp4 --locale en --time-zone UTC
bun run --cwd frontend replay:render -- --input tests/fixtures/sample.replay.json --output /tmp/frame.zh.png --locale zh-CN --time-zone Asia/Shanghai --frame 100 --browser /usr/bin/chromium
```

输出PNG或H.264 MP4，已有目标和源文件不覆盖。语言/日期/历史字段、渲染参数、独占发布与资源关闭详见[展示契约](../docs/expansion/replay-display.md)。本地已有浏览器可设置`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`运行`test:e2e`；缺省使用Playwright安装的浏览器。
