# docs 总览

## 1. 当前代码详细文档

当前 `docs/` 目录重构为四层：

1. `guides/`：开发驱动与分端入口
   - `docs/guides/README.md`
2. `references/`：架构/API 参考文档
   - `docs/references/README.md`
3. `specs/`：V3 白皮书与 MVP 规范
   - `docs/specs/README.md`
4. `codebase/`：按源码镜像拆分的文件级文档
   - `docs/codebase/README.md`

推荐阅读顺序：

1. `docs/specs/backend_architecture_whitepaper_v3.md`
2. `docs/specs/v3_mvp_requirements.md`
3. `docs/guides/project_driver.md`
4. `docs/codebase/backend/src/README.md` 与 `docs/codebase/frontend/src/README.md`

## 2. 未来目标 TODO

- [ ] 为 `guides/` 和 `references/` 增加自动化目录索引生成脚本。
- [ ] 增加“文档阅读画像”：按角色（后端/前端/测试）给出最短路径。
- [ ] 建立 docs 链接校验与章节校验 CI。
- [ ] 增加“规范条款 -> 代码目录”追踪矩阵。

## 3. 验收标准

- [ ] `docs/` 下所有文件名均为小写。
- [ ] 目录结构稳定为 `guides/references/specs/codebase` 四层入口。
- [ ] 所有文档保留三段结构并可被直接用于开发驱动。
- [ ] 入口文档到子文档的跳转路径无断链。
