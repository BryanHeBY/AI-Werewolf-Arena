# backend/src/core 文档索引

## 1. 当前代码详细文档

- 节点路径：`backend/src/core`
- 目录职责：核心状态机与阶段流转实现，负责游戏主循环与结算。
- 上级节点：[backend/src](../README.md)
- 关联规范：`docs/specs/backend_architecture_whitepaper_v3.md`、`docs/specs/v3_mvp_requirements.md`

### 子目录
- 无

### 子文件
- [Environment.ts](./Environment.ts.md)
- [EventBus.ts](./EventBus.ts.md)
- [GameEngineV2.ts](./GameEngineV2.ts.md)
- [GameFactoryV2.ts](./GameFactoryV2.ts.md)
- [PhaseStackEngine.ts](./PhaseStackEngine.ts.md)
- [ViewSanitizer.ts](./ViewSanitizer.ts.md)
- [types.ts](./types.ts.md)

## 2. 未来目标 TODO

- [ ] 建立完整阶段时序文档并与代码实现逐条对齐。
- [ ] 为目录下每个文件维护“导出项 + 依赖项 + 测试覆盖”状态。
- [ ] 代码改动后同步更新本目录导航与职责说明。

## 3. 验收标准

- [ ] 子目录/子文件导航与真实源码结构一致。
- [ ] 目录职责可帮助开发者快速定位改动入口。
- [ ] 本目录引用的规范链接有效且与当前阶段目标一致。
