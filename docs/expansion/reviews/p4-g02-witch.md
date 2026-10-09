# P4 G02 女巫与保护/毒子批交叉审查

## 范围与证据

解药当前目标校验/不消费预检/最终再验、解药耗尽的当前刀口输入、独立毒来源及原生/赠予NightPipeline回归。冻结规则见[基础规则卡](../rules/awa-classic-v1.md)，契约见[witch-resolution](../witch-resolution.md)。不覆盖全部Hunter、空枪、自爆、死亡链、G03/G04或新角色。

- 最终release:check：490测试、30327断言、84文件，类型/deps/模块边界/i18n扫描/test/smoke全部通过，日志 `/tmp/awa-p4-g02-witch-release-complete.log`。含34实际SDK/ACP/混合中英六/十二基础完整对局及每局严格Tape。
- 人工规则专项31测试/325断言，日志 `/tmp/awa-p4-g02-witch-targets.log`：当夜mark、合法更正、不存在/死亡/伪造旧目标、无错误消费、16字面来源组合、当前信息未知与保历史、实际复合毒猎人gun0。
- 真实SDK HTTP/MCP target反馈与更正两语专项，连既有接收用例13/166，日志 `/tmp/awa-p4-g02-witch-wire.log`。两个错误目标后同一窗口合法heal被接受，瓶数仍为1。
- 实际SDK与ACP进程/注入MCP耗尽Witch输入四项，连赠予通路8/60，日志 `/tmp/awa-p4-g02-witch-exhausted-wire.log`；请求缺字段、真实prompt明确unknown、不显示当前目标。
- 最后按A建议收紧进程断言：正安全整数PID，退出错误code必须ESRCH，专项8/68通过，日志 `/tmp/awa-p4-g02-witch-pid.log`。不能用undefined/EPERM错误冒充已回收。
- 前端54测试/365断言与类型通过，日志 `/tmp/awa-p4-g02-witch-front-{tests,type}.log`；字段格式未变，没有重复浏览器E2E/视频渲染。
- 全部模型服务为合成本机服务，没有调用外部模型或用户认证。

## 独立三路审查

| 审查者                     | 检查及建议                                                                                                       | 复查与证据                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A / review_arch_tests      | World真实mark与Alive/Role授权、readonly预检/最终消费，按实例隐藏输入，Damage不接管Alive/死亡链；建议PID验证ESRCH | 初读0阻断，独立witch专项8/144通过；ESRCH建议采纳、最后8/68日志核对，最终0阻断        |
| R+T / review_scope_rules   | 冻结目标/自救/资源条件、未查询目标前的耗尽拒绝、unknown/null区别、独立16oracle与actual compound                  | 独立31/325通过；实际负例仍有其它神在场，gun0未靠旧末神分支蒙关；0未决阻断，未扩大G03 |
| L+D / review_i18n_delivery | stablecode两語、历史信息、schema/source兼容；建议本夜而非昨夜措辞                                                | 本夜/this night统一，旧档原文不改；独立31/325，核对actual13/166与8/60，最终0阻断     |

实现初步检查31/325通过；后来“本夜”文案让旧LLM fixture仍期待昨夜而失败，已修正明确期待本夜，定向1测试/2断言通过，最终完整门槛无遗留失败。测试未因实现更严而放宽目标规则，赠予自救提示判例补真实WolfKillMark。

三路最终0剩余阻断。该修正关闭基础卡的解药刀口/耗尽信息和同守同救漏毒差异，不将其当作死亡动作、普通枪来源或所有组合已正确。内部来源行为变化仍受严格源码/lock/规则版本门槛，旧播放器只保原文。
