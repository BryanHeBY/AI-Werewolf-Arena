# P5 守墓人交叉审查

范围：[冻结卡](../../rules/awa-gravekeeper-v1.md)、[契约](../gravekeeper.md)。被动前日真实放逐主目标/冻结camp-only标签、无pending泄露、night时点/去重/死亡、夜间中断、双语/严格序列化、真实接入/记录/展示。石像鬼与后续角色未提前启用。

## 主代理已运行证据

- 初版core11／86、增强Witch顺序与gift后13／104通过；架构修正后加真实jump、往返/同phase撤权、严格坏history/DTO/renderer及Knight/白狼公共杀人，最新core20／236，日志 `/tmp/awa-p5-grave-core-final.log`。
- 修正定向core+G02+wolf战术共47／439通过，日志 `/tmp/awa-p5-grave-corrections.log`，生产clock/错误策略不放宽。类型/source扫描通过。
- public6/12可加载，empty-only参数拒绝；原King/White/Knight负例改真正planned Dreamer，配置8／50通过，日志 `/tmp/awa-p5-grave-config-final.log`。初版新例误期待无configuration的not-supported码，实际strict空schema报精确invalid-field，修正fixture期待而非生产校验。
- 每板20共40seed受限观察自然终局/零拒绝回退/反馈正覆盖/逐局Tape通过，初连配置日志 `/tmp/awa-p5-grave-config-sim.log`（两配置期待错不计为整体绿）；随机本身2／50绿，最终全量继续回归。
- 8case×SDK/ACP/混合×中英＝48actual local完整局，24／8467及全部严格Tape通过；修正clock/reader后同矩阵24／8467再通过，日志 `/tmp/awa-p5-grave-wire2.log`。字面请求/反馈/牌面/结果/存活/遗言/检查点，不从引擎真状态计算模型行为。
- frontend83／711通过，含合法三camp/坏kind/日期/ID/extra Unknown/不改生死/pure frame，最终日志 `/tmp/awa-p5-grave-front-tests-final.log`；actual门槛终态见下方。

## 三路发现与修正

| 路线                      | 发现/建议                                                                                 | 处理                                                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R/T：review_scope_rules   | 初卡可冻结；label必须放逐定案冻结、pending不入DTO；Night2死前记录≠真实模型收到            | 内部fact输入、不再重读目标、day−1无旧重报、明确次夜死亡场景只有Day1模型turn；其它场景逐turn标记实际最新/无反馈                                                                                         |
| A：review_arch_tests      | Medium：手动jump后夜间仍反馈、结伤/覆盖phase；Medium：异常history kind:role被展示成具体牌 | night phaseRevision clock＋stage前后/await及gateway后守卫，interrupted union让manager短路；shared精确camp-only reader由profile/DTO/console/front共同使用，坏值Unknown；实际取消/往返/同phase及畸形回归 |
| L/D：review_i18n_delivery | API参数/ctx迁移明确；“无主动工具”与G02 gift能力措辞冲突                                   | 最新第4参options/返回union/手工ctx必填在契约列明；“无原生主动工具”中英一致，giftSeer独立判例通过                                                                                                       |

独立A复查core20／236，原两Medium关闭，确认clock/union和reader/DTO/文档迁移；L先11／86、后20／236与front6／96，随后只读复查契约及记录≠模型收到；R规则卡先0阻断，源码/8场景人工oracle复查0执行或玩家隐私阻断；提醒事件直播privateFlag不控制独立operator prompt/thinking输出，卡/契约已限定事件行并链接日志矩阵。代理不重复全矩阵/全release，主代理证据独立列明。

## 最终完成门槛

- `release:check` **820／60313／107文件、0失败、exit0**，type/deps/boundaries/i18n（仍57精确例外）/全部test/smoke通过，日志 `/tmp/awa-p5-grave-release-final.log`。基础50＋P5四项30＋54＋48＋48＝**230实际本机双语SDK/ACP/混合完整局**与全部严格Tape按最终source回归；没有在活跃对局中改生产源码。
- core20／236、最新随机40局/全部重放＋终端条件显示共9／385、配置8／50通过，日志 `/tmp/awa-p5-grave-{core-final,final-sim-console,config-final}.log`。
- frontend83／711/type/build通过，日志 `/tmp/awa-p5-grave-front-{tests-final,type-final,build-final}.log`；最后目录状态登记不改变名字/规则/画面。
- 首版actual Chromium20通过后，PNG目视发现英文12人字幕条遮下排Hunter/Gravekeeper Sheriff部分文字。压缩/上移竖向席位环，保完整名字和徽章；actual bbox门槛逐席要求完整卡片在字幕上方。最终全部**20通过**，日志 `/tmp/awa-p5-grave-e2e-final.log`；不是只改CSS或以markup单测当浏览器验证。
- 最终中文frame4420 `/tmp/awa-p5-grave-zh-final.png`、英文frame6580 `/tmp/awa-p5-grave-en-final.png`均生成exit0并目视正常。来自真实12人SDK档；第一反馈只有exile1 dead，第二反馈已有1/3/4/5/7 dead，无额外死亡/预先winner，原名/完整英文role及Sheriff可读；两个night结果只camp标签。未改MP4编码管道，不重复未变P3/G04视频编码证据。
- 当前目录**11 verified／53 planned**，规则/配置/英文入口/进度与[P5阶段验收](p5-activation.md)对齐；本地链接和git diff --check通过。

三路最终0剩余阻断：A/L原问题与接口/目录复查已闭，R独立core20／236和8scene人工oracle/契约已闭；其汇总提醒将White目标复合毒的人工专项与actual caster待毒拒绝区分，P5阶段记录已精确注明，没有为措辞额外扩大矩阵。

本角色及P5交付完成，门槛已由主代理执行、三路复查关闭。P6–P10/53角色/严格发布组合矩阵、有界真实模型质量和长局门槛保持目标，未提前宣称完成全部64/22或读取用户认证。
