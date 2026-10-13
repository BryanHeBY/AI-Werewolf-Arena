# 定序王子与鬼魂新娘玩家知识类型

本批 O2 将两组已存在的数据结构归公共契约，不改重投或婚礼玩法。现行目录与规则卡的名称是“定序王子”和“鬼魂新娘”。

## 精确范围

修改前为实际 Git `d589dfbdb79797d2afcfd9c18d7efe60b5675328`，六旧源全与 Git 字节相同。候选七源：GC 的 facts/order-prince 和 facts/ghost-bride；定序王子 state／authority；鬼魂新娘 authority；PlayerObservation；一个编译期单元。

原 OrderPrinceChoice、OrderPrinceState 与 WeddingActorView 完整纯声明迁入既有 GC fact leaf。当前 GC role-state-data 原本没有 OrderPrinceState，故不是删除已有重复。Order policy 从原 backend const 的 typeof 改成其完全相同的 literal 类型；原运行常量保留原位置。Wedding 的 Camp.ThirdParty 仍来自同一个公共 enum，只新增 type import，不引入值加载边。

Order history 和每行可写。Wedding 原两联合分支、可写字段、nullable witnessId、optional proposedWitnessId 完整保留，不把见证人变成伴侣或扩大知识。canKnife 是捕获时的知识，不等于当前提交许可。没有公开 live 状态／World、原生命或回执句柄。

两个旧叶的三公开 type 出口真实退休；原一个 named 类型消费者与 Observation 两个 inline 类型消费者直接指向 GC。原运行 getter、factory、projection、婚礼权威与全部值调用仍在原 owner，未造兼容桥。GC root 原有 wildcard 已承接类型，package、依赖与 lock 不改。

## 程序与有界验证

- 六完整程序 21996 节点，精确逆已列纯声明／类型导入／来源／中文注释后相同；修改区域外原全文字节相同。删除声明只用唯一真实后置 anchor 放回其声明，不恢复旧整个 body。
- 十二份当前完整 ESNext／CommonJS 输出字节同。另独立比较所有当前实际原函数／箭头：134 个完整函数 AST 相同。
- 三完整声明 156 节点相同，其中 OrderState 只规范化原 const 的 literal 类型。
- 实际解析 1645 份源，收集 69 个相关模块端点（含当前新增 type／故意负例，非69个类型消费者）；覆盖 named／namespace、export／star、inline importType、动态 import／require，按相对路径解析。七个实际命名引用的符号全部归 GC canonical declarations；六个运行／package 控制与 Git 同。
- 七根首类型 session66918／6826df实际 exit2，仅新 fixture 三诊断；纯注释修正 directive 后，仅失败单元 root session48127／58ee61实际 exit0。六生产根没有重复编译。独立手写预期核对十一类型关系、三旧声明出口及五错误字段；可写／nullable／optional 正例保留。fixture 从未执行。
- 七源职责头实际 checkComments 0，中文头另 7/7；Order 原状态／下一状态、婚礼知识、pending 提交前缀的中文说明就地补充。

首证明脚本在空串删除逆向时拒绝，真实失败保存；修成声明后的唯一实际 anchor 后通过。该工具失败不是业务行为失败。

本批不跑旧测试、整局、模型、全量类型或门禁；不宣称全部观察私有类型退出。Eclipse／WallNote 保留下一独立范围。公共 shape 不新增 parser、默认策略、接收政策或规则。

## 持久证据

[汇总](generated/order-wedding-player-types-evidence.json)、[原源码](generated/order-wedding-player-types-before.json)、[精确编辑](generated/order-wedding-player-types-edits.json)、[完整程序](generated/order-wedding-player-types-program-proof.json)、[类型终态](generated/order-wedding-player-types-type-receipts.json)、[冻结 SHA](generated/order-wedding-player-types-scope-final.json) 均已保存。独立源审后由 Root 按功能提交。
