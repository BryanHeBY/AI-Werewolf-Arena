# Game Event Protocol Refactor Driver (V3)

来源规范：`docs/specs/backend/evolution/architecture/game_event_protocol_refactor_spec_v3.md`

## 任务

- [ ] `GP01` 重构 `RealtimeGameEvent` 类型，补齐增强信封字段
- [ ] `GP02` 在 realtime 翻译层引入细粒度 `type` / `category` / `stage`
- [ ] `GP03` 为所有公开状态变更事件补齐 `publicState`
- [ ] `GP04` 在 `v3_session_manager` 中补齐 `sessionId`、`seq`、首帧 `session.game_started`
- [ ] `GP05` 保持私有事件投递能力，同时统一信封结构
- [ ] `GP06` 修订后端测试，覆盖协议结构、状态刷新与可见性

## 验收

- [ ] `GV01` 后端首帧广播为增强版 `session.game_started`
- [ ] `GV02` `phase.changed`、`player.died`、`night.resolved`、`vote.resolved`、`game.over` 稳定携带 `publicState`
- [ ] `GV03` 所有事件具备 `id`、`seq`、`sessionId`
- [ ] `GV04` 前端不再需要依赖 V2 Socket 事件完成主状态更新
- [ ] `GV05` 狼队私有 / 个人私有事件在新信封下仍能正确投递

## 验收证据

1. 实时类型定义：[backend/src/game/mechanisms/session/realtime_event_types.ts](/home/hby/dev/AWA/fe_workdir/backend/src/game/mechanisms/session/realtime_event_types.ts)
2. 实时翻译注册表：[backend/src/game/mechanisms/session/realtime_event_registry.ts](/home/hby/dev/AWA/fe_workdir/backend/src/game/mechanisms/session/realtime_event_registry.ts)
3. 会话广播链路：[backend/src/server/v3_session_manager.ts](/home/hby/dev/AWA/fe_workdir/backend/src/server/v3_session_manager.ts)
4. 公开状态映射：[backend/src/server/view_mapper.ts](/home/hby/dev/AWA/fe_workdir/backend/src/server/view_mapper.ts)
5. 对外协议文档：[docs/apis/game_event_socket_v1_spec.md](/home/hby/dev/AWA/fe_workdir/docs/apis/game_event_socket_v1_spec.md)

## 建议执行顺序

1. 先定义增强信封类型与辅助构造器
2. 再重构 `realtime_event_registry` 的事件映射
3. 然后在 `v3_session_manager` 中补齐会话级上下文
4. 接着修订现有测试与新增协议断言
5. 最后与前端按同一份 API 文档联调
