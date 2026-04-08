# docs 总览

## 1. 当前代码详细文档

当前 `docs/` 目录重构为四层：

1. `guides/`：开发驱动与分端入口
   - `docs/guides/readme.md`
   - `docs/guides/drivers/readme.md`
   - `docs/guides/activities/readme.md`
   - `docs/guides/backend_rebuild/readme.md`
2. `references/`：架构/API 参考文档
   - `docs/references/readme.md`
3. `specs/`：V3 白皮书与 MVP 规范
   - `docs/specs/readme.md`
4. `codebase/`：按源码镜像拆分的文件级文档
   - `docs/codebase/README.md`

推荐阅读顺序：

1. `docs/specs/backend_architecture_whitepaper_v3.md`
2. `docs/specs/v3_mvp_requirements.md`
3. `docs/guides/backend_rebuild/readme.md`
4. `docs/guides/drivers/project_driver.md`
5. `docs/codebase/backend/src/README.md` 与 `docs/codebase/frontend/src/README.md`

当前推进状态（2026-04-08）：

1. V3 后端已完成 P1-P3 基线开发与自动化验证。
2. `docs/codebase` 已重建并覆盖新增 V3 源码目录。
3. 当前未完成项聚焦 P4：通信协议联调、灰度切换与回滚演练。

## 2. 未来目标 TODO

- [ ] 为 `guides/` 和 `references/` 增加自动化目录索引生成脚本。
- [ ] 增加“文档阅读画像”：按角色（后端/前端/测试）给出最短路径。
- [ ] 建立 docs 链接校验与章节校验 CI。
- [ ] 增加“规范条款 -> 代码目录”追踪矩阵。
- [ ] 增加“后端重构推进看板”入口并动态展示阶段状态。

## 3. 验收标准

- [ ] `docs/` 文件命名遵循统一规则：常规文档小写，`docs/codebase` 镜像文档与源码同名同大小写。
- [ ] 目录结构稳定为 `guides/references/specs/codebase` 四层入口。
- [ ] 所有文档保留三段结构并可被直接用于开发驱动。
- [ ] 入口文档到子文档的跳转路径无断链。
- [ ] 重构前置文档可直接驱动后端从 P0 推进到 P4，无需额外规划文档。
