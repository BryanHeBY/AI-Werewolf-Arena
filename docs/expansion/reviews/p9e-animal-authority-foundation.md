# P9e 动物梦境资源与 Fox 请求 owner 基础

前置 `a5e0f31` 的原牌池／原体证明。本切片建立三份原生资源的唯一 owner、真实开夜预约、Fox 同步付款与 God 效果；白猫、子狐、河豚仍 planned，正式 **52/64** 不变。

## 所有权与范围

- 原资源必须为初始化的严格 fresh 状态，owner 保存实际对象引用和 canonical JSON；撤权或异常后的不完整快照只读已提交 canonical 值，不执行被污染的 getter、不退款。
- 开夜先预约 starting，执行阶段检查后复核全部十二个原生命版本；回调中的死亡／复活导致 aborted，不能同夜或后夜重领。入口前正常首死仍合法。必答 Fox 未完成不能正常关闭。
- N2 起原活 Fox 可自选、选择其它原活人或 null。null 完成当夜决定但不耗次数；任一合法非 null 消费一次。库存替换在最后授权之后同步进行。
- 请求层可创建绑定 World／真实夜的 opaque token、固定绝对 deadline 和单向 revoke；全部登记 alias 必须有效。最后阶段回调结束后，直接检查私有 token、截止时间、原体和资源，不再运行任意请求回调。检查期间 create/open 重入先关闭共享租约，吞异常不能恢复。
- Wolf 命中产生内部整队禁刀效果；Beauty 命中同时清真实 CharmBinding 和 targetId，保留旧行动历史，不制造空过记录。付款回执始终只有 `{day,targetId}`。
- 付款效果可保留施法者原首次死亡，正常关闭后至下次成功真实开夜到期；abort 后运行查询失效，失败快照保已付事实。

`animalFoxEffect` 是 God 已付事实查询，不提供阶段或行动许可。当前还没有实际 ActionRequest envelope／能力／SDK／ACP 绑定，token 的无 deadline 默认仅为引擎基础；后续请求层必须在最终受信读取段证明原请求、context、候选、工具及最早期限。白猫真实延期／unit、河豚原票和被动、角色注册、公开配置、PM、知情投影、录制及前端均继续实施，不以 raw fixture 代替 bootstrap 或完整对局。

## 审查发现与修正

R/A 首轮分别复现最终请求回调新增 alias 被快照漏掉；A 另发现后一个回调可撤销先前已经取样的授权条件。单纯再跑若干遍任意回调不能保证最终原子授权，因此删除未提交候选的请求回调 API，改为内部签名数据凭据。R 另复现开夜回调中 Fox 首死留下不可能完成的 open 夜，修为全部原生命版本复验。

R 修后独立五项 **5/0/24 断言**，A 新 API 等价攻击及资源迁移 **15/0/47 断言**，原输入及等价重入／撤权攻击关闭，无本片剩余 P1/P2；原红脚本和日志保留。T/L/D 只读确认回执字段、God／actor 边界与 planned 范围，提供下一运行切片接入清单。不将接口迁移后的攻击冒称旧接口原样执行。

## 维护与门禁

- 原第一个维护候选 **12/1**：失效 God 查询返回 undefined 而非 null；已修并保留原日志。
- 最终四文件维护 **60 pass / 0 fail / 151 断言**，含原牌池、纯资源与有限规范形状；`/tmp/awa-animal-authority-maint-fourth.log`。
- backend source/tests 与 frontend 类型检查全部退出 0，`/tmp/awa-animal-authority-check-fourth.log`；backend deps/boundaries/i18n 全部退出 0，`/tmp/awa-animal-authority-lint-third.log`。
- R `/tmp/awa-animal-authority-r-review.md`、A 原发现 `/tmp/awa-animal-authority-a-review.md` 与修后 `/tmp/awa-animal-authority-token-a-review.md`、T `/tmp/awa-animal-authority-delivery-review.md`；运行接点 `/tmp/awa-animal-runtime-delivery-handoff.md`。

本次没有访问真实认证、用户私有配置或外部模型，没有重跑已验收的寻香板全量，没有启用新角色。后续按规则卡继续真实单位／死亡链和全部交付；main 功能小提交，不推送。
