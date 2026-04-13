# Backend 目录重构（第九阶段）

## 目标
- 将传输实现与观测日志从 `infra` 继续归位到对应业务域。
- 将实时事件类型从传输实现中解耦，避免机制层依赖具体 broadcaster 实现。

## 本阶段范围
1. 物理迁移
   - `src/infra/transport/broadcaster.ts -> src/server/transport/broadcaster.ts`
   - `src/infra/transport/socket_server.ts -> src/server/transport/socket_server.ts`
   - `src/infra/logger/game_logger.ts -> src/observability/logger/game_logger.ts`
2. 类型解耦
   - 新增 `src/game/mechanisms/session/realtime_event_types.ts`
   - `game` 侧统一依赖该类型文件，不再从 broadcaster 导入类型
3. 导入修复与验证

## 验收标准
- `npm -C backend run build:v3`
- `npm -C backend run run:v3:mock`
- `src/infra` 目录可删除或保持为空
