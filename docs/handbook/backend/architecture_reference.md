# 架构参考（查阅）

本文档提供代码树入口与阅读路线，不承载执行 TODO。

## 核心规范入口

1. 后端架构总规范：`docs/specs/backend/foundation/architecture/backend_architecture_whitepaper_v3.md`
2. MVP 实现规范：`docs/specs/backend/evolution/architecture/v3_mvp_requirements.md`
3. 技术白皮书：`docs/specs/backend/foundation/architecture/technical_whitepaper_v3.md`

## 代码阅读主线

1. 引擎主线：`backend/src/game/engine/*`
2. 领域主线：`backend/src/core/domain/*`
3. 机制主线：`backend/src/game/mechanisms/*`
4. 会话与服务：`backend/src/server/*`
5. 前端复盘主线：`frontend/src/replay/*` 与 `packages/replay-contract/*`

## 开发驱动

执行任务请使用：`docs/drivers/backend/foundation/architecture/reference_architecture_driver.md`
