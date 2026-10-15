# 诡术师独立归档验证归属

## 范围

基线为真实 Git `173ef9df85b47c7327328d2c135f79294e417e6d`，即已提交的魔术师验证迁移之后。此批四源码路径：

| 路径 | 操作 |
| --- | --- |
| `backend/src/recording/trickster_record.ts` | 删除旧验证叶，不保留桥 |
| `backend/src/verification/reproduction/trickster/validate.ts` | 新的完整独立验证所有者 |
| `backend/src/verification/reproduction/assembly.ts` | 仅改诡术师 import 路径 |
| `backend/tests/scenarios/boards/trickster/reproduction.test.ts` | 仅改路径与角色名职责头 |

原文件不负责录制或落盘：它从完整归档独立推导夜间换位、号码消费历史、放逐映射、私有事实可见性和 checkpoint 前缀，并在原第一失败位置抛出 `reproduction_trickster_invalid`。全部算法与内部 `check`／`equal` helper 一起迁移，不分空壳或复用生产结算作为 oracle。

原 `ReproductionRecord` 保持 type-only 指向唯一 `recording/reproduction` 所有者。独立有限板子判断仍由原 `verification/board-support` 提供；枚举及事实读器仍为中立契约的同一实体。不加载 World、生产结算或实际库存写方，不改变归档版本／信任／准入政策。

## 消费与中文说明

全仓真实查找只有装配入口与诡术师场景两个 named import 消费者；没有旧模块重导、namespace、动态或包入口消费。装配 unit 中的 `validateTricksterRecord` 只是原调用次序预期字符串，保持原样。历史 generated 证据里的旧路径与指纹不改。

共四处路径编辑：新叶的板子判断、type-only 记录类型，以及两个消费者。另有五项精确注释编辑：

1. 原头“枪击证据”改为实际“换位、放逐映射、私有可见性与 checkpoint 历史”。原完整程序没有独立枪击审核分支，本族有限板子也没有猎人／狼王。
2. 在号码累计处说明：仅从提交事实重建原已消费号码；后续与魔术师相同配对的抵消不退还这些号码，不修改真实库存。
3. 在每事件保存处说明：初始零项与每事件处理后的历史／存活前缀，按 `checkpoint.eventCount` 核对。
4. 在请求可见事件处说明：只核归档来源与本族私有受众，不授予新行动许可或替代完整提交事实的付款历史。
5. 场景头“捣蛋鬼”改为真实 catalog／现行规则卡名称“诡术师”；所有测试标题、fixture、动作、fields、错误码与 assertions 完整保留。

## 验证

三个现行完整程序从最终文本开始，逐项精确逆四处路径和五项注释，得到三个实际 Git before 的完整原文。完整 typed AST **4,168 节点**、全部非注释字面叶与 **6 份 ESNext／CJS 原始输出**相同；两处有注释变化的程序另独立比较完整代码和 **4 份输出**，不把注释文字相同作为通过条件。

全部 **49 个真实 import binding** 的模式、名称及最终声明端点逐项核实：11 个位于新叶或改路线，38 个原位保留。五个控制文件保持原字节；旧删除叶单列原 SHA 与 `expectedAbsent`，不拿空文件模拟删除。

| 有界检查 | 实际结果 |
| --- | --- |
| 原 getter 装配顺序 unit，真实消费新验证叶 | 1 pass／0 fail／2 assertions，3 filtered |
| 三根有限类型 | session `71529` → terminal `fbfeb5`，实际 exit 0 |
| 三个现行职责头、中文首头 | 481 个当时真实 Git 文档路径；两项均 0 诊断 |

类型零字节日志本身不是成功证据，成功来自实际退出回执。只执行这一个必要原调用链测试，没有重跑已绿 parser、Trickster Tape、整局、模型、全类型或全门禁。

## 限制与交接

退休的是旧私有物理模块路径；函数名、原完整规则、读取与第一失败顺序保持。模块 URL、加载路径、栈位置与构建来源指纹变化明确，不重写历史来源或提供跨构建动作重放豁免。并行 Night／Demon／Scholar／Evil 等源码或 fixture 不属于这四源，也不充当 whole-Git 控制；有限类型的传递闭包可以包含并行源码。

源码已冻结，等待独立源码／注释审查后由 Root 按功能提交。不是完整 P7/P8 或全角色验证已收尾。原全文、精确编辑、删除清单和实际收据见 [交付证据](generated/trickster-verification-owner-evidence.json)。
