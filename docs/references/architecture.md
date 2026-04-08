# 架构文档（树形拆分入口）

## 1. 当前代码详细文档

架构说明已按代码树拆分，主阅读路径：

- V3 后端架构总规范（Source of Truth）：`docs/specs/backend_architecture_whitepaper_v3.md`
- V3 MVP 实现要求（当前迭代执行清单）：`docs/specs/v3_mvp_requirements.md`
- 总索引：`docs/codebase/README.md`
- 后端架构主线：`docs/codebase/backend/src/core/README.md`
- 前端架构主线：`docs/codebase/frontend/src/composables/README.md`
- 引擎核心：`docs/codebase/backend/src/core/GameEngineV2.ts.md`
- 状态中枢：`docs/codebase/backend/src/core/Environment.ts.md`
- 前端状态中枢：`docs/codebase/frontend/src/composables/useGameStore.ts.md`

## 2. 未来目标 TODO

- [ ] 将后端白皮书条款逐条映射到 `docs/codebase/backend/src/*` 文件级文档。
- [ ] 在树形文档中补充“模块间时序图”（开局、夜晚、白天、结算）。
- [ ] 增加“遗留模块清理清单”（frontend 遗留组件、旧 mock 逻辑）。

## 3. 验收标准

- [ ] 架构入口文档能指向白皮书与完整树形细节文档。
- [ ] 核心模块变更后，入口链接与子文档均同步更新。
- [ ] 新成员可仅凭 docs/codebase 理解系统边界与调用链。
