# P9e 白猫原资源与真实单位底座

前置 `6b7e322`。本切片为 World owner 增加唯一放逐／跳票单位凭据和 Cat 实际致死边界过滤；仍没有角色注册、PM 调用、公共事件、录制或玩家投影，**52/64** 不变。

## 职责

- 单位预约先于阶段回调，入口生命版本变化／递归操作导致永久中止。单位绑定原 World、真实夜的 day、单调有效单位号和原阶段检查；PK 不重领单位。
- 对原活人死亡提案先取 inert own-data 快照，最后授权后同步更新 Cat canonical 资源并返回过滤后的提案。首次致死翻牌与后续挡死不改 Alive／版本；真正死亡仍由 DeathResolution 写入。
- 活跃单位中的波必须携带该单位 opaque token，直接使用原单位检查，不能另传 `()=>true`。Voting 要求同 day、open、exile；旧单位、跨 World、结构克隆和任意 token 无授权。
- 当前实际放逐内首次延期等待下一单位；更早夜间延期可在当前实际放逐到期。默认跳票不推进实际单位数，合并夜波新猫也以“无实际单位”的时钟等待下次真实放逐。另一政策将真实跳票计为单位，允许合并波新猫同单位到期。
- prepare 只提交到期时钟，不写生命。正常 close 必须等待本次应到期的原 Cat 实际首死；没有实际死亡不能推进下一夜。新波产生延期后，之前的空 prepare 失效，必须重做结算。abort 仍保留 `expired + Alive=true` 的真实失败前缀，不编造死亡。

这些 API 只供后续受信 PM／resolver 编排。当前测试手动设置 Alive 仅代表将来唯一 DeathResolution 消费者，不作为真实完整链的证据；God snapshot 的时钟／expiryCatId 不成为玩家信息或公开死亡效果。

## 交叉审查闭环

R 首轮四项、A 首轮两项及追加一项固定红例发现：默认合并跳票多等一个单位、用外部新回调绕原阶段、前一天 closed 单位授权新 Voting、仅 prepare 即正常封单位、空 prepare 后新时钟丢义务。修正按上面职责迁入维护，保留原脚本／红日志；token API 迁移后的合法波用原 token，仅改调用形参，不将拒绝旧合法 baseline 当作修复证明。

T/L/D 确认目前无 Actor／Prompt／frontend 调用、空 token 与 God-only 时钟、没有 Alive writer。后续必须把真实过滤 receipt 与公开 event/cursor 绑定：已准备到期不能当真死或已公告，录制失败不从 raw form 补画死亡。

R 修后独立 **8/0/37 断言**，A 独立 **13/0/52 断言**，五类原语义反例及追加时序差分关闭；本片范围无剩余可复现 P1/P2。R日志 `/tmp/awa-animal-cat-r-fixed.log`，A `/tmp/awa-animal-cat-unit-all-a-review-green.log`；原红输入保留。

## 验证

- 维护第三轮 **77 pass / 0 fail / 225 断言 / 5 文件**，含 Cat 17 项、原 Fox／原体／纯状态和四配置基础；`/tmp/awa-animal-cat-authority-maint-third.log`。
- 原第一轮 **71/0/203**、第二轮 **75/0/216**保留，独立红例另存，没有覆盖。
- source/tests/frontend 类型检查全部退出0，`/tmp/awa-animal-cat-authority-types-third.log`；deps/boundaries/i18n全部退出0，`/tmp/awa-animal-cat-authority-lint-third.log`。未重跑已验收旧板全量。
- R `/tmp/awa-animal-cat-authority-r-review.md`、A 原反例 `/tmp/awa-animal-cat-unit-a-review.test.ts` 和 late-clock 原例、T `/tmp/awa-animal-cat-authority-delivery-review.md`；实际流程下一步见 `/tmp/awa-animal-cat-puffer-integration-r-plan.md`。

后续接河豚原票／被动、实际 Night／Voting／DeathResolution／PM、公开四配置、知情、Tape、双语通信／浏览器与完整阶段验收。基础切片不算角色完成；main 本地功能提交，不推送。
