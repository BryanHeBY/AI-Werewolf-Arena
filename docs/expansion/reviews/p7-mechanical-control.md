# P7 机械内部状态与权限控制

本笔交付 `mechanical_wolf/state.ts`、`night_scope.ts`、`inheritance.ts`，均未进入生产装配；角色没有 enum/profile 注册，目录仍 planned。测试使用内部 synthetic World，不宣称实际配置、夜间阶段或完整对局已经支持机械狼。

## 已验内部规则

- 单一深拷贝 owner 保存六类学习结果及独立资源；具体角色标签事实立即冻结，所有技能次夜起，枪被动就绪不受 kill/skill 排他。
- 学习与模式分别关闭。合法等待只关闭本夜学习，后夜仍可学习；技能合法等待不消耗毒瓶。模式同夜只接受一次。
- 继承事实仅在装配或完整实际死亡提案的调用点更新，固定首个刀夜为 `max(2, day+1)`；查询不写状态，也不因跳过或复活重置事实。
- 原生主动效果与刀互斥。额外刀资源区分 available/spent/expired；首窗口 skill、未用、已错过或晚学均不能后补。
- 连守按相邻实际夜次和同一稳定 ID 比较；空守或中间跳夜打断。目标复活不能规避同 ID 限制。
- runtime owner 范围绑定 World、role/camp、privateState、库存和原生命/版本及阶段谓词。主动效果另绑定原学习、技能种类和模式；消费自身库存/关闭机会不撤已提交效果。
- 模式序列化事实不恢复刀权，只有该局实际接受的模式范围才能授权。runtime 引用只在闭包/WeakMap，库存保持 JSON 可序列化；无 caster/reflection 因果字段。

## 独立发现与复查

| 问题 | 修正及回归 |
| --- | --- |
| 已接受 skill 模式对象改成 kill 可错误获刀（A、L/D） | 保存接受时 kind 快照，检查原引用/日次/种类均匹配；不可同夜重新登记。 |
| 原 guard 技能对象改 kind 后旧效果仍有效（A） | 保存原技能种类并最终复验；资源更新仍有有效正例。 |
| 一个 World 的 owner 可登记进另一 World（A） | owner 显式绑定 World，登记拒绝外局范围。 |

三路只读复查关闭以上问题，A 与 R/T 各独立运行 **39 项、159 断言**，L/D 原失败 probe 修后通过；当前 0 剩余阻断。

## 最终门槛与后续

type/deps/boundaries/i18n 均 exit 0，全部引擎 **580 项、8514 断言、43 文件**通过，日志 `/tmp/awa-mechanical-control-engine-final.log`。此笔没有生产调用或公开数据变化，因此不重复完整接入/浏览器/PNG；伤害前一笔的 278 局证据不冒认本笔 source 的对局运行结果。

下一完整启用笔必须接通模式默认与网关、学习和全部机械技能、装配及实际 DeathResolution 继承调用、规则标签、玩家/God 投影、中英文提示、配置与支持板子、SDK/ACP/MCP 整局、受限 seed、严格 Tape、前端与画面。内部 synthetic 批后 refresh 判例不能代替真实死亡 owner 测试。64 角色/22 机制完整目标持续。
