# 白天中断组合

## 范围与所有权

本批对应 C21／C24 的白天装配切片。规则组合接收原现场读取端口，完整拥有自爆、骑士决斗、辩论三个窗口的构造，以及执行开始时的辩论重入政策。引擎运行契约显式声明三个窗口的原参数与结果，不导入 Debater 类或其 authority。

四个源码路径：

- `backend/src/game/engine/phase_pipeline/day_pipeline.ts`
- `backend/src/game/engine/daytime-interruption-contracts.ts`
- `backend/src/rulesets/daytime-interruption-composition.ts`
- `backend/tests/unit/engine/daytime-interruption-composition.test.ts`

Pipeline 保留警长调用、发言顺序、普通发言、配置短路、七个中断调用点及摘要返回。SelfDestructWindow、KnightDuelWindow、DebaterWindow 和 Debater authority 全部保持原字节；各机制仍拥有原生命捕获、库存、付款、窗口关闭及原提交回调。PhaseManager 仍拥有阶段推进、死亡链与判胜。VotingPipeline 的投票前自爆装配不在本批范围。

## 必须保留的顺序

1. Pipeline 先按原顺序从 dependencies 写入 World、RoleRegistry、Gateway、events。
2. 组合按 SelfDestruct → Knight → Debater 构造。参数读取分别为 W/R/G、W/G、W/G/E；每个 `new` 先查原构造器，然后逐参数读取，不先缓存一组 World／Gateway。
3. 三个窄端口直接指向原窗口实例，调用 `execute` 时接收者仍是该实例；不绑定方法、复制窗口或捕获演员名单。
4. 每次 `execute` 首先检查现场 World 的活动辩论，仍早于请求工厂创建、options.day／isCurrent 读取及任何 Provider 请求。`isCurrent=false` 不能绕过已开启辩论的重入拒绝。
5. 每个席位原先的存活检查、辩论 await 后的当前性／存活复查保留。辩论跳过普通发言仍执行该席位后续自爆和决斗间隙。
6. 首个读取、构造或机制错误原样传播，保留已完成的读取及机制写入前缀；组合不增加 catch、退款、阶段变化、随机调用或通用清理政策。

新增中文职责头分别解释装配所有权、窄运行契约、流水线推进及独立测试预期；重要注释说明延迟读取、窗口结果与后续结算的区别，以及辩论返回后的复查。

## 精确保持与有意差异

基线为实际 Git `54644228947ec4684b24605aca5e0b9146812cfb`；保存 before 时 Pipeline 与该 Git 字节一致。完整 Pipeline 只逆向还原明确的导入、字段、装配、最早准入和七个调用点后，2456 个强遍历节点一致，ESNext／CommonJS 两份完整运行字节一致。三个完整构造表达式、准入 if 另作精确逆向比较；修改最后 return 的非首子节点反例可被识别。四个原窗口／authority 作为字节控制。

三条 TypeScript private 字段 `selfDestructWindow`、`knightDuelWindow`、`debaterWindow` 退休，改为一个 `interruptions` 聚合字段。JavaScript 反射旧字段布局、setter 或替换旧字段来影响调度不属于保持承诺；仓内搜索只用于确认没有真实消费者，不代表仓外绝对没有使用。新聚合对象与 `assertEntry` 方法是明确接口变化。

静态加载根也有意改变：旧 Pipeline 先导入 Debater，组合现在按 SelfDestruct、Knight、Debater 组织导入。86 个实际擦除 type 后的静态 backend 模块没有反向到 DayPipeline；这不是任意动态导入或模块初始化副作用完全等价的证明。所有源码导入解析到真实文件或明确的 `bun:test` 内建声明，不新增兼容桥。

## 有界验证

| 执行范围 | 实际结果 |
| --- | --- |
| 新增 getter 顺序、第二窗口读取失败、晚 World 重入、Pipeline 最早拒绝四例 | 4 通过，0 失败，22 断言 |
| 原 Debater：目标死亡、跳过发言后狼／骑士间隙、递归 Pipeline 四例 | 4 通过，0 失败，14 断言；58 过滤 |
| 原 day interrupt：确定 hook 顺序一例 | 1 通过，0 失败，4 断言；5 过滤 |
| 四个受影响根的有限 TypeScript 检查 | 临时配置首次缺类型目录报 3 项 TS2688；补实际 backend typeRoots 后 session 17281 实际退出 0，源码未修 |
| 真实职责头与中文 presence | 四头，427 个实际文档路径，职责诊断 0；中文检测单独为 0 |

九个不同用例、40 个断言分三次执行，未合称单次测试。程序证明首版误把新 Error 也当成第四个窗口构造，导致 harness 在没有原第四项时失败；只修证明范围，未修改生产程序。导入检查首版只按物理模块查找，因此误报唯一的 `bun:test` 内建入口，随后明确记录其运行时与类型声明归属。

未执行全量类型、完整测试、整局、全量架构门禁、付费模型或新 golden。独立审查批准状态由后续 Root 汇合记录，本文件不代替独立源码审查。

完整源 SHA、基线、程序证明、导入和有限收据见 [交付证据](generated/daytime-interruption-composition-evidence.json)。这些 backend 源码属于当前引擎指纹输入；不改写历史归档身份，也不承诺旧严格 Tape 跨构建重放。
