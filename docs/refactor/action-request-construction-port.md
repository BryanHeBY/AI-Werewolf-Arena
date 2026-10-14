# 行动请求构造的中立类型端口

## 本批实际范围

实际基线 `4ddf9ba95468b2550269bdf87f3356947a6469ff`。复用 `core/domain/actions.ts`，它已有 ActionProvider 中立运行端口；增加唯一 `ActionRequestConstructionInput` 与只含 `create` 的 `ActionRequestConstructionPort`。工厂明确实现该端口，原八字段输入类型完整迁出，不复制实现或增加框架。原 model/domain 的已有重导使类型公开，无需增加新的 barrel 或运行模块。

六源码：领域 actions、GameActionRequestFactory，以及匿名墙、辩论、秘密之身翻牌、定序王子四个纯类型消费者。它们只改类型来源／注释。原 create 方法体、请求对象、字段读取次数、方法 receiver、复制／绑定顺序、约束和权限皆不变；不提前读取 World、阶段或原请求字段。

原字段按原顺序保持 `phase / actorId / allowedTools / stage / requiresAction / summary / actionWindow / context`；仅最后两个可选，工具数组仍可写，summary 仍接受 string 或 MessageRef，附加信息仍同 ActionRequestExtras。端口只是原同步方法的类型，不是请求 schema、实例、深复制、序列化租约或行动许可。

Wall／Debater／Order 三处原参数是含 private 成员的名义工厂类型，本批改为仅 create 的结构端口，明确扩大编译接受形状。Noble 原来已经是 `Pick<GameActionRequestFactory,"create">`，只改唯一命名 owner、形状保持。原公开 factory/class 仍存在，没有退休其运行 API；新增端口不绑定／缓存方法，不改变实际调用 receiver。

## 精确证据与中文维护

- 六 actual Git before 和完整当前程序精确类型／注释逆同；共 7,518 非注释 token 树节点、4,988 叶。当前实际六程序的十二份完整 ESNext／CJS 输出与原完全相同，运行调用与静态值初始化没有改变。
- 原八 member 与当前唯一声明的完整成员同：包在同一接口比较为 65 节点／42 叶；可选性与可写性不是通过空 JS 证明。七个原输入 type bindings 沿实际 named／star重导解到同一物理 owner，包括 EntityId 经 core.identity 返回原 GC identity，没有第二套枚举或声明。
- 当前机制目录 386 个源码全形式盘点，含 named／namespace／star／dynamic／require／ImportType 节点与已有引擎 barrel。六 owned before 精确逆与未改消费者结合，原16个工厂引用变为12个实际 new 的消费者和4个纯type端口引用；此范围没有非字面 loader。不同签名的 NightStageContext.makeRequest 不强行统一。
- 有限六 roots 类型首次 session7464→3f43ed 实际0，无失败或绿色根重复。此纯类型组织没有新增镜像单元／运行测试、模型或全量门禁。原检查配置保 backend 实际环境，不将FE额外规则套入。
- 原职责头检查六根／531实际文档路径 0，中文头存在性另为0。领域 actions 原英文头、辩论头与三条并发／复验／同步结算说明译为中文；定序王子补实际输入／输出、已提交失败前缀及finally关闭头。新数据说明解释数组可写、requiresAction只是原约束输入、context复制与权限分离。

首两次证明工具分别因空after import逆和Noble广类型名逆失败；均保原日志，只改harness／精确字段edit record，没有修改产品以迎合证明。末工具真实0。同行提醒 nominal／structural 区分后，只校准证明 limit 与本说明，原算法／输出不重跑，执行版SHA与当前措辞版分别登记。类型检查进行期间的一处首头英文短语中文化不改类型，最终源码、完整证明及头在末文字阶段采样；不推断编译器精确读文件时点。

## 仍未完成的边界

十二个机制仍真实 `new GameActionRequestFactory`：初始身份、雾鸦蛇窗口、动物河豚、野孩子、孤独少女、鬼魂新娘、猎魔人三种控制器及警长三种窗口。完整路径与真实构造表达式见证据 inventory；它们属于后续实际装配职责，不能只改 import 或给类型换名就宣称退出。`NightStageContext.makeRequest`、其它引擎本身参数和 PM／DR／Voting 均未改。Magician15 与 Root exile-ports／Voting 公开facet是独立并行批次，不计入本次程序等价范围。

本批没有声明所有 Features→Engine 已消除、全中文或最终架构验收完成。源码注释影响新构建sourceHash；历史档案身份不改。[范围](generated/action-request-construction-port-scope-final.json) · [完整原程序与输入／消费证据](generated/action-request-construction-port-proof.json) · [实际收据](generated/action-request-construction-port-receipts.json)。

最后按当前目录校准正式名称：定序王子、鬼魂新娘、猎魔人。只定序王子的新职责头有一词comment更正，其余两个仅本说明名单；精确全字节单comment逆连接原proof／类型／头阶段，未重跑原绿。
