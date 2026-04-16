# Backend 架构边界约束

## 目录分层
- `backend/src/core`: 领域模型与基础组件（最内层）
- `backend/src/game`: 对局流程编排与机制实现
- `backend/src/ai`: LLM/Agent 与记忆能力
- `backend/src/runtime`: 运行脚本与回放入口
- `backend/src/server`: API/Socket 会话服务
- `backend/src/observability`: 记录、日志与调试快照

## 依赖方向
- 允许：`core -> (none)`
- 允许：`game -> core`
- 允许：`ai -> core | game`
- 允许：`runtime/server/observability -> core | game | ai`
- 禁止：`core -> game/ai/runtime/server/observability`

## 自动检查
- 命令：`npm -C backend run lint:boundaries`
- 检查范围：`backend/src/core/**/*.ts`
- 若发现 `core` 通过相对路径导入外层模块，命令会失败并给出文件定位。
