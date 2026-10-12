# P9e 熊天亮取样的内部帧策略

前置 `4188b96`。`BearNightFrame.capture(world,day,catalog?,signalPolicy?)` 增加显式 `netease_dawn_live_v1`；省略仍为已有 `awa_night_open_v1`。这是内部帧底座，公开 `roles.bear`、BoardSchema／Profile和PM尚未选择新策略，不能据此把已有示例说明成天亮版或动物板已交付；正式52/64不变。

## 两个时点与原体

旧默认仍入夜取当前存活邻位的bool，天亮只公布旧样本。新策略入夜锁原World、熊／state／独立Camp／生命和原活人scope；实际公告时才按当前存活座位环重新感知。原熊入夜前已死或本夜首次死亡为quiet；替换／复活不能借旧帧。pending Cat真实Alive未变，仍占当前邻位；真正到期死亡后新环才改变。

新策略采样可能调用可信profile感知函数。World/day私有发布槽单向checking→published/revoked；同帧或其它帧重入checking撤权，不重领。感知后最后阶段检查结束，再无回调复核原体、生命版本／座位、全部活人集合与同日history。取消不可恢复；错误World不消耗原World帧。

新路径同时检查两边ordinary nonProxy数组可追加性，然后原生defineProperty写公共event与history，不调用可覆盖的push。不能写事件时不留下未公告history；已公布槽不因外部清history而恢复。公共事实仍只有 `bear_roared {day,roared}`，不含熊ID、邻居、方向、数量或样本。

同步frame提交不等于整条录制发布链；后续Animal玩家知识仍从实际发布prefix/journal取，Observation与profile文本必须同源，不能直接读raw私库补知情。旧policy保持原guard/push路径，避免把本片扩为旧板行为修改。

## 审查与证据

R/T最小反例发现感知后撤phase仍公告、重入重复、夜初死人被感知回调复活后仍用旧环；A另发现冻events可留下hiddenhistory、清history可重领。修正及相应维护均已迁入。

- 新旧维护4files **90 pass / 0 fail / 399断言**，`/tmp/awa-animal-bear-frame-maint-second.log`；首轮85/0/389保留。
- A默认旧源码五literal对照 **5/0/5** 完全等价。A原样首次修后 **11/1**：旧重入例期待一条，新契约全部撤权返回零；原输入／红日志保留，只另存这一断言的新契约副本，最终 **12/0/19**，`/tmp/awa-bear-dawn-final-a-review-green.log`。
- R三个原反例未改 **3/0/6**，当前邻位／pending Cat正例 **2/0/4**；T原字面phase例未改退出0，事件和history均空。
- source/tests/frontend类型检查全部0，`/tmp/awa-animal-bear-frame-types-second.log`；deps/boundaries/i18n全部0，`/tmp/awa-animal-bear-frame-lint-second.log`。
- R `/tmp/awa-bear-dawn-r-review.md`、A `/tmp/awa-bear-dawn-frame-a-review.md`、T `/tmp/awa-bear-dawn-delivery-review.md`；本片范围无剩余可复现P1/P2，未重跑已验收旧板全量或外部模型。

接续统一实际请求envelope／期限、Fox整队禁刀与Beauty许可、三角色／四配置的真实Night／Voting／DeathResolution／PM、共享事实／知情和全部交付。main功能提交，不推送。
