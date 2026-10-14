# 下一批完整 owner cohort：当前源码只读审计

审计固定来源为 `cdbe1cf15c6046f893436c7a39764e10117ef097`。依据外部总计划、仓库 `plan.md` 第 6、17–19 节、两份机制矩阵、现行状态边界文档及下列实际源码。未运行 tests、types、proof 或 architecture gate；现有用例仅作为下一批候选证据，不声明本轮通过。

## 当前完成边界

- 冻结 `mechanism-matrix.json` 是原 89×10 清单，49 是 feature 目录数，不是全部 55 个角色的验收数；保持历史原文。
- `current-mechanism-migration.json` 仍观察 `f5242032`，91×10 中 222 partial、688 pending，complete／不适用均为 0。它落后于当前多批状态槽和生命周期提交，不能拿这一旧登记推断当前每族源码，也不能把结构门禁清掉的 ID 换算成完整格。
- `remaining-role-state-boundaries.md` 是原十五族读视图／纯类型交付史。魔术师、诡术师、狼术师、时间狼妃、导师、梦魇、恶夜骑士等现在已经有真正槽 owner；不能再以原文的旧 state 路径安排重做。`RoleComponent.privateState` 已是 `readonly object`，旧 Record 消费面也已退休。
- 导师增益、恶夜绑定和摄梦关系已经退出通用夜状态的具体载荷；`DeathHookResult` 也已采用死亡波贡献契约。狼美人和幽灵新娘已交付的完整死亡波发布不应重迁。
- 赠枪的 grant／arm／capture／expiry／transfer／consume 已在 `death-gun-lifecycle.ts`，不应只再次搬这个文件。独立 verifier 已归 `verification/reproduction`，录制格式已归 `recording/checkpoint`；物理归属通过不代表全部 checkpoint／C17 已闭合。

## 优先 A：四族原生／学习枪的资源与完整结算贡献

实际缺口：`roles/death_shot.ts:114–118` 在共享 resolver 中判断 Hunter，调用具体猎魔人 authority，或强转读取视图直接写 `state.canShoot = false`。四个实际 consumer 是 Hunter death hook、WolfKing profile、Mechanical death hook、Awakened death hook。后两族只读数据和 captured-owner Map 已存在，资源写权仍越过它们的具体 owner。

### 实际可拥有的生产范围

- `roles/death_shot.ts`：保留工具／修复／验证数据，完整 `resolveDeathShots` 可归具名原生枪结算 owner；不是只换 import。
- `roles/hunter/{state,profile,death_hook,ports}.ts` 与 `roles/wolf_king/{state,profile,ports}.ts`：收齐原槽 install／query／原生枪付款；初始化与普通狼资料装配仍在原调用点。
- `roles/mechanical_wolf/{state,death_hook,ports}.ts` 与 `roles/awakened_hidden_wolf/{state,death_hook,ports}.ts`：完整学习枪创建、武装／激活、查询、捕获复验、消费归各族实际资源 owner；其余学习、模式、毒、守护、刀逻辑不夹改。
- `roles/demon_hunter/ports.ts`：仅确有需要时公开原 `openDemonHunterStockFrame` 同绑定。原 authority 的原体／审计／付款算法不拆、不复制。
- 新具名结算叶及最小风险 unit。原 state 若退休，全部真实 consumer 整迁，不能保双出口；无需触 PM、DR、NP 或 Voting。

### 完整职责与保序要求

共享结算只操作具体族提供的原资源贡献，退出裸写和具体 Demon 分支；具体族收走实际创建／写入算法，不能仅增一行 consume 转发。结算拥有死因资格→选择 await→原体／库存／来源复验→pass／映射 miss／保护 blocked 的付款→追加死亡／延期事实的完整算法。标死、死亡波和终局仍归现行领域／引擎 owner。

Demon stock 必须在原角色／死亡检查之后、读取 sources 之前捕获；中毒先消费再发沉默事实；await 后先 current 再 stock.current；命中先消费再核保护。事件或库存 setter 抛错保留已付款前缀。Mechanical 原 learning／gun 指针和 Awakened 激活元数据不能被新 DTO 或通用 lease 替代。

普通 Hunter／WolfKing 现在直接槽读取，允许 getter 与宽对象；本批不得静默变成严格 schema。原生枪、学习枪、赠枪的库存和政策不合并。完成后可以验收四族这一个实际 native-gun 资源／结算职责；不能登记 Mechanical／Awakened 全部状态与全部 C17 已完成。

### 已有独立候选证据

- `unit/features/mechanical-wolf/captured-gun-ownership.test.ts`：camp／private container／owner state／learning 替换后的字面空提案、空事件和原枪仍可用。
- `scenarios/features/wolf-king/copied-gun-and-mixed-origin.test.ts`：两种学习枪保独立政策；原混合夜刀／日爆链先完成两枪再封盘，固定最终存活名单。
- `scenarios/mechanisms/configured-death-policy-permits-and-copied-guns.test.ts`：政策修改撤销真实 gateway／迟到选择；严格原生 Hunter 不限制同人独立赠枪。
- `unit/mechanisms/deathgun-read-boundary.test.ts` 作为赠枪不受影响的控制：同引用、转移新 owner、首次死亡到期和抛错 setter 的明确前缀。无需将已绿赠枪整套按每个角色重复运行。

## 可并行 B：首夜选择四族完整数据槽与失效写权

实际缺口：Thief／Shape 的 schema／query／project 在 `state.ts`，profile 直接安装；`initial_identity/setup.ts:399–408,453–454` 在选择与 finally 中写 remaining／choice。Wild 的完整状态更新在 `lifecycle.ts:257–274,355–359,393–396`；Lonely 在 `lifecycle.ts:279–280,293–299`，预期 JSON、关系知识与失败投影也由各 lifecycle 持有。

### 实际可拥有的生产范围

- 四族 `{state,profile,ports}.ts`，新增各族实际槽；Thief／Shape 共同 `initial_identity/{choice,setup}.ts`，Wild／Lonely 各 `lifecycle.ts`。
- 搬完整 create／原接受集合／同引用 query／投影数据／install／commit 与 cancellation 数据写／原编码；World 原体、目标生命、身份转换、成员归属与夜窗口授权留 lifecycle／setup，物理牌组仍 `initial_identity/deal.ts` 唯一 owner。
- 路由消费者：`game/observation/{player-observation-projector,player-prompt-directives}.ts` 仅相关绑定；四族专属旧 unit／scenario 及 `remaining-role-state-read-boundary.test.ts` 仅真实入口。共享 reader 与其他作者协调一次，不让两个 cohort 同时写。

这不是四个 accessor 改名：选择消费、失败取消、野孩子 chosen→transformed→active 和预期 JSON 的真实写体要归槽。生命周期保原 guard／时钟／阵营／fact 决定，不把槽或只读类型当授权。

Thief 与 Shape 不可合并付款规则：选新身份时 Shape 原先付款，Thief 原旧对象不在同一分支付款；保留时都先 remaining 后 choice。Shape finally 只对原可写 descriptor 进行原补偿。Wild 先标 modelCommitted／发布 model-eliminated，才检查并变阵营，再写 transformed；失败不能撤回已发布事实。Lonely 先两槽写再 Victory 安装，取消为逐字段 defineProperty，并保失败审计原 roster。投影隐藏目标阵营，知识不能当真实营或库存。

### 已有独立候选证据

- `unit/features/{thief,shapeshifter}/deal-and-setup-contracts.test.ts`：N+2 物理牌守恒、双狼必选、取消／冻结 cleanup、setter／getter、原候选和完成投影；字面断言不依赖新 owner 推导。
- `unit/features/wild-child/model-choice-and-fact-contracts.test.ts` 与 `scenarios/features/wild-child/model-death-and-pack-activation.test.ts`：无底牌知情、晚撤权、仅实际 model 死亡波转换、跨夜激活。
- `unit/features/lonely-girl/setup-and-audit-contracts.test.ts`：双方 death 后独立成员仍在、原角色／camp／库存不变、nested choice 污染与失败原审计无 foreign getter。
- 保现有同引用、可写副本和原宽接受策略；Wild getter 当前不是完整 payload schema，不能借槽迁移新拒绝旧对象。若目标需要强化，先单列行为政策，不混等价提交。

## 跨族仍须单独闭合的 checkpoint／C48

`recording/checkpoint/player-snapshots.ts` 仍按 Demon→Animal→Fragrant→Wedding／Lonely→普通 `structuredClone(role.privateState)` 编码。普通分支是整私有容器克隆，不是已登记的每族 codec；新增槽不足以关闭全 55 的 schema／codec／copy／transfer 格。这里是一个真正的 C37／C17 共同边界，宜在上述数据 owner 稳定后统一办理，而不是每族只把同一 clone 复制到一个 helper。

未来编码贡献必须保未知扩展字段和原 accepted raw、getter／clone 的失败点、原优先级、原历史字段，不能用玩家投影代替私有 checkpoint；`projectLonelyGirl` 原两次调用也不能擅自缓存。特权审计失败快照和普通成功快照的接受面不同。没有这些原输入证据前，不建议为漂亮 schema 新增严格拒绝或删除 extra fields。

C48 下一次登记应按真实提交补上 f524 之后的完整 owner 交付，并逐职责列清：创建／写／读／原 schema／内部 identity 与档案 codec／expiry／copy／transfer、生命周期与已付效果、death、观察、verifier、旧出口。历史 frozen 矩阵不改；现行格只有相应 owner、实际 consumer 和独立行为证据齐全才可 complete，确无 copy／transfer 的机制需给原调用来源后再不适用。结构 checkpoint 的 0new／250 remaining 只证明 progressive 边界，不能验收全中文、全部机制或 P9。

## 调度建议

A 与 B 的角色／生产 owner 不交叉，可由两作者并行；原生枪批不要借机扩大到 gifted lifecycle 或所有 learned skills。共享测试路由由 Root 集中合并一次。Root 串行处理 checkpoint contribution 与当前矩阵的真实映射，避免第三作者同时改 Observation／recording 共同叶。每批有意义的风险验证与有限 affected roots 一次，绿色不按角色重跑。有效中文注释须写实际库存、原体、晚读取、取消和付款后失败，不以模板文件头代替这些契约。
