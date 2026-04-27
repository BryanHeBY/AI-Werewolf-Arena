# Frontend Game Event Consumption Driver (V3)

来源规范：`docs/specs/frontend/game_event_consumption_spec_v3.md`

## 任务

- [ ] `FG01` 建立正式 V3 前端 store，统一消费 `gameEvent`
- [ ] `FG02` 建立正式 V3 Socket 适配层，只保留 `register` + `gameEvent`
- [ ] `FG03` 将 `App.vue` 与主页面组件切到 V3 store
- [ ] `FG04` 将会话创建/查询/停止切到 `/api/v1/sessions*`
- [ ] `FG05` 将 V2 `socket.ts` / `gameStore.ts` 明确降级为 mock-only 入口
- [ ] `FG06` 按增强信封接入 `publicState`、`type`、`actorId`、`targetIds`
- [ ] `FG07` 补齐真实 V3 联调 Playwright smoke test

## 验收

- [ ] `FV01` 前端真实联机时不再依赖 `gameStateUpdate` / `chatMessage`
- [ ] `FV02` 通过 `POST /api/v1/sessions` 后，页面可持续消费增强版 `gameEvent`
- [ ] `FV03` 玩家生死、阶段、终局等主状态来自 `publicState`
- [ ] `FV04` `GET /api/v1/sessions/current` 可用于断线重建公开状态
- [ ] `FV05` mock 模式与真实联机模式均可独立运行
- [ ] `FV06` `vue-tsc`、`vite build`、`playwright test` 通过

## 验收证据

1. 前端主入口：`frontend/src/App.vue`
2. 正式 store：`frontend/src/stores/`
3. 正式网络层：`frontend/src/network/`
4. Socket 协议规范：`docs/apis/game_event_socket_v1_spec.md`
5. Session REST 规范：`docs/apis/session_rest_api_v1_spec.md`

## 建议执行顺序

1. 建正式 V3 store，不动现有 mock store
2. 抽离增强 `gameEvent` mapper
3. 先消费 `publicState`，再补 UI 事件分发
4. 接入 `/api/v1/sessions*`
5. 用 feature flag 或显式模式切换真实联机 / mock
6. 增加真实联调测试，再收缩旧兼容层
