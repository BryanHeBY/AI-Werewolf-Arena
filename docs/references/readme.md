# references 索引

## 1. 当前代码详细文档

本目录负责“查阅型”文档：

1. 架构参考：`architecture.md`
2. API 参考：`api.md`

与其他目录关系：

- 架构/规则规范：`docs/specs/readme.md`
- 开发执行入口：`docs/guides/readme.md`
- 源码细节：`backend/src`、`frontend/src`（以源码注释为准）

## 2. 开发任务清单

- [ ] `T01` 完成 `architecture.md` 的引擎时序落地任务（phase manager + hooks 调度）。
- [ ] `T02` 完成 `api.md` 的前后端事件字段对齐任务（view_mapper + frontend types）。
- [ ] `T03` 完成前端 mock 清理并切到真实后端事件流。

## 3. 验收标准（任务映射）

- [ ] `A01`（对应: `T01`） 引擎时序相关测试通过且文档链接到真实 V3 模块。
- [ ] `A02`（对应: `T02`） 事件字段在后端/前端类型中一致且联调通过。
- [ ] `A03`（对应: `T03`） 前端默认运行路径不再依赖 mock 数据引擎。
