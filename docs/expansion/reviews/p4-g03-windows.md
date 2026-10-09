# P4 G03 四自爆窗口交叉审查

## 范围与证据

四公开时点、v2/hook/空列表、历史转换、首日提前自爆合并待夜死/逐演员阶段、最小有效ID、生命周期/取消与消费点提交。契约见[窗口](../self-destruct-windows.md)。特殊狼效果、G04及计划角色仍后续。

- 初步manual/config41/287和engine/config/display235/5710通过；最终人工窗口29/247，日志 `/tmp/awa-p4-windows-manual-final.log`。含R建议的最后正常发言间隙：前五次null、最后一次爆，六个gap六次正常speech，无放逐票。
- 四window × SDK/ACP × zh-CN/en，共16真实完整对局及逐局Tape；8测试/2460断言通过，日志 `/tmp/awa-p4-windows-full-wire-final.log`。角色/事件/存活/两个夜晚/遗言/警长与独立字面plan核对，正常零拒绝/回退，所有ACP+MCP PID明确ESRCH回收。
- 第一次wire Daybreak两项误用旧模型观察oracle：[1,4]完整保存于私人档，但[4]产生后没有后续模型prompt，因此模型只收到[1]。已在对应场景断言两者各自正确，没有放宽引擎或私人记录。
- 第一轮完整门槛596通过/4失败：新最后gap测试包含了首日竞选speech（已按夜间公告后正常speech逐一核对），两旧LLM测试仍断言旧中文提示；已修并定向2/5通过，日志 `/tmp/awa-p4-windows-hints.log`。最终完整release600/34055通过（type/deps/边界/i18n/test/smoke），日志 `/tmp/awa-p4-windows-release-complete.log`；含既有34局加新16局真实SDK/ACP/混合双语基础/窗口完整对局及逐局严格Tape。
- 前端54/365、type通过，日志 `/tmp/awa-p4-windows-front-{tests,type}.log`；无新事件字段/画面组件，不重复E2E或视频。
- 全部模型服务合成本机，无外部模型/用户认证。

## 独立三路审查

| 审查者                     | 检查/建议                                                               | 结论                                                                                          |
| -------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A / review_arch_tests      | 时点/首日合并、生命与最小有效ID、事实+标死消费点、取消与历史语义        | 独立27/233，0阻断                                                                             |
| R+T / review_scope_rules   | AWA明确窗口/不补选、末神枪不截、爆优先无遗言、配置；建议最后gap字面case | 独立33/258，0阻断；最后gap双语补29/247，通过                                                  |
| L+D / review_i18n_delivery | 四窗口文案、模型/档案知识区别、迁移/commitAPI/旧档；三处旧live docs     | 独立37/282，0执行阻断；config-v2/runtime-display/english-execution已同步并复查，最终0剩余阻断 |

完整门槛后增加公开四窗口十二人板子/运行配置，正常v2 load→parse→resolve专项1测试/4断言通过，日志 `/tmp/awa-p4-windows-example.log`。没有改生产源码、用户本地配置或调用真实模型。三路最终0阻断；基础规则缺口已闭，G04继续。
