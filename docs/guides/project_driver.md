# Project Driver（索引版）

## 1. 当前代码详细文档

当前项目采用“树形文档驱动”：

1. 树形根目录：
   - `docs/codebase/README.md`
2. 架构入口：
   - `docs/references/architecture.md`
3. API 入口：
   - `docs/references/api.md`
4. 后端索引：
   - `docs/guides/backend_driver.md`
5. 前端索引：
   - `docs/guides/frontend_driver.md`
6. V3 白皮书：
   - `docs/specs/README.md`
   - `docs/specs/backend_architecture_whitepaper_v3.md`
   - `docs/specs/v3_mvp_requirements.md`

文档与源码映射规则：

- 任何源码文件 `X/Y/Z.ts` 的文档路径为：`docs/codebase/X/Y/Z.ts.md`
- 任何源码目录 `X/Y` 的父文档为：`docs/codebase/X/Y/README.md`

## 2. 未来目标 TODO

- [ ] 增加“文档-源码一致性”自动校验脚本（CI）。
- [ ] 增加变更日志模板：每次代码变更同步文档摘要。
- [ ] 增加按模块的风险/优先级看板。
- [ ] 增加“白皮书条款 -> 代码文件”映射清单并持续维护。

## 3. 验收标准

- [ ] `docs/codebase` 覆盖 backend/src 与 frontend/src 全部源码文件。
- [ ] 所有节点文档包含“当前代码详细文档 / TODO / 验收标准”。
- [ ] 新增源码文件后，文档镜像路径在同一提交内补齐。
- [ ] 白皮书更新后，相关索引文档与 codebase 文档在同一提交内同步更新。
