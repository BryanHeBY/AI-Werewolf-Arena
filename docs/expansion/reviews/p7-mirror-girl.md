# P7 魔镜少女功能审查

规则：[AWA Mirror Girl 1.0.0](../rules/awa-mirror-girl-v1.md#mirror_girl)，冻结笔 `889bfc6`；已交付作用域基础 `ed30c58`。本功能在现role_check增加mirror policy，原生600 optional、整局按实例稳定ID禁重查；Garg180/必验/原生刀、Psychic600/repeat保持分别规则。

## 独立审查、修正与复查

- **A（review_arch_psychic）**：闭合三policy、按能力贡献/实际实例预收去重处理器、Prompt/Baseline显式映射、原native重apply/复活不reset、转出后retired不补原生均按既有职责实现。无需新调度器。
- **A隐私意见**：仅state白名单还会从DTO顶层元数据与disclosed source泄露未来内部字段；改projectNightAbility完整元数据白名单，projectAbilitySource按native/gift/copy/transfer字段选择，显式披露也不放未知字段。ability_changed feed复用该source投影且事件元数据白名单，God原对象/事件保留。仓库注入top/source/state/history/result哨兵，真实Observation两位置、status与enable/disable事件均裁剪。
- **A输入意见**：fresh history只验length会把`{length:0}`当[]；新Mirror grant/copy明确检查Array.isArray、长度与空数组附加key，拒假数组及decorated[]，空state四key、null lastTarget/lastDay、uses0/闭夜null/disabledfalse。transfer保完整历史和资源；不是无条件copy旧报告。
- **R/T（review_rules_psychic）**：独立98/654初核来源/实例/转移/复活与有限配置；后续核心补最后target在gateway/label后进入历史时no_targets closure、cancelled null与actor/target原life/state/policy撤权。八literal场景按事件顺序手算终局与全部历史，无依执行结果生预期。新Mirror及shared scope/旧Garg/Psy/配置105/700过。
- **R/T字面修正**：king_badge第二徽来自直接放逐，reason是`voted_out`，追加枪死者的`voting_death`不是同一步；仅修人工oracle，不改引擎badge时序。第二候选实局全部通过。
- **L/D（review_rules_gargoyle）**：独立4/152，三policy提示/目标/Baseline与真身份分离；状态/report未知字段裁剪，gift不改名字/人格/胜利；真native报告转出后不借另一个gift最新报告，重apply不补原生。六/十二样例是AWA普通狼版，不冒原觉醒隐狼镜隐迷踪。
- **根代理呈现修正**：验尽历史时仍有存活玩家，旧no_targets文案“No other living targets/没有其它存活目标”会误述人数。改为“No eligible living targets/没有可查验的存活目标”，旧Psy/console字面期待同步；机器reason仍no_targets，历史/原话不改。

## 独立预期与实际接入

八类×SDK/ACP/混合×zh-CN/en＝**48本机完整局**，每局strict Tape，Actor只获自己的脚本而非全局身份/seed。覆盖首夜救Mirror、skip、禁重复拒后新目标、Good/Wolf终局、十二三夜不同对象+猎人/毒/警选、狼王自刀/枪杀Mirror与两次徽转、Hidden查前旧Villager报告不回写/后夜查新对象、首夜skip后接刀才查Hidden、五目标全部查过后第6/7夜不请求及第7夜狼胜。末局不再有后续请求，resources/PID回收及无fallback/error由共享实际controller断言。

字面六人种子复用 `psychic-six:465` / `psychic-hidden:256` 的相同位置替换Mirror；十二 `psychic-twelve:731742`；king普通唯一角色变化后纯deal定位 `mirror-king:791`，WK1/W2/M3/Seer4/V5/6。不改随机装配或由回放结果推出winner。八类oracle已由R逐类手算，原生日次/请求数量和最新报告marker都明确。

候选新48局＋40受限seed与旧Garg/Psy72局的gate `/tmp/awa-mirror-wire2.log` **62/21984/4 files** 通过；God/本人/其它玩家分账与schema/PID/每决策/每checkpoint严格检查。每例20 seed `mirror-random:0..19`，两板自然结束、0非法/回退、真实inspection/skip正分支、没有历史重复，每局strict Tape。旧72局是本笔重新验证的受影响范围，旧总740历史不是本笔全重验。

## 画面与最终门槛

新增实际合成fixtures skip/exhausted/twelve/king_badge；前端147/1278/23 files、type/build候选通过。unit纯frame保持role/camp/生命、报告与无目标闭夜不致死、死Mirror成员和两个徽转分离。E2E新增四例包括N6全6活/无提前赢家、十二第三报告仍原Mirror/Guard身份、终局每席位bottom<caption.top。PNG中文exhausted presentation frame8830、英文twelve第三报告frame6760，root已看角色与字幕无遮挡；L/D独立复查及最终browser终态接续登记。

最终 **21 verified/43 planned** 源码已冻结，以下证据已核终态：

| 门槛 | 当前证据与范围 |
| --- | --- |
| 后端受影响门槛 | `/tmp/awa-mirror-verified-gate.log` **1065 pass/0fail/34931 assertions/95 files**，exec terminal exit0。全部engine/AI/recording/contracts/presentation、角色配置/目录、新48和旧Garg/Psy72完整局、40seed及每局严格Tape；不是全backend release |
| 静态 | `/tmp/awa-mirror-verified-{type,deps,boundary,i18n}.log`，所有exec terminal exit0，仍57精确源码例外 |
| 前端 | `/tmp/awa-mirror-verified-front-unit.log` **147/0fail/1278/23 files**，type/build均terminal exit0 |
| 实际PNG | `/tmp/awa-mirror-exhausted-zh.png` frame8830，`/tmp/awa-mirror-twelve-en.png` frame6760；两render terminal exit0、root/L独立view，无字幕/角色遮挡 |
| Chromium | `/tmp/awa-mirror-browser-final.log`，**62实际Chromium全部通过（2.9m）**，exec terminal exit0；首轮60pass/2fail不算全过 |

首轮两个旧Spirit用例的dead count因根代理文本替换范围误扩为0；按其既有真实fixture恢复1，仅新Mirror验尽目标N6帧保持0。生产投影正确，没有改历史fixture来适配断言，最终全62已重新验证。L/D独立PNG：中文第6夜全6活/无winner/eligible文案准确；英文第3夜Mirror5仍Sheriff、8仍Guard、五个已死亡席位/无提前winner；独立scope/未知字段probe6/188通过。A两隐私/输入意见与event路径复查0残留，R八literal oracle R0；最后交付登记交原审查者核对最终日志。这不是P7整阶段或全backend release。

最终登记：A/L/D直接核1065/34931/95、147/1278/23、62 Chromium、catalog21/43与当轮120/历史788范围，均0残留阻断且支持功能提交。R/T核同范围R0，建议的契约历史时态/P7余两项/五个死席措辞已收口并由原审查者最后复查，最终R0支持功能提交。三路全部闭环。

P7仍余觉醒隐狼/黑市商人以及P8–P10、64角色/22机制组合矩阵、长局与T6外部模型。后续觉醒隐狼笔还必须交原镜隐迷踪联合板，不因本笔四普通狼样例冒支持。用户configs/认证未读写，外部模型未调用。
