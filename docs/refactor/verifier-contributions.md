# C37 独立机制审计装配交付

来源为实际 Git `d5a71042`，24 个源码／测试路径冻结摘要与审查见 [固定证据](generated/verifier-contributions-evidence.json)。

## 实际职责

`parseReproductionRecord` 保留原版本检查和严格 schema 准入，然后调用 `verification/reproduction/assembly.ts`。装配按原顺序显式执行全部 16 个既有审计，不先捕获函数数组。贵族审计结果在原位置传给恶魔；恶魔内部原 RedMoon／原生库存子链保持。

初始身份、野孩子、孤独少女的三个完整算法从 parser 移到独立 owner。原 13 个外部算法仍完整执行，目录迁移留待后续。18 个实际算法／helper 的枚举 import 改用原同对象的公共契约；独立审查发现的 Magician 间接重 barrel 已一并退出。

## 约束与顺序

审计只重建归档纯数据，不查询 World、运行时权限、生产伤害／死亡结算或 checkpoint 写方。原 schema2、版本准入、字段／键序、失败原因和第一拒绝均保持。运行时依赖图包含 136 个内部模块和 313 条边，无法解析与禁层依赖均为 0；域内剩余内容仅为纯数据读器／同枚举薄出口。外部 Node／Zod 不递归，静态图不被当作任意 JavaScript 纯度证明。

19 个原输入逐实际 Git 核对；三个完整算法除 export 外全文保持；18 个 helper 非 import 程序保持。把真实装配及三算法内联回 parser 后，完整非 import ESNext／CommonJS 程序与原源相同，16 步顺序和贵族 audit 同一引用另作核对。

## 有限验收与交叉审查

- 新单元测试：`4 pass / 0 fail / 9 assertions`；手写合法归档、实际 parser 入链、第一拒绝、版本／schema 前置拒绝。
- 原有 Animal 有界用例：`3 pass / 0 fail / 3 assertions`，原输入／断言保持。
- 首次有限严格类型检查 session `2829` 实际退出 `0`；Magician helper 单独增量 session `28711` 实际退出 `0`。空日志仅代表无诊断，退出状态来自作者实际终态收据。
- Root 阅读实际装配、准入和测试；第三方向先审算法与真实 Git 来源，再终审 24 SHA、helper、同对象出口及图边界，均无待修项。第三方向未重复运行测试／编译／完整图遍历。
- 24 个文件职责头为中文。现存内部英文注释另作纯注释翻译，保留本批冻结证明。

测试中的 metadata getter 只观察首次 metadata 访问顺序；它不证明所有函数入口。完整 16 调用顺序由独立程序核对提供。

## 未完范围

本批交付全部既有 16 审计装配与三个算法所有权，不能据此宣称全 55 角色语义覆盖、所有审计目录迁移、C39 或 P7 完成。未运行整局、全量门禁、模型或网络。
