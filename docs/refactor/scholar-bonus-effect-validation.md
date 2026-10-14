# 学者／导师已付加成效果的复验归属

## 七源完整职责

实际基线 `c9e7a3c876a532c880308edb9b8cb71a9773c88b`。五个原源与两个新源：NightPipeline、本族 night_stages／ports、night-damage-composition、原记录单元、新 bonus-effect-validation 及新规则短路单元。没有改 PM、动物票账本、资源 frame 或记录数组 owner。

完整原 `assertScholarMentorBonusEffects` 从阶段实现收归本族复验 owner；本族加成阶段、公开端口与三个规则检查点调用同一函数。本族阶段出口退休，原单元迁 public ports，规则组合不再导入 stage 实现。

三个相同的配置门控归具名 `assertNightModifierBonusEffects`：原阶段 await 前后各一次，以及原黎明伤害组合一次。经理／流水线的调用位置与 await 未移动，未把此复验合入其它名单检查或添加新时钟。

复验仍先取 `ctx.world` 检查名单，再取 `ctx.state` 查询同一记录。每条先读 receipt.target，再调用原 effectCurrent receiver，之后按原短路核目标生命／版本与 marks。原 marks 多次 getter、World 现场读取与第一错误保持；不 commit、付款、清空数组、关闭或回滚。记录和已付效果不是同一个生命周期，DTO／同形目标不能替代原运行引用。

新门控先读配置，只有原 truthy scholarMentor 才取原 stageContext。NP 以惰性查询提供原局部 config／stageCtx，伤害组合直接传既有 runtime；不缓存字段或额外读取已结束的上下文。

中文职责头、具名公共口及关键状态／失败说明沿实际代码补充。输入仍使用原上下文类型，没有新增权限品牌、万能基类或效果总线。

## 实际验收及新夹具修复

新两字面短路风险 `a84116` 首次 2 pass／0 fail／3 断言；原记录精准标题 `effect recheck keeps target then callback then life and marks reads and never commits a receipt` 在 `503d35` 为 1 pass／0 fail／8 断言，2 filtered。原回执／生命／marks 轨迹、状态身份隔离和不付款预期保持。

七根有限类型 `90e4ab/session96831 → 1630ec` 实际退出 2，唯一诊断是新单元用错了政策字面量：v1 应为真实契约 twelve_v1。没有改生产。夹具修复保存完整原文：改为实际标识并用 satisfies 验证，不称纯类型变化，因为输入确有一字段改变。

仅修改夹具的成功路径用例复查 `2230b8` 为 1／0／2，另 1 filtered；其它未变绿色不重复。失败 unit 一根 `ae3e6e/session74236 → 3ba78d` 实际退出 0，其余六根首查无诊断。共三个不同成功用例、11 个不同断言；实际执行累计 13 断言，重复两条不计新覆盖。

原七职责头 `e4053c` 实际退出 0：589 个当时 Git 文档，诊断／中文头缺失零。该头检查及生产完整证明采样后，新单元的夹具标识变化，随后还有下述一处纯类型导入清理；不伪称旧报告取得最终字节，也不重复头、证明或其它类型根。

## 完整程序与边界

`412f72` 实际退出 0：五原程序按 14 处完整接线片段正逆到真实 Git，5,016 个非 JSDoc 语法节点、10 个完整 ESNext／CJS 映射输出相同。原复验函数完整语法、原伤害组合门控以及两 NP 门控独立核对，非只恢复旧文件忽略新 owner。原 frame 与 bonus-effect-records 两个控制源完整 Git／当前字节相同。

新模块、具名规则函数、查询闭包、公共出口及 stage 私有路径退休改变 API／加载和调用栈；完整映射不声称当前 raw 二进制、任意命名空间重绑定或整个冷启动图相同。结构与独立字面轨迹相互补足，不拿生产算法生成游戏 oracle。

新增源码／路径／注释参与真实 sourceHash，严格档案格式、指纹算法及历史身份不变。没有全量门禁、完整矩阵、模型或游戏规则改变，不宣称全部已付效果、C24/C28 或 P9 完成。完整范围、首类型失败及夹具修复收据交非作者复核后按功能提交。

## 独审后的纯类型收口

非作者完整业务审查发现，复验函数迁出后，night_stages 原类型导入中的 NightStageContext 已无消费者。只删除这个类型说明符，保留 NightStageHandler；没有顺带处理原有其它未消费导入。

`aba892` 实际退出 0，保存了清理前完整 stage 文本并核唯一精确逆变换。完整 ESNext／CommonJS 两个原始输出分别保持，承接先前程序证明的采样字节；没有改生产运行语句或测试夹具，没有重复任何已通过检查。末冻结范围与证据明确绑定此两份增量附件，不将原 proof／head／type 收据改写为新执行。
