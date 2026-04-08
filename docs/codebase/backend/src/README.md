# backend/src 文档索引

## 1. 当前代码详细文档

- 节点路径：`backend/src`
- 目录职责：后端主代码目录，承载引擎、ECS、服务、LLM 与日志模块。
- 上级节点：[backend](../README.md)
- 关联规范：`docs/specs/backend_architecture_whitepaper_v3.md`、`docs/specs/v3_mvp_requirements.md`

### 子目录
- [backend/src/agent](./agent/README.md)
- [backend/src/app](./app/README.md)
- [backend/src/broadcaster](./broadcaster/README.md)
- [backend/src/config](./config/README.md)
- [backend/src/core](./core/README.md)
- [backend/src/domain](./domain/README.md)
- [backend/src/ecs](./ecs/README.md)
- [backend/src/engine](./engine/README.md)
- [backend/src/gateway](./gateway/README.md)
- [backend/src/infra](./infra/README.md)
- [backend/src/llm](./llm/README.md)
- [backend/src/logger](./logger/README.md)
- [backend/src/memory](./memory/README.md)
- [backend/src/scenarios](./scenarios/README.md)
- [backend/src/server](./server/README.md)
- [backend/src/v3](./v3/README.md)

### 子文件
- [index.ts](./index.ts.md)
- [run-test-v2.ts](./run-test-v2.ts.md)
- [run-test-v3.ts](./run-test-v3.ts.md)

## 2. 未来目标 TODO

- [ ] 按目录职责补齐关键流程图与风险说明。
- [ ] 为目录下每个文件维护“导出项 + 依赖项 + 测试覆盖”状态。
- [ ] 代码改动后同步更新本目录导航与职责说明。

## 3. 验收标准

- [ ] 子目录/子文件导航与真实源码结构一致。
- [ ] 目录职责可帮助开发者快速定位改动入口。
- [ ] 本目录引用的规范链接有效且与当前阶段目标一致。
