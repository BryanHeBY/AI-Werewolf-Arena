# Project Driver（索引版）

## 1. 当前代码详细文档

当前项目采用“源码 + 前导文档驱动”：

1. 源码根目录：
   - `backend/src`
   - `frontend/src`
2. 架构入口：
   - `docs/references/architecture.md`
3. API 入口：
   - `docs/references/api.md`
4. 后端索引：
   - `docs/guides/drivers/backend_driver.md`
5. 前端索引：
   - `docs/guides/drivers/frontend_driver.md`
6. 活动驱动：
   - `docs/guides/activities/development_activity_driver.md`
   - `docs/guides/activities/testing_activity_driver.md`
   - `docs/guides/activities/review_release_activity_driver.md`
7. 后端重构作战包：
   - `docs/guides/backend_rebuild/readme.md`
8. V3 白皮书：
   - `docs/specs/readme.md`
   - `docs/specs/backend_architecture_whitepaper_v3.md`
   - `docs/specs/v3_mvp_requirements.md`

文档与源码映射规则：

- 任何源码文件 `X/Y/Z.ts` 的职责说明写在源码文件头中文注释。
- 任务拆解与验收标准统一写在 `docs/guides/**` 与 `docs/specs/**`。

## 2. 开发任务清单

- [x] `T01` 完成后端 P5 机制开发（狼队战术环 + 白天中断钩子）。
- [x] `T02` 完成后端 P6 机制开发（警长竞选、警徽流转、1.5 票权）。
- [x] `T03` 完成后端 P7 机制开发（记忆压缩、复杂规则冲突结算）。
- [x] `T04` 将 P5~P7 对应测试补齐到 `backend/tests/v3/*` 并接入回归。
- [x] `T05` 完成引擎开关、依赖边界规则与本地阻断能力。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） P5 功能在回放测试中稳定通过且不破坏现有 MVP 用例。
- [x] `A02`（对应: `T02`） P6 票权与竞选规则在自动化测试中可复现。
- [x] `A03`（对应: `T03`） P7 压缩策略在 12 人局第 3 天后仍保持流程稳定。
- [x] `A04`（对应: `T04`） 新增测试均纳入 `test:quick/test:full` 并通过。
- [x] `A05`（对应: `T05`） 本地预检命令可自动阻断依赖逆向引用与关键回归失败。
