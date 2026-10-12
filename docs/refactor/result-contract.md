# C07-A 结果、查验、错误与死亡数据候选

## 授权范围与实际写入

只写11个指定文件：game-contract/src/{outcomes,inspection,errors,death-facts,results}.ts、tests/result-contract.test.ts；catalog/src/{outcomes,inspection,errors}.ts；core/domain/{results,deaths}.ts。未写index/exports/package metadata/lock/root/sourceHash，未改角色流程或fixture。

五个数据body机械迁移，职责头与import边界新补；原所有type字段、可选、null、enum/rawString区别不改变。每个data body去除head/import后字节完全原样，证据/tmp/awa-refactor-c07a-data-body-proof.json。

- RuleError124成员的keys/value/order和Object.freeze原样；RuleViolation.code仍enum，message可选原文。
- DeathCause30成员和DeathSources搬pure数据；不新增freeze。
- DeathShotSelection原NightLifeScope、mappingCurrent callback以及permitsDeathShot/permitsHunterShot全部留domain。selection定义至文件end与旧源1221字符原字节一致，SHA2ff69eb5fbcc297f60f8d0e942cf35afe234bcdbed328fdbbee60523b8c381e9，证据/tmp/awa-refactor-c07a-policy-byte-proof.json。
- 原GameResult.winner Camp enum与SealedVictoryResult.winner rawFaction分别保持；GameOutcome/affiliation/inspection与summary/snapshot不合并，不加计算。
- Catalog三模块与core results具名compat桥，不建立第二份数据定义。Pure叶内不经巨型barrel反导自身，无Node/World/text依赖。

## 小批证据

- contract package check source types:[]及tests Bun两个项目退出0；/tmp/awa-refactor-c07a-contract-check-first.log。
- catalog package同两项目退出0；/tmp/awa-refactor-c07a-catalog-check-first.log。
- 新result contract六项 + catalog public四项：10 pass/0 fail/436 expect；/tmp/awa-refactor-c07a-literal-contract-first.log。
- 旧应用death_causes和inspection_results边界：33 pass/0 fail/510 expect，两文件；/tmp/awa-refactor-c07a-application-boundary-second.log。覆盖两语源因枪权/终局链及camp/role/combined label与真身份区别，不冒充全量角色验收。
- 11文件format check退出0。

首轮应用边界因主实现并行text/event-data新direct依赖物理链接未完成而未执行（0 pass/2加载error），日志/tmp/awa-refactor-c07a-application-boundary-first.log保留；链接完成后原命令第二轮通过，未改原应用测试或fixture。新增test生成器初次newline转义导致一次format语法错误，仅修新增test字符串转义；生产body未受影响。

类型反例维护：RuleError/DeathCause member窄类型、GameResult禁止rawCamp、inspection RoleId闭合/Seer只camp、可选actualExile、原message字段；两个type-only ts-expect-error禁止将DeathShotSelection/permitsDeathShot导入纯包。这些测试不import生产engine或catalog作为oracle。

## 集成与审查

root已装配public出口并拥有source identity、依赖/lock与root验证。新leaf为真实contract/callback边界，旧桥需C44按consumer登记删除，不宣称已清零。作者候选稳定，可交独立reviewer；独立审查、阶段末同源大gate与功能commit由主实现完成。

独立Git2d36原blob核对：五data declaration bodies与原文保持；domain的selection/permits尾部1221bytes不改。10身份/冻结/作用域检查全true。明确原体句柄/callback未进入contract，不合并Camp enum与FactionId raw union。新leaves已同笔自动纳入C06 fingerprint，现有具名facades在C44待consumer关闭后退出。types/package局部与33个受影响应用边界通过，全量未重跑。
