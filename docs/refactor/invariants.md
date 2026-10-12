# 不变量证据与迁移责任

来源为计划 §3。冻结规则要求、目标架构和已证实行为分别登记；完整基线套件通过不能独自证明所有 N 项。下表现有证据只是可定位入口，后续切片必须补精确测试/轨迹及审查；F01 / F02 例外不允许被机械等价比较忽略。

| ID  | 冻结要求                                                                        | 当前证据类别与入口                                                                           | 后续责任          |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------- |
| N01 | 身份、真实阵营、胜利归属、查验标签、狼队互认、聊天、刀权与自爆能力分别表达      | 冻结规则 / 目标约束；baseline-contracts.json; hidden camp characterization                   | C06、C30、C33     |
| N02 | 授权是引擎内不可伪造的运行能力                                                  | 冻结规则 / 目标约束；noble scope / foreign token characterization                            | C18、C19          |
| N03 | 原请求、context、body、原组件身份、生命版本、能力实例、来源和政策按机制要求绑定 | 冻结规则 / 目标约束；F02 四类原体恢复 characterization；原不变量有差异                       | C16–C20、C18a     |
| N04 | 所有期限派生共享最早绝对期限，期限只能收缩；撤权单调                            | 冻结规则 / 目标约束；F02 deadline字段恢复 characterization；真实超时另验                     | C18–C20           |
| N05 | 请求选择、预检接受、领域提交、资源付款、实际生效与玩家告知分别记录              | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C25、C30、C38     |
| N06 | 异步返回后与领域提交前重新检查有效性                                            | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C18–C20、C30      |
| N07 | 已付效果和仍开放行动窗口有不同生命周期                                          | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C23、C28、C32     |
| N08 | God 事实、玩家历史知识、当前行动许可有独立语义                                  | 冻结规则 / 目标约束；F01 同一 observation / 真阵营差异 characterization                      | C33–C35、C33a     |
| N09 | 历史受众按事实发生时的授权确定，玩家序号局部连续                                | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C34、C35          |
| N10 | 状态变化和事实具有明确提交边界，失败保留已提交前缀                              | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C25–C29、C38      |
| N11 | 死亡来源阶段与当前执行阶段分别表达                                              | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C27–C29           |
| N12 | 死亡关系闭包、实际标死、遗言、警徽、枪、追加波次和判胜遵守板子冻结顺序          | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C27–C29           |
| N13 | 动态能力和潜在能力阶段继续可用                                                  | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C21、C30          |
| N14 | RNG 算法、fork 路径、抽取次数和消费顺序在行为保持切片中一致                     | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | 每个机械迁移及C39 |
| N15 | 胜负检查点、顺序和特例保留，结果只封盘一次                                      | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C29、C37          |
| N16 | 未知事件默认不可见；按运行环境的入口契约拒绝恶意对象，畸形事实不保留半投影      | 冻结规则 / 目标约束；snapshot/data reader恶意输入及旧角色事实测试                            | C08、C34、C40     |
| N17 | 关键录制失败与可选诊断失败遵守不同政策                                          | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C38               |
| N18 | 完整和失败复现保存请求与结算因果                                                | 冻结规则 / 目标约束；C02 各构建原生严格Tape和失败因果差分                                    | C02、C37–C40      |
| N19 | 机器协议与原文不随语言改变                                                      | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C15、C35、C40     |
| N20 | 运行句柄、回调、组件引用和认证不进入协议及归档                                  | 冻结规则 / 目标约束；已交付测试发现入口见 generated/baseline-test-cases.json；逐项审查待迁移 | C18、C34、C37–C40 |

实际机制及 consumer 迁移台账：[89行静态矩阵](generated/mechanism-matrix.json)。每格 initially pending-migration / needs-classification；不得以源码字符串出现就标完成，也不得自动将无证据格标N/A。
