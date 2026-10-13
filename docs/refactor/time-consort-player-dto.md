# 蚀时狼妃玩家 DTO 的公共数据 owner

本批 O2 只整理玩家知识的类型归属。现行角色名为“蚀时狼妃”；机器字段和规则版本保持不变。

## 范围与数据边界

固定修改前 Git 为 `01a69cc7094343fce4cd9b8d30d14f39e4cb66e2`。三份原生产源与实际 Git 字节相同；候选共四源：GC facts/time-consort、后端 state、PlayerObservation、一个独立编译期单元。

`PlayerTimeConsortState` 在既有公共子路径唯一声明四个原必填、可写字段：literal policy、ReflectionScope、可写 TimeConsortChoice[] history、boolean exhausted。修改前真实 TypeChecker 推断已保存，独立手写预期验证精确形状、双向赋值、观察可选值与原函数 undefined 返回；history 可替换、追加、修改可空目标，exhausted 可写。三个错误字段反例拒绝内部 triggeredDay、World、receipt。fixture 仅编译，从未执行。

后端原 getter、factory、投影和反射函数继续拥有运行行为，只给投影添加公共返回注解。PlayerObservation 从私有函数 ReturnType 推断改为公共 DTO。没有旧 DTO 声明或旧 runtime 函数退休，也没有 reexport 桥。GC 原 root wildcard 已公开该 leaf，package exports、依赖和 lock 未修改。

历史仍按 when <= day 复制每行；耗尽仍要求 triggeredDay 严格早于观察 day。函数没有新 phase 检查，数据可写不意味着真实状态写权。原严格 reader、未知值接受、反射资格、回执、生命与付款均未变。

## 有界验证

- 三生产完整程序精确逆向：3623 个 AST 节点相同；只逆新增 DTO／type import、返回注解及签名新增末逗号、Observation 类型来源，不恢复或遮蔽函数体。
- 三当前生产模块 ESNext／CommonJS 六份完整运行输出字节相同；投影完整 body 强节点相同。
- 解析 1637 份实际 JS／TS，收集 named／export／inline importType／动态 import／require 字面端点；23 个当前相关模块引用均保留真实节点与端点（含新 type 消费点，未把它们称作旧消费者）。三个运行消费者和 GC root／package／lock 六个控制与 Git 字节相同。
- 单次后台四根类型检查 session 24695，实际终态 53e936，exit 0。五个类型关系预期与三个错误字段反例均由该次编译核对；未运行 fixture。
- 四源职责头实际 checkComments 0，中文头另行 4/4。独立审查建议的“玩家名单”和“观察日”措辞仅注释精准修改，未重复类型／输出检查。

首、第二次逆向报告保留：参数签名新增末逗号尚未逆导致多一个节点；第二次改为显式 ColonToken 范围，实测与初范围相同。最终仅修证明脚本的精确签名逆，未修改生产来迁就证明。

本批没有运行旧测试、整局、模型、全量类型或全量架构门禁，不宣称整个系统验收。源注释变动如实计入最终 source SHA；历史档案和身份不重写。

## 持久证据

[汇总](generated/time-consort-player-dto-evidence.json) 包含四源 SHA、完整程序与实际终态；[修改前](generated/time-consort-player-dto-before.json) 保留真实 Git 源码和原推断；[冻结](generated/time-consort-player-dto-scope-final.json)、[原失败](generated/time-consort-player-dto-program-proof-first.json)、[证明脚本](generated/time-consort-player-dto-proof-harness.cjs) 与 [注释 delta](generated/time-consort-player-dto-comment-delta.json) 可独立复核。
