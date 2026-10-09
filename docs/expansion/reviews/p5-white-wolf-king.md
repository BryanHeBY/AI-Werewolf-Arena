# P5 白狼王交叉审查

## 范围与主代理证据

[冻结卡](../rules/awa-white-wolf-king-v1.md)与[契约](../white-wolf-king.md)：第九项角色、带人工具/独立死因/机会、并发选择的生命/资源校验与最小有效ID、无吞待夜死、合并初批/遗言/徽章/追枪/最后判胜、中英提示/视角、公开/私有/Tape/前端和实际通路。未提前完成骑士/守墓人或后续55项。

- 最后核心22／319通过（四窗口、待夜caster刀/毒与下一候选、null/徽章、Guard真实保护不挡、目标待刀+毒合并禁枪、资源/角色/目标生命/ref/phase竞态、中英正确允许工具和遗言模板）；日志 `/tmp/awa-p5-white-wolf-core4.log`。
- 现有死亡/普通自爆回归52／678通过，日志 `/tmp/awa-p5-white-wolf-foundation.log`；类型/source扫描通过，仍57精确AST例外。
- 9case×SDK/ACP/混合×中英＝54实际本机完整局，27／6559及逐局严格Tape通过，日志 `/tmp/awa-p5-white-wolf-wire.log`。四窗口Hunter链、null两日、pending刀/毒caster下一个普通候选、狼王→Hunter链及十二人两日均为固定seed/角色/动作与字面outcome/成员/存活/原因/窗口/检查点/事件/私有视角；不是外部模型策略质量。
- 两板各16显式active风格受限seed，自然结束/零修复、实际白爆正覆盖，逐局重放2／42通过，日志 `/tmp/awa-p5-white-wolf-sim-active.log`。最初混合风格六人16seed没有实际白爆，改明确主动策略与首日合法概率，不移除技能正覆盖断言；选择仍只有本人DTO和具名RNG。
- 两个public board已加载，未知参数/未实现Knight拒绝。共享组件和语言文本变更由最终release同时回归已有七基础/狼王。
- 前端73／585/types/build通过，日志 `/tmp/awa-p5-white-wolf-front-{tests,type,final-type,build}.log`；实际Chromium14（含两语真实档案同时两死→Hunter→终局）通过，日志 `/tmp/awa-p5-white-wolf-e2e.log`。
- 实际两语frame1990 PNG `/tmp/awa-p5-white-wolf-{zh,en}.png`已目视：白狼王与Hunter两席同事件变dead、普通狼仍alive、未提前winner、正确英文/中文事件及原名。输入为真实SDK完整局。未变视频编码器，不重复已有P3/G04编码；按同frame纯函数和实际Player/PNG验证新画面。

## 已发现并修正

| 审查路                     | 发现                                                                                      | 当前修正                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R+T / review_scope_rules   | pending-night caster吞毒/吞刀歧义；基础Hunter/King三cause卡与新增WhiteWolfBlast例外不一致 | 卡明确全部待夜死caster不能发动，收集/接收不回传隐含知识，PhaseManager无效应false拒绝并继续高候选；卡/提示/因表同步独立WhiteWolfBlast、复合毒禁止 |
| L+D / review_i18n_delivery | public blast_only模板仍只许ordinary工具，实际新工具矛盾；共享遗言文案漏白爆和狼王枪       | 以本轮真实tool填模板；新旧两语字面正负测试；共享遗言说明明确合并夜死目标不获遗言                                                                 |
| A / review_arch_tests      | 架构/资源/类型/公开API及真实门槛                                                          | typed selection/callback返回与无commit意图、旧summary ID兼容已在契约写明；最终审查结论收尾时补                                                   |

普通首日选举发生在夜死公告前，六人oracle应有六名nomination（不是已剔夜死后的五名），首轮fixture期望已纠正为冻结基础时序，没有改生产规则。API不是只换文件名：真实commit唯一提交资源/公共事实/提案，中央resolver唯一标死/链条，PhaseManager拥有私有pending事实/推进及判胜。

新源码最终完整release及审查关闭在提交前记录；初步绿不替代角色全门槛。旧录制不放宽source/lock/rules兼容，玩家原文不重写，未动用户configs或认证。

最终三路复查0剩余阻断：A独立core22／319，确认typed selection/引用与生命再验/false继续候选/无效应拒绝与中央死亡权；R独立22／319，原吞待夜死和因表不一致关闭、五类+四窗口完整字面oracle核算，遗言同一actor限定修正；L独立core20／310与front4／24后复查正确工具/遗言模板和API/9／55目录闭合。代理未重复完整矩阵或浏览器，主代理门槛仍另列。

初版full717的两个失败是旧狼王配置负例仍将已注册白狼王视为未实现，改真正planned Knight后配置4／16通过；没有松开未知角色/参数校验。随后full716／1仅全仓AST检查超过Bun默认5秒，范围/精确例外/断言不变，该整仓I/O/解析测试单独设30秒并定向2／7通过。生产deadline和资源回收期限没有变。

## 最终完成门槛

最终release:check717／45747／99文件，type/deps/boundaries/i18n/test/smoke全部exit0，日志 `/tmp/awa-p5-white-wolf-release-complete.log`。原80＋白狼54＝134实际本机SDK/ACP/混合中英完整局及全部严格Tape按最终source执行。核心22／319、配置4／16、active受限32局2／42、前端73／585/types/build、实际Chromium14与两语PNG通过；来源/保护/吞夜死/信息/窗口/API/文案审查均关闭。

没有在对局进行中改生产源码。最后同一玩家遗言措辞不改显示代码，复用同批实际浏览器/PNG与未变编码管道证据。9角色verified限定各自卡及已验板子范围；55计划角色与P5骑士/守墓人/P6–P10仍未完成。所有changed本地链接与git diff --check通过。
