# 游戏侧预检的角色公开边界

`ActionReception` 的完整规则预检迁往游戏侧时，不能依靠目录变化使具体角色内部依赖不再被检查。本批在既有依赖检查器增加明确 `dependency.gateway-feature` 规则：`backend/src/game/gateway/` 对具体机制只消费 `contracts` 或 `ports`，值导入与 `import()` 类型查询都受约束。

新单元测试使用两张独立手写源码图：内部 authority／state 的两个依赖均拒绝，公开 ports／contracts 的对应依赖通过。实际有限结果 `1 pass / 0 fail / 2 assertions`，其余 36 项没有重复运行。两个工具源码的严格有限类型检查自然退出 `0`。

实际读取固定基线 `27a97cb` 的全部三个 gateway 文件及导入后，确认新增分类不对应其既有角色内部依赖；没有改写原 1779 项债务或给新迁移增加豁免。当前其他目录、旧包出口及原依赖规则保持。完整去除新增一个规则分支和一个测试后，两文件旧 ESNext／CommonJS 运行代码字节相同。

该规则只验证直接依赖的公开模块边界，不证明端口实现权限正确、不清零其他耦合，也不是重跑全仓架构检查。真实预检算法、第一使用 schema 缓存、请求许可及失败顺序由另一个完整职责迁移批验证。中文注释解释这一目录和消费约束；固定摘要、有限收据及审查见 [证据](generated/gateway-feature-boundary-evidence.json)。
