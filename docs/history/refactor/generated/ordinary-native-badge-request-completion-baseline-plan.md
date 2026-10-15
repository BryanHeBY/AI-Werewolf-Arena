# Q2 原生预言家／死亡警徽：执行前 characterization

## 来源及执行权

关键21源的现行完整原文、SHA、实际 Git SHA 存 `before.json`，捕获实际 `9299803077061714b2b2b09563a1e5534e06774c` 且全部逐字节同。不是整个传递模块固定树：Root 当前 Demon/Ghost 等并行模块在真实执行工作区加载，需其 source-ready 后才由 Root 首跑。脚本只位于 /tmp，作者没有运行、导入生产或修改仓库任何 source／正式文档／metadata。

`characterization.test.ts` 两个新声明，每个顺序用三个独立 canonical bootstrap World，共六 fresh fixtures。普通六人角色为两狼、预言家、守卫、两村民；Badge版只按正常公开字段启用警长、初始第5席和持徽选择政策。下游实际 NightPipeline 使用返回的 `game.boardConfig`／RulePlan；Badge实际 DeathResolution 标死第五席，走原遗言、World permit、BadgeChoice、真实工厂／网关／Badge writer，不把 alive=false 或伪 scope 填给自制回调以放行。

不复既有绿；不运行完整对局／模型或任何门禁／类型。Trace 的两个64位 hash是显式 schema-only fixture标记，**不是** current build fingerprint，也不冒 strict replay；真实源版本另由 before 明确。metadata 的 canonical board、真实初始玩家和随机元数据用于实际 Trace/schema 读取。

## 六个输入和只记录的结果

| 链路 | envelope | 本族首写失败 | 最终事实 sink失败 |
| --- | --- | --- | --- |
| Seer | 原请求 context替新对象→真实assertRequestDelivery观察→恢复原引用→再次观察；derive真实期限对象另记，不谎称已登记alias | provider 返回合法check后在真实SeerState.lastTarget setter抛同Error | 只在真实seer_checked push抛同Error |
| Badge | 真实死亡许可已开放时同样观察，不改World／current；实际provider入口验证真正permit | 合法接任第6席后在旧Badge.isSheriff=false首写抛同Error | 只在真实sheriff_badge_transferred push抛同Error |

其它 stage／遗言 provider返回null；这些请求仍由真实窗口处理，但不额外录Trace决定，避免冒全局录制。Seer运行完整NightPipeline，未替换阶段注册或authority；Badge运行完整DeathResolution。两条目标请求各经ReproductionTrace.decide包裹，再回到原provider/网关/提交体。

脚本只断言真实窗口确实到达、Badge provider时生命已死且真实permit通过、所注入同一Error确实来自目标写点；不把未来outcome/settlement/状态值写为oracle。results.json记录：

- 实际envelope／期限派生对象的delivery结果，不用无登记时的无错推定授权。
- provider候选返回、Trace onChange和本族首写／sink读取的settlementCount。
- 原Error身份、写点计数、最终实际决定outcome／settleOrder，若build失败则真实记录其错误。
- Seer lastTarget/lastIsWerewolf/lastResult/history及ability.lastUsedDay/uses；警徽双方、票重、真实生命和finally之后permit数／原许可查询。
- 全部已追加事件前缀；sink错误不会手工撤销早先状态或记录。

preload会静默console。**results.json是字面观测结果文件，raw只按实际Bun终态保存，不能声称raw含console JSON。** 原状态描述符／事件数组push在fixture结束恢复，未全局改Array或伪造domain completion，也不主动调用defer占用Trace事务回调。

## 已读原时序；不是运行结论

1. Seer捕获能力／生命／政策、makeRequest后复验，await后及gateway后复验；当前没有本族delivery/completion绑定。slot按 `lastTarget → lastIsWerewolf → lastResult → history.push` 写；随后狐狸提案、stage check行、`recordNightAbilityUse`（lastUsedDay→uses）、modifier/reflection、本人行动历史，最后seer_checked。任何晚错保此前前缀。
2. Badge按原持徽死者／生命版本复验、捕获接任生命、打开真实World permit后读取constructor并create。原provider／gateway复验后走Badge writer：旧徽isSheriff=false→destroyed=true→旧票重→新徽／新票重→特殊frame.commit→transferred事实，finally permit.close。许可关闭的原错误优先保持；本脚本没有人为close故障。
3. Trace.decide先pending/通知，await provider候选后复制数据和assertDelivery；若没有completion则同步settle(true)再把候选交回domain caller。对应outcome.kind=action的现有定义可能是候选接受记录，不足以单独推断档案已谎称付款。是否属于plan§7应defer的事务请求需Root明确政策。
4. RequestLease.window已提供动态scope／字段pins／earliest/alias/once completion；未把它手动绑定到本轮旧窗口，避免“实验”提前实现政策。

## 待Root的最小政策决策

plan§7区分provider候选、规则预检、同步领域commit、settlement与后继知识／事实；§8.3又要求晚错保原已付前缀。建议先以六样本确定现行轨迹，再明确每窗口：

- 哪些原写是尚未完整提交的准备，哪一点代表本次同步领域commit完成；不可把provider返回或第一个局部字段写入当完成。
- Seer的有序知识写、uses、效果／反射登记与本人历史之间原先后不能为“事务”调序；若需completion，标明具体真实完成点和已付后知识／事实失败是否仍true，不能用false回滚。
- Badge完成至少不能早于旧徽／新徽／票重及对应frame提交。事实sink晚于这些原领域写，需明确它是完成的一部分还是后继发布；无论选哪一政策，已实际换徽不退款，permit finally仍执行。
- envelope坏的永久关闭和alias隔离应由现有RequestLease拥有；World death permit仍唯一domain许可，不增加第二WeakMap授权表或55角色框架。

当前仅准备，**没有任何本轮运行红、通过结论或未来oracle**。
