# P4 G03 死亡来源与猎人决定子批交叉审查

## 范围

DeathCause/DeathSources、源区分和枪资格、末神/空枪/无效决定、三次请求上限、死亡阶段上下文、双语提示和严格Tape request。详细接口见[契约](../death-causes.md)。死亡窗口authority、自爆与完整死亡链ownership继续下一子批，不当成当前已交付。

## 验证

- 双语人工死因表：狼刀/放逐/枪允许，毒或复合毒及默认禁止原因不允许；无效/抛错保存枪，明确空枪消费。
- 中英三种实际PhaseManager模式：末神狼刀死亡后打掉最后一狼，人工预期Good/all_wolves_eliminated，枪先于唯一game_over。
- 真实本机SDK HTTP与MCP错误目标→null→重复提交：稳定回执相同，预检不消费；无外部模型或用户认证。
- 定向31测试/376断言通过，日志 `/tmp/awa-p4-g03-causes-wire.log`；前端54/365与类型通过，日志 `/tmp/awa-p4-g03-causes-front-{tests,type}.log`。
- 第一次完整门槛507通过/1失败，唯一失败为旧提示测试明确保留“末神禁枪”；现已改为冻结的允许末神、null和非法不消费三项断言。修正后的完整release门槛508测试/30549断言通过（类型、依赖、边界、i18n、全test、smoke），日志 `/tmp/awa-p4-g03-causes-release-complete.log`。

- 完整门槛后采纳L两项精度建议，最终engine/shared提示/actualwire/34完整SDK、ACP和混合对局及逐局严格Tape回归185/25591通过，日志 `/tmp/awa-p4-g03-causes-final-regression.log`；类型再次通过。新增双猎人追加波次断言Day/Shot。

- A指出跨await旧枪状态问题，已重新核对Role组件与HunterState对象身份、仍为猎人/具枪/死亡；两語五种resource/state/role/component/alive撤销反例通过，连hook23/254，日志 `/tmp/awa-p4-g03-causes-revocation.log`；类型再次通过。

## 独立三路审查

| 审查者 | 关注方向 | 状态 |
| --- | --- | --- |
| A / review_arch_tests | 捕获旧状态跨await导致撤销枪/变角色仍杀人；应用前重新核对当前组件/角色/状态身份和死亡状态 | 五种撤销/复活回归，无目标死亡/无事件/无额外消费；独立23/254全通过，最终0阻断 |
| R+T / review_scope_rules | 冻结资格、人工oracle、末神判胜、无效与空枪区别、根/追加阶段 | 核对死因表、实际三模式枪先于唯一终局及双Hunter链；采纳A撤销复查，最终0阻断 |
| L+D / review_i18n_delivery | 中英用语、旧档/来源门槛、private范围、文档API | 英文神职术语和追加波次实际death_phase建议均修；独立18/207通过，最终0阻断 |

三路最终0剩余阻断。本批关闭末神/硬编码神职/枪记狼刀差异，后续G03仍需完成World窗口授权与整个死亡链所有权。
