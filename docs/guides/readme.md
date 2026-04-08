# guides 索引

## 1. 当前代码详细文档

本目录负责“如何开展开发”的驱动型文档：

1. 模块驱动索引：`drivers/readme.md`
2. 活动驱动索引：`activities/readme.md`
3. 后端重构作战包：`backend_rebuild/readme.md`

核心文档直达：

1. 项目总驱动：`drivers/project_driver.md`
2. 后端驱动：`drivers/backend_driver.md`
3. 前端驱动：`drivers/frontend_driver.md`
4. 开发活动驱动：`activities/development_activity_driver.md`
5. 测试活动驱动：`activities/testing_activity_driver.md`
6. 评审与发布活动驱动：`activities/review_release_activity_driver.md`

与其他目录关系：

- 规范来源：`docs/specs/readme.md`
- 结构参考：`docs/references/readme.md`
- 代码细节：`docs/codebase/README.md`

## 2. 未来目标 TODO

- [x] 为每个 activity driver 增加“执行状态”区块（进行中/阻塞/完成）。
- [x] 增加“从需求到代码到测试”的标准执行模板。
- [x] 将 driver 文档与 issue/PR 模板进行字段映射。
- [x] 将 `backend_rebuild/*` 任务状态同步到 `drivers/backend_driver.md`。
- [x] 在 `drivers/readme.md` 与 `activities/readme.md` 增加自动汇总区块。

## 3. 验收标准

- [x] 项目、后端、前端、开发、测试、评审发布六类驱动文档齐全。
- [x] 每个驱动文档均能跳转到对应 `docs/codebase` 与 `docs/specs` 节点。
- [x] 团队可仅凭本目录完成开发与测试活动的执行与追踪。
- [x] 后端重构前可仅凭本目录定位到完整的作战文档包。
- [x] guides 结构满足“总览 -> 分索引 -> 具体文档”三级导航。
