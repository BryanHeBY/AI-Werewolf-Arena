# P6 狼美人交叉审查

范围：[规则卡](../rules/awa-wolf-beauty-v1.md)、[契约](../wolf-beauty.md)，普通魅惑／夜梦／死亡源／末狼屠边顺序、关系生命周期、共同提示／接收、中英、记录与复盘。本角色完整门槛与三路交叉审查已完成；不据此完成P6其余角色或P10发布范围。

## 已关闭问题

| 路径 | 发现 | 修正与独立复查 |
| --- | --- | --- |
| R/T | Night／Day Guard+Heal语义、合法skip消费／邻接、特殊判胜全局抢先有歧义 | 冻结两期普通保护均不挡；合法skip清关系耗本夜；末狼例外仅Side条目内，保持City/Side次序。核心25／252独立通过 |
| A | hook await缝换目标生命或撤绑定，裸ID先杀、新binding后校验太晚 | hook只返原binding令牌；同步claim通过才派生Charm死因／Night传播／标死。4真实微任务撤权＋samewave共5／18独立通过，原High关闭 |
| R/T | 同波Hunter先刀死遗言、后补Charm禁枪，与“无遗言”绝对文案冲突 | 明确已完成原初批遗言不回滚，补因只禁未执行技能；实际words[1,5,2]、charm1→5、gun0、无重复additional判例；独立core30／270 |
| R/A/L | Runner stopping把晚到结果变null，可变合法skip并消费 | 保原Abort事实；checkpoint/Tape照录取消，外层不重复自身stopReason，外来错误保留。真实Night2heldCharm+timer flush故障两case覆盖null/late charm:null，独立2／14；主代理增强严格Tape重放后2case继续全过 |
| L/D | 模型未获通用末狼例外／条件顺序，未行动显示day0 | 中英brief/state加入通用规则，无当前资格/count/candidate；初始day为无／None。独立复查关闭，英文god统一special role |

三路已完成首轮、修正及正式契约／完整场景范围复查，0剩余阻断。R独立core34／292并核对12literal；A独立新增判胜／循环／徽章8／34，确认取消严格重放日志与API；L独立原core30／270及取消2／14后复查正式提示／契约／信息／交付范围。各代理只读，没有修改实现或宣称重复全矩阵；最新数字与operator日志开关说明提醒均修正。

## 已运行门槛

- 最终人工 core **34／292**，`/tmp/awa-p6-beauty-core4.log`；涵盖生命/关系/state撤销、死因/保护、隐私、末神/末民/未消灭整侧、多魅惑循环与Charm-only禁递归，四条件末神判胜均验徽章1→2→4结束后才judge。
- 真实 runner 取消档案／严格重放、并发失败聚合及公开配置 **8／94**，`/tmp/awa-p6-beauty-cancel-tape.log`；原始失败与取消分离，所有决定封口，前缀状态重放一致。
- 12字面case三传输两语 **72完整局，36／10413**全部通过，`/tmp/awa-p6-beauty-wire-final.log`；首轮同次随机12前20无Charm死亡导致1门槛失败，没有删除正断言。最终六人0–19／十二人20–39的**40seed／全部Tape，2／52**通过，`/tmp/awa-p6-beauty-sim.log`。
- 公共配置/目录/两语终端 private flag专项 **16／572**通过，`/tmp/awa-p6-beauty-config-console.log`；旧配置“计划角色拒绝”改仍planned的bear，不再拒刚实现Beauty。
- 前端**89／781**与type/build通过，`/tmp/awa-p6-beauty-front-{tests2,type,build}.log`；实际完整局档中blocked保5活、末狼死亡也获胜。首版测试误把raw事件序号当压缩展示帧位置、漏dead获胜者6，已修人工预期，不改生产结果或显示管道。
- actual Chromium **28通过**，`/tmp/awa-p6-beauty-e2e.log`，新增两语保护与特殊末狼共4case；事件／席位／死亡获胜者／caption与座位bbox不重叠均验，输入为本机SDK真实合成完整局God档。
- 实际中文保护frame1450 `/tmp/awa-p6-beauty-zh.png`、英文末神特殊胜利frame2170 `/tmp/awa-p6-beauty-en.png`均render exit0且目视正常。中文1／6已死、5受梦保护仍活；英文1已死且显示Winner，2／3已死、4／5／6存活，特殊原因与exile_settled字幕完整无遮挡。日志 `/tmp/awa-p6-beauty-render-{zh,en}.log`；本批未另外运行MP4，既有视频管道与早期P3/G04证据保留。

## 最终完成门槛

最终 `release:check` **963／79767／117文件、0失败、exit0**，type/deps/boundaries/i18n（57精确例外）／全部tests／smoke通过，`/tmp/awa-p6-beauty-release.log`。原284＋狼美人72＝**356实际本机SDK/ACP/混合双语完整局**及全部严格Tape按最终source回归，未在活跃对局中修改生产源码。runner取消与原角色回归同时通过。

前端89／781/type/build、actualChromium28、中英实际PNG均完成；三路最终0剩余阻断，数字／术语／operator日志范围提醒已修。目录**13 verified／51 planned**与卡／契约／配置／中英入口／进度一致；本地链接与git diff --check通过。P6尚余熊／隐狼／石像鬼，P7–P10和T6保持完整目标，未调用外部模型或访问真实认证、未修改用户configs。
