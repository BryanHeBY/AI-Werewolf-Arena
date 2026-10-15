# P9e 共用原玩家作用域纯迁移

将寻香双目标使用的原World、Role／独立Camp、factory Alive引用及版本证明移至 `roles/original_player_scope.ts`。原 `fragrant_pair_seer/target_scope.ts` 保留旧函数／类型别名与双目标布尔聚合；后续动物板、秘密交易可复用同一基础，不反向导入寻香角色实现。

这是路径与命名迁移。主任务及R/A独立比较gitshow原实现，规范化路径和四个名字后函数体逐字节相同；双目标聚合全文不变。private WeakMap仍唯一，旧三函数与新函数在运行时严格相等，无转发包装或新状态。原四个值导出和类型别名保持。

原5份寻香状态／owner／信息／生命周期／请求维护测试73通过、0失败、436断言；root check及backend lint／边界／i18n退出0，格式与差异通过。原日志 `/tmp/awa-original-player-scope-maint-first.log`，独立alias日志 `/tmp/awa-original-player-scope-alias-a.log`，两审查 `/tmp/awa-original-player-scope-{a-review,r-review}.md`，无新增P1/P2。

current要求原体仍活及原版本；允许首死的查询仅接受原生命版本+1，替换／复活+2无效。helper不证明Identity／Victory／private库／native能力／阶段／截止时间／issued receipt，也不持永久撤权锁；这些仍由具体owner负责。未启用新角色或修改旧规则，正式52/64不变。继续动物板原生owner、阶段与死亡结算，完整运行门禁另行执行。
