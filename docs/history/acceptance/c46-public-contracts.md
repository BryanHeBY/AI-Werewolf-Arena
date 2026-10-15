# C46 公共机制契约与首轮验收输入修复

## 实际来源与范围

基线为 `7a85ad67ac808aab3e1d6d91078262a64382ca93`。本记录保存 Root 的实际执行与分段收据，准备作者只读取这些事实并封包；最终文件身份、审查和提交另行绑定。

123 源＝6 份职责首头＋72 个真实 consumer 路由＋36 个有限公开入口＋9 份测试输入／预期适配。87 个原源完整 Git 前态、36 新 absence 均保；无删除。Witch 属于原72程序内的一份，不因后继两位置再累加文件数。并行 `.prettierignore`、Mist 注释及其它 formatting 不归本次123源范围。末 strict 运行时的这两份额外工作树字节另存[并行输入](c46-public-contracts.parallel-inputs.json)；其中 Mist 首个导入前的说明／指令参与源码 inputHash，不将该工作树输入倒述为只含123源的提交。

详细来源见[范围清单](c46-public-contracts.scope.json)、[执行收据](c46-public-contracts.receipts.json)和[封包索引](c46-public-contracts.evidence.json)；[完整材料](c46-public-contracts.tar.gz)保留首输入、候选及各阶段输出。

## 从首红到真实末阶段

| 阶段                | 实际结果                                                                    | 界限                                                                                                    |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| C47 首 strict       | 149 首红＝138 dependency 诊断身份＋11头诊断                                 | 原债 remaining0／cleared1779，不把新违规当旧债                                                          |
| 6 首头              | Root `1b5d4f` 应用；`55eb0d` 完整非首头逐字同、12对ES/CJS输出同、6失败根头0 | 无额外业务／类型结果                                                                                    |
| 有限公共面          | Root `192f1b` 应用；`7a1b56/session73870→deec82` 首证明0                    | 72完整程序／138精确module位置、144完整逆输出与144实际规范化输出、194原consumer Symbols、83新出口Symbols |
| strict 后继一       | `14449e/session8327→5f8d8e` exit1，剩1身份                                  | Witch同一个import-type身份另有两位置，不能从诊断ID计数推断全部site                                      |
| Witch 最窄后继      | `09a38b` 两literal；`499e26` 两actual emit相同；`d28b4c` 两真实坐标完整正逆 | 不重72已绿主证明、不改138/194/83原阶段数字；原138＋后继2＝140实际迁移位置                               |
| strict 末阶段       | `599f0f/session83577→3e0236` exit0                                          | 3336文件／violations0／failures0／remainingDebt0／clearedDebt1779；inputHash单列，不称C47全部42绿       |
| 原unit首轮          | 3992 pass／81 fail，35235总expect含失败                                     | 原raw和来源保留，不把总expect算成功assert                                                               |
| unit定向后继        | `e1553a` 80pass／0fail／33filtered／512expect，7文件                        | 只修已交付契约输入／预期，不重原3992绿；过滤不当通过                                                    |
| 原integration首轮   | 342pass／6fail，4133总expect含失败                                          | 原6失败逐项保持来源                                                                                     |
| integration定向后继 | `e6d846/session80584→890cea` 6pass／0fail／5filtered／45expect，2文件       | 只两source输入适配，不把5filtered算通过                                                                 |
| CLI环境边界         | `500ed2` 两cwd实际child1为EPERM writeFast；`a6ad9a` 同public输入两child0    | 没改CLI源，不冒原CLI测试或整suite重绿                                                                   |

封包冻结后的类型后继由 Root `596b5b/session83926→949cdf` 执行：后端 `tsconfig.tests.json --noEmit` 通过，stdout／stderr 均为空；该真实后继另列执行收据，不改封包内首阶段，未重复其余13个类型项目。

## 公共面与真实职责

night-abilities/death-actions 已拥有完整共同算法与唯一状态；本次给真实跨族消费建立有限具名公开面，不把原算法改名成端口，不迁回中央Role分派。每新增值入口只有原单一 target；初身份 `deal-ports` 已有，复用且零修改。原37目标实现、原类型和值声明、局部 aliases、getter/callee/receiver、await、付款、记录、facts、finally 保持各原位置。

公开面真实包含写权：prepared 安装命令只给原已准备的payload；SHELTER槽对象仍含allowedWrites／prepare／invalidations，不冒只读DTO或完整permission。纯current、已付效果和未付eligibility不统一强化。LastWords默认机制仍在原getter首次调用惰性创建；新入口不预构造单例。没有修改checker或增加通配豁免。

证明在固定Git＋本108 overlay内比较完整正文、全部overload声明raw/printer摘要与有序静态值依赖。workspace包symlink先归真实仓库路径再选fixedGit/overlay，真正外部installed依赖是逐SHA/bytes登记的实际磁盘输入。actual JS新增公开模块名、导出和编译器namespace名字，不是原始字节相同；规范化只逆模块文字和相应require局部Symbol。静态单节点折回不是任意CJS反射、完整动态依赖或实际冷执行实验。

## 测试输入适配不是生产规则修复

7份unit承接已提交的19步verifier装配、F02真实current读点、死亡尝试关联ID、actual Camp快照读取、Noble expire接收API，以及Wild/Lonely canonical BoardConfig。原有故障身份、资源／字段前缀和受众断言保留；配置错误文案／标题有经Root批准的明确新预期，不声称测试JS完全等价。

2份integration分别读取实际版本归档payload上的终档错误predicate，以及拆分Role身份与独立actual Camp断言；不能删掉已有privateState来令旧严格对象matcher通过。故障仍在真实store调用处抛原Error，原错误优先、receiver和终结顺序由原声明维持。

## 首准备、静态finding与预写错误

首f7候选、首cf7证明器和中间host修窄版本原字节保存在包中；同行四处中文精度在任何证明前完成。唯一host静态finding是workspace symlink不能绕fixedGit，未伪装运行红。Root `f8dac0` 误取复用facet absence键、`5fa86f` 误猜before目录都在写源前失败，actual application原记录保留，后继分别成功；不存在的独立raw不伪造，Root实际tool transcript ID另列。

诊断identity不含行号，因此原138诊断≠所有实际引用位置。首绿只能证明捕获的138位置，不能倒述Witch另两位置早已迁完；后继两坐标与actual输出独立承接。

## 归档与后续

`.tar.gz` 只收公开源前态／候选、完整proof与输出、首准备／同行记录、明确的Root原raw／receipt及九测试输入。没有复制巨大C47 snapshot、node_modules、私有配置、原.git或无关门禁。源码123当前SHA／mode与来源由scope列出；各stage结果由receipts列出，所有归档成员SHA／bytes另有清单。

本阶段strict清零不等于C47同源42入口、P9/C48或最终机制矩阵完成。C47首波目前22终态＝17green＋strict／unit／integration／format四red＋A scenario中断；planned20尚未执行，不造回执。Root按精确任务进程组停止错误sandbox能力环境中的A，原receipt为exitCode -15／signal15／timedOutfalse／noFenceError／groupStillExistsfalse；这是未完成前缀，不报整suite计数。C46后继只闭本包必要局部，不回写首波结果或将1622format冒通过。最终候选sourceHash／commit身份、后继format与C48登记仍由Root按真实输入单独对账。C48矩阵草稿本次不扩大。
