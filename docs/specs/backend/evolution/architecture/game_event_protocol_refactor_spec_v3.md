# Game Event Protocol Refactor Spec (V3)

开发驱动：`docs/drivers/backend/evolution/architecture/game_event_protocol_refactor_driver_v3.md`

## 1. 目标

将当前 V3 实时协议从“薄事件模型”升级为“增强版 `gameEvent` 信封”，使其可以稳定支撑：

1. 前端正式联机消费
2. 时间线调试与去重
3. 公开状态一致性恢复
4. 私有可见性约束
5. 后续协议演进与自动化回归

## 2. 当前问题

当前 `RealtimeGameEvent` 仅包含：

1. `type`
2. `data`
3. `timestamp`
4. `visibility`

这会带来以下问题：

1. `type` 过粗，前端无法稳定区分“发言 / 投票 / 夜间技能 / 状态变化 / 终局”等语义。
2. 状态变化事件缺少稳定的最新公开状态，前端只能靠局部 delta 猜测玩家存活、阶段或终局。
3. 缺少 `id` / `seq` / `sessionId` 等信封信息，不利于重连去重、回放定位与联调排障。
4. 实时层事件名称与领域事件名称当前耦合过紧，不利于后端对外协议长期演进。

## 3. 范围

本规范覆盖：

1. `RealtimeGameEvent` 结构重构
2. 领域事件到 realtime 事件的翻译规范
3. `publicState` 生成与注入要求
4. `type` / `category` / `stage` 命名约束
5. 与会话管理器广播链路的对齐

本规范不覆盖：

1. REST API 结构设计
2. 前端 UI 组件实现
3. 回放文件落盘格式重构

## 4. 顶层协议要求

后端对外广播的 `gameEvent` 必须符合 `docs/apis/game_event_socket_v1_spec.md`。

至少应包含：

1. `id`
2. `seq`
3. `schemaVersion`
4. `sessionId`
5. `category`
6. `type`
7. `day`
8. `phase`
9. `timestamp`
10. `data`
11. `publicState`
12. `visibility`

可选但推荐：

1. `phaseId`
2. `stage`
3. `actorId`
4. `targetIds`

## 5. `type` 设计约束

### 5.1 命名原则

1. 采用点分命名空间，而不是下划线聚合。
2. 对外协议 `type` 属于前后端协作契约，不要求与领域事件 `GameEvent.type` 同名。
3. `type` 必须细粒度到足以驱动前端日志、动画和测试断言。

### 5.2 必须支持的首批类型

1. `session.game_started`
2. `phase.changed`
3. `agent.thinking`
4. `agent.thought_complete`
5. `player.action.speak`
6. `player.action.vote`
7. `player.action.kill`
8. `player.action.guard`
9. `player.action.check`
10. `player.action.heal`
11. `player.action.poison`
12. `player.died`
13. `night.resolved`
14. `vote.resolved`
15. `game.over`
16. `winner.declared`

## 6. `publicState` 设计约束

### 6.1 强制要求

所有会改变前端公开主状态的事件必须携带 `publicState`。

首批至少包括：

1. `session.game_started`
2. `phase.changed`
3. `player.died`
4. `night.resolved`
5. `vote.resolved`
6. `game.over`

### 6.2 语义要求

1. `publicState` 是事件处理完成后的“最新公开状态”。
2. `publicState` 由后端统一构造，前端不得自行推断。
3. `publicState` 中必须稳定提供玩家公开存活信息。
4. 若存在公开翻牌、警徽、失去投票权、终局公开身份等，也必须体现在 `publicState` 中。

## 7. 翻译层约束

### 7.1 分层原则

建议分层保持为：

1. 领域层：产生 `GameEvent`
2. 实时翻译层：把 `GameEvent` 映射到增强版 `RealtimeGameEvent`
3. 广播层：根据 `visibility` 与 `register` 路由给不同 socket

### 7.2 禁止事项

1. 不要在 `v3_session_manager` 中散落拼装各种裸对象。
2. 不要把前端所需字段直接耦合进领域事件原始 payload。
3. 不要让前端继续依赖单独的 `game_started` 裸广播与后续薄事件并存。

### 7.3 推荐职责

1. `realtime_event_types.ts`
   - 定义增强后的 `RealtimeGameEvent` 与辅助类型
2. `realtime_event_registry.ts`
   - 负责稳定的领域事件到 realtime 协议映射
3. `v3_session_manager.ts`
   - 负责为每个事件补齐 `sessionId`、`seq`、初始启动广播等上下文
4. `view_mapper.ts`
   - 负责生成 `publicState`

## 8. 可见性约束

1. `visibility.scope = public` 的事件可以广播给所有连接
2. `wolves_only` 只投递给狼队相关注册连接
3. `private_targets` 只投递给指定玩家连接

要求：
1. 可见性只决定“谁能收到”。
2. 收到事件的前端不再自行做第二次权限推断。
3. 即便是私有事件，也应尽量沿用同一信封结构，避免再造私有协议。

## 9. 会话管理器约束

### 9.1 启动事件

`start()` 首帧广播应升级为：

1. `type = session.game_started`
2. 带完整信封字段
3. 带首帧 `publicState`

### 9.2 序号与唯一 ID

要求：

1. 每个 `sessionId` 内维护严格递增的 `seq`
2. `id` 应可由 `sessionId + seq` 稳定构造，或使用等价唯一策略
3. 不允许出现乱序复用或多事件共用一个 `id`

## 10. 回归要求

至少新增或修订以下测试覆盖：

1. `RealtimeGameEvent` 类型测试
2. `phase.changed` 携带 `publicState`
3. `player.died` 携带死亡后的玩家公开状态
4. `night.resolved` 与 `vote.resolved` 序号递增且状态一致
5. `game.over` 同时带终局 `publicState`
6. 狼队私有/个人私有事件仍按 `visibility` 正确投递

## 11. 实现锚点

1. [backend/src/game/mechanisms/session/realtime_event_types.ts](/home/hby/dev/AWA/fe_workdir/backend/src/game/mechanisms/session/realtime_event_types.ts)
2. [backend/src/game/mechanisms/session/contracts.ts](/home/hby/dev/AWA/fe_workdir/backend/src/game/mechanisms/session/contracts.ts)
3. [backend/src/game/mechanisms/session/realtime_event_registry.ts](/home/hby/dev/AWA/fe_workdir/backend/src/game/mechanisms/session/realtime_event_registry.ts)
4. [backend/src/server/v3_session_manager.ts](/home/hby/dev/AWA/fe_workdir/backend/src/server/v3_session_manager.ts)
5. [backend/src/server/view_mapper.ts](/home/hby/dev/AWA/fe_workdir/backend/src/server/view_mapper.ts)

## 12. 验收标准

1. 后端广播的 `gameEvent` 全量符合 API 文档中的增强信封结构。
2. 状态变化事件稳定携带 `publicState`，前端不再需要猜测玩家生死与阶段结果。
3. `type` 足够细粒度，前端可按类型稳定分发动画与日志。
4. `id` / `seq` / `sessionId` 可用于去重与调试。
5. 不新增任何 V2 风格 socket 兼容协议作为正式实现路径。
