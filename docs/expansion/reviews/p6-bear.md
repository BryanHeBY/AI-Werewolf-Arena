# P6 熊交叉审查

范围：[规则卡](../rules/awa-bear-v1.md)、[契约](../bear.md)。入夜匿名样本、完整死亡／徽链后公告、原生命／时钟、独立感知策略、单原生熊、共同提示／记录／中英展示。按[交付指南§3](../delivery.md#3-每个阶段的验收运行)执行本角色功能提交门槛；P6阶段结束再执行全部已支持角色／板子回归，不将本角色交付当整阶段或发布完成。

## 三路发现与修正

| 路径       | 发现／边界                                                                     | 修正／复查                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| R/T        | 官方Dawn存活邻居与组织者入夜版本不同；首日早爆合并Night+Day不属于night_settled | 卡明确取组织者版，邻狼本夜死亡不重算；完整合并波后／day_interrupted前发布一次，纯Day White带熊quiet，实际判例                   |
| A/R        | 需要原World／原Role/state/life版本及取消链，原生单熊不可只在CLI限制            | manager帧绑定World，发布点再验，公开后的history只day/bool；profile maxCount1同时parse/directbootstrap聚合限制，重复条目也拒绝   |
| 实际core→A | 竞选取消后旧Election仍启动退水／票                                             | DayPipeline向Election传epoch回调，每await/gateway／聚合／交接再验；4真实选举点samephase取消不启动后续请求、不晚公告／发言／授徽 |
| L/D        | “无主动技能”会误导G02获赠能力使用者；API/感知/数量需准确范围                   | 改“无原生主动技能”；新增maxCount、独立detectableByBear及可选ElectionInput.isCurrent契约，未来多熊／转化／隐藏狼不提前声明       |

首轮R独立36／215通过并核来源、特殊死链；A独立35／212及三个数量限制探针确认0阻断，再独立World防跨引用1／3通过；L独立core＋配置38／229通过，原提示措辞已修。正式契约／完整矩阵范围三路复查均0剩余阻断：R逐案核13literal，A核内部API／clock／World／native maxCount，L核实际匿名反馈／提示／记录／前端及范围。代理只读，不冒称重复全matrix。

## 已运行门槛

- core **36／215**，`/tmp/awa-p6-bear-core4.log`：环绕／死者跳过／seat与ID／单目标、取样后邻居变化、真Camp与Seer伪装分离、World/ref/version撤权、Night刀毒梦Charm枪quiet、早爆合并波、末King枪杀唯一神熊／徽章→quiet→Good、全部选举点取消。
- public数量／空参数／目录与两语公共console连core **52／809**，`/tmp/awa-p6-bear-core-console.log`。
- 13literal×3传输×2语＝**78完整局**及所有严格Tape；两个public各20seed自然／0reject/fallback／实际roar/quiet及所有Tape，同次 **41／9214**全过，`/tmp/awa-p6-bear-wire.log`。first-day各竞选轮输入无待公告，NativeBear实际history随已公布更新，所有玩家档公共payload严格只day/bool；原狼牌／额外Night死亡和已死玩家获胜有独立人工预期。
- 前端 **93／848**、type/build通过，`/tmp/awa-p6-bear-front-{tests,type,build}.log`。实际God档公告前后席位完全一致，终局死亡熊/猎人保获胜归属，raw数据和确定性frame无改写。
- actualChromium **32通过**，`/tmp/awa-p6-bear-e2e.log`；新增两语／两实际档的4case验匿名quiet／席位／死亡获胜者与字幕bbox。中文末King夜枪后的quiet frame1090 `/tmp/awa-p6-bear-zh.png`、英文12人第二日报告frame4870 `/tmp/awa-p6-bear-en.png`均render exit0且目视正常；中文熊1／王2已死、3持徽，英文2／3／4／7已死、5熊持徽，公告前无winner，字幕／角色无遮挡。日志`/tmp/awa-p6-bear-render-{zh,en}.log`，本批不另称MP4测试。

## 最终完成门槛

最终源码上的受影响引擎／各配置／角色目录／中英终端与共享契约 **492／10133／51文件、0失败、exit0**，`/tmp/awa-p6-bear-regression.log`。类型／依赖／边界／i18n扫描（57精确例外）exit0，`/tmp/awa-p6-bear-{type-final,deps,boundaries,i18n}.log`。覆盖所有engine目录及本次变化的解析／旧计划角色拒绝／profile／人数限制／Sheriff取消／console，未用单熊判例替代既有机制回归。

本角色最终登记源码的**78 actual双语完整局＋40seed／全部严格Tape，41／9214、0失败、exit0**，`/tmp/awa-p6-bear-wire-final.log`；没有在活跃对局中修改生产源码。frontend93／848/type/build、Chromium32、中英PNG全部完成，三路0剩余阻断。目录**14 verified／50 planned**、卡／契约／示例／中英入口／进度一致；local links与git diff --check通过。

本角色采用delivery§3功能提交门槛。P6结束必须运行完整`release:check`及全部已支持角色／板子矩阵；上一笔963全量结果是其当时源码的历史证据，不能代替当前源码的阶段验证。长局／T6／P10门槛继续按相应阶段执行。未读取真实认证或修改用户configs，P6隐狼／石像鬼与P7–P10继续。
