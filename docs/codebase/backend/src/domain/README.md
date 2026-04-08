# backend/src/domain 文档索引

## 1. 当前代码详细文档

- 节点路径：`backend/src/domain`
- 目录职责：V3 ECS 域层（模型、组件、系统、世界）。
- 上级节点：[backend/src](../README.md)
- 关联规范：`docs/specs/backend_architecture_whitepaper_v3.md`、`docs/specs/v3_mvp_requirements.md`

### 子目录
- [backend/src/domain/components](./components/README.md)
- [backend/src/domain/entities](./entities/README.md)
- [backend/src/domain/registries](./registries/README.md)
- [backend/src/domain/systems](./systems/README.md)

### 子文件
- [model.ts](./model.ts.md)
- [world.ts](./world.ts.md)

## 2. 未来目标 TODO

- [ ] 建立组件/系统矩阵，覆盖 MVP 所有规则印记与结算。
- [ ] 为目录下每个文件维护“导出项 + 依赖项 + 测试覆盖”状态。
- [ ] 代码改动后同步更新本目录导航与职责说明。

## 3. 验收标准

- [ ] 子目录/子文件导航与真实源码结构一致。
- [ ] 目录职责可帮助开发者快速定位改动入口。
- [ ] 本目录引用的规范链接有效且与当前阶段目标一致。
