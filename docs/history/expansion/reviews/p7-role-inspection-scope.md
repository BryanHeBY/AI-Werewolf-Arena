# P7：既有具体身份查验作用域修正

范围：`role_inspection/night_stages.ts`、`night_scope.ts`和专有反例。修已交付Gargoyle/Psychic的请求及已付原生完成权限，不注册Mirror，不改变当前两policy合法目标、阶段、skip、库存或事件payload。Mirror规则另见冻结笔 `889bfc6`，不是其启用。

## 反例与修正

1. **根代理反例：原ID未固定。** await/gateway里同对象ability.id改名，原请求仍消费并报告。修前专项0pass/6fail（包含下面历史两个反例），`/tmp/awa-role-inspection-scope-before.log`。执行器复用现captureNightAbilityScope，捕原ID/kind/activation/role/camp/privateState/state/生命与当前日；request与gateway传捕获ID。
2. **根代理反例：最终唯一历史未复验。** gateway或规则label callback在同对象history添加当前目标后，原执行仍追加重复报告。两个点重新查实例当前合法目标；保注入前缀，让下一次合法新目标重试；Psychic仍允许重复。没有回滚已有历史或把其它实例的记录算入。
3. **A阻断：已付Garg completion跟随变化后的ID。** 原实现保存ability ref，查询却读其当前id；补原abilityId/activation/privateState快照、原native source.role条件，资源已付后不能用activeNightAbility撤合法刀。四反例修前6pass/4fail，`/tmp/awa-role-inspection-completion-before.log`；修后改ID/source/private owner/activation不授刀且报告/uses前缀保留。
4. **根代理相邻反例：稳定玩家归属。** 搬Role和Alive引用到另一实体，any-ID扫描能找到旧body并借许可。补原actorId直查原Role/Alive；第五已付反例修前10pass/1fail，`/tmp/awa-role-inspection-actor-before.log`。身份/生命引用一致也不能改变许可归属的稳定玩家ID。
5. **R/T阻断：赠予伪装原生。** 独立 `/tmp/awa-role-inspection-source-review.test.ts`复现gift:gargoyle在等待中改source为native，伪造原生完成并获刀。执行器局部绑定原source ref/kind/native role或gift actor/copy-transfer源abilityId，在await/gateway/label后同一current守卫复验；不扩其它角色执行器。仓库三point promotion与两policy source owner原地修改反例均0报告/消费/commit，gift abilityId也不会错误省略。

## 独立复查

- **R/T（review_rules_psychic）**：原source探针和两个Psychic历史插入探针3/11通过；后者确认新增终验未把Psychic变成禁重复。仓库专项16/95独立通过，来源阻断关闭；五paid案例均先证正常闭夜后刀true，再撤权false/保前缀。R0。
- **A（review_arch_psychic）**：独立scope+Garg+Psychic72/494通过；来源快照与原actor ID检查正确，原ID/owner/moved-life不借许可；合法原生付费后仍能刀，撤权不回滚use/history。0残留。
- **L/D（review_rules_gargoyle）**：最后直接核最终750/22358/53、前端139/1224/22与静态日志，修复未改变呈现字段、文本或前端源码；未无相关变化重复browser/PNG。72完整局/80seed/gift分账、早744非final、Mirror未启用与20/44一致，0登记阻断。A/R也直接核最终日志与记录并支持独立fix提交，三路闭环。

## 最终门槛

最终源码冻结后 `/tmp/awa-role-scope-owner-gate.log` **750 pass/0fail/22358 assertions/53 files**，exec句柄终态exit0：全部engine/contracts、真实赠予能力通路、既有Gargoyle与Psychic四板共 **72双语SDK/ACP/MCP/混合完整局＋80受限seed** 及每局严格Tape（含Garg额外gift小任务，不把它们计完整局）。正常原生完成/无目标与后续刀资格、两policy规则和生命周期、失败/资源回收均沿实际断言保留。

`/tmp/awa-role-scope-owner-{type,deps,boundary,i18n}.log`全部exit0，精确57源码例外未扩大。专有core `/tmp/awa-role-inspection-source-final-core.log` **72/494**；frontend `/tmp/awa-role-scope-front-tests.log` **139/1224/22 files**及type exit0。早期744/22323日志只属未补source/稳定ID候选，不当最终source证据。

目录20 verified/44 planned保持；这不是全backend release或P7整体激活。后续Mirror完整功能、Awakened Hidden Wolf/Black Market Merchant、P8–P10、64/22、全阶段矩阵、长局/T6继续；未读取用户configs/认证或调用外部模型。
