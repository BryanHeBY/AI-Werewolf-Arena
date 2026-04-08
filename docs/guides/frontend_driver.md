# Frontend Driver（索引版）

## 1. 当前代码详细文档

前端详细文档已拆分为树形结构（按源码路径镜像）：

1. 总入口：
   - `docs/codebase/frontend/README.md`
2. 主链路：
   - `docs/codebase/frontend/src/App.vue.md`
   - `docs/codebase/frontend/src/composables/useGameStore.ts.md`
   - `docs/codebase/frontend/src/composables/useWebSocket.ts.md`
3. 组件层：
   - `docs/codebase/frontend/src/components/README.md`
4. 类型与工具：
   - `docs/codebase/frontend/src/types/index.ts.md`
   - `docs/codebase/frontend/src/lib/utils.ts.md`

## 2. 未来目标 TODO

- [ ] 为 `docs/codebase/frontend/src/*` 目录 README 增加 UI 状态流图。
- [ ] 在遗留文件文档中增加“是否保留/何时删除”决策字段。
- [ ] 增加前后端类型对齐检查清单（字段、可选性、枚举值）。

## 3. 验收标准

- [ ] frontend/src 每个源码文件都存在 `docs/codebase/frontend/src/<file>.md`。
- [ ] 每个目录节点都有 `README.md` 且父子导航无断链。
- [ ] 前端代码改动时，对应 codebase 文档同提交更新。
