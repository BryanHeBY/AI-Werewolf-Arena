# Bun、React 与 Remotion 迁移审计（第一波）

更新时间：2026-07-27。目标是先跑通「一盘后端记录 → 离线复盘文件 → Web 播放器」；不包含在线观战、视角隔离和 MP4 任务队列。

## 已确认的现状

后端 V3 的领域核心位于 `backend/src/core` 和 `backend/src/game`，对局过程由 `phase_manager`、日夜 pipeline 与机制注册表驱动。`backend/src/ai` 是 LLM 行动提供者；`backend/src/server` 是 Fastify/Socket 会话层；`backend/src/observability` 负责文件化记录。

有两条不同的运行路径：`V3SessionManager` 当前默认接 `BaselineBotActionProvider`，而真实 LLM 对局和完整落盘主要在 `runtime/run_llm_game.ts`。因此「启动 HTTP 会话」并不等价于「跑一次真实 LLM 对局」。

现有 `public_timeline.json` 的命名不代表脱敏：它会记录 `god_private_game_info`、狼人讨论和预言家查验等完整事件。本迁移阶段有意把它作为可信环境里的离线复盘源；任何公网、玩家视角或分享能力开始前，必须新增服务端投影层，前端不能承担隐藏字段的责任。

旧 Vue 页面混合了 V2 聊天界面和 V3 composable；事件命名还存在 `phase.changed` / 下划线式名称的不一致。它们不适合作为新的复盘产品基础，故未继续修补，而是从离线复盘入口重新建立 React UI。

## 第一波落地

- 根工作区已改为 Bun workspace，锁文件为 `bun.lock`；后端脚本统一由 `bun`/`bun test` 运行。
- 新增 `packages/replay-contract`，定义浏览器和 Remotion 共同消费的最小 `ReplayDocument`。
- 新增 `backend/src/replay/export_replay_bundle.ts`：把一个 `record/session_*` 目录整合为单一 `.replay.json`。示例：

  ```bash
  bun run --cwd backend export:replay --session <session_id> --out /tmp/game.replay.json
  ```

- 前端入口改为 React 19、Vite 和 `@remotion/player`。播放器只读取用户选择的离线文件；它不请求 API，也不连 Socket。
- Remotion composition 已使用同一份 `ReplayDocument`，可作为下一阶段无头渲染器的输入。
- 后端 API 测试不再使用 Bun 当前不兼容的 Fastify 内存注入器，而是在临时端口上以真实 `fetch` 测试。前端单元测试使用 `bun test`，并有独立的 Playwright 离线导入页冒烟测试。

## 暂不处理的内容

1. 复盘 schema 目前只保证集成可用，仍直接保留老事件 `type/payload`；后续应设计语义化的 timeline、镜头和字幕层。
2. `unredacted` bundle 仅限可信本地使用。要发布或分享前，必须为 `public`、`god`、`player` 建立后端投影和授权。
3. Remotion 目前仅嵌入 Web Player；服务器端 Chromium/FFmpeg 渲染、队列、存储和成本/并发控制尚未实现。
4. 旧 `src/**/*.vue`、Pinia/Socket 与旧 E2E 用例被保留为迁移参考但已不在当前入口、类型检查和默认测试中。确认不再需要时，应在单独提交中归档或删除。
5. 后端仍以 TypeScript 编译到 CommonJS 产物；Bun 已是开发、测试和脚本运行时。将构建产物也切换到 `bun build` 前，需要先核对 Fastify、Socket.IO 与部署启动方式。

## 下一波建议

先冻结一份版本化的 replay schema：事件语义、玩家视觉状态、镜头时间轴、字幕和音频线索分层。然后实现 Remotion renderer worker，以离线 bundle 作为唯一输入，产出 MP4；最后才考虑在线 API、权限投影和浏览器端下载/任务状态。
