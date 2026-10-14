# 雾鸦延迟夜交付

三源码正式冻结：

| 路径 | SHA256 |
| --- | --- |
| backend/src/game/engine/phase_manager.ts | 01a3d3895cbca7ad8a8e38023d20c10cb0ec26fa47a8fd766145a87c339fea04 |
| backend/src/rulesets/mist-delayed-night-settlement.ts | 9ace43ac99f3b719a97eb0d47ff841d9ba7ab455c6cd922d0134c2d840eb3b63 |
| backend/tests/unit/rulesets/mist-delayed-night-settlement.test.ts | 56f7b6c8a13686911f04409bf0b8cb3cf8218c1d39e56fe0a6144bbebdf4bc6a |

基线真实27df6552992404dbb1783917cbdaeeaa27e45de3，PM＋六控制 actual Git/current 全同。DR并行InitialRelations明确排除，不要求 mutable source byte同；原真实死亡调用和参数仍纳全PM逆。

原建立19行和完整settle48行：factory收全原生命检查／构造；同步生成器收claim/Snake/prepare/record/finish/close，第二yield传同damage＋current。经理唯一mistPending，原两await/emit/DR/clock/nightSettled/判胜/blast preclaim/abort/finally均原点。9个旧status反射读取sites及所有旧assert字节保持；不是任意私有API等价。

完整真实新body逆 a63baa：opening96／settle232／全PM6207节点＋6完整输出同；15原物理符号、95保留绑定同，2新type只描述输入。六Git控制同；类型修复后单元仅puretype变化，两完整输出同 c8118c，原production2仍同；原proof/head的采样单位SHA不伪写成final。

新单元首模块误名0c96fc；实际ea10e4两绿＋一坏fixture提前roster拒绝，原expect保持，失败only0c00fd1/3；原provider精准f7d60e1/6，20过滤。四distinct／29成功断言，失败断言1另存，绿色未重复。四root45317/fd3309首仅unit四类型diag，精确擦除fix后failedunit44478/bf48a9 actualexit0，不重原三绿root。heads37f12e三源／522doc／CN0／职责0；unit头全byte保持接类型桥。

scope SHA8f3191adeb86d224e4a5e5f6221d6bd8d2dea91d67a9727b3f70a3358634faaf；MD421f8863814e68368aa938d53aed98398419a3f3a4c66f9f807acec0c2391ae5；evidence25b5240cf514ea776e4ea06d977da3871ed4193ddac84829c244a1498880219a。持久同prefix before/edits/proof.cjs/proof/receipt/type-fix/heads/logs可核。

没有全门禁/整局/model/Git/progress/Matrix/其它source写。新同步步骤协议／getter／输出记录／类型归属／栈与对象分配是明确内部API差异；期望独立只读审，不重复绿色checks。
