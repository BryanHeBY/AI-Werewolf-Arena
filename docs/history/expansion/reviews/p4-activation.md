# P4 公共玩法基础最终验收

## 交付范围

P4交付A01/A02、M21、G01–G04及基础卡差异修正。基础七项仅在 `awa_classic 1.0.0` 的以下声明范围登记 `verified`，角色注册仍由真实profile决定；64项目录中剩余57项为planned，22机制的特殊变体继续对应P5–P10。不是任意人数、牌组、同名赛事版本或所有组合都已验证。

| P4要求         | 当前实现与独立证据                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01统一接收    | [共同接收](../action-reception.md)、[审查](p4-a01.md)：SDK与ACP同schema/业务拒绝与更正，accepted与applied区分，单一ActionTurn与回合/连接隔离，错误不双重生效                                                                |
| A02资源与预算  | [资源契约](../runtime-resources.md)、SDK/ACP/mixed/runner四份审查：provider FIFO作用域、排队/初始化/重试共deadline，超时/迟到/取消/强制进程回收，正PID/ESRCH与MCP端口释放；原运行及清理错误分别保留                         |
| M21输出一致    | [日志矩阵](../runtime-display.md#p4-m21sdk--acp-日志开关)、[审查](p4-m21.md)：日志开关不改变私有录制，模型原文保留，SDK/ACP同语义                                                                                           |
| G01知识权限    | [狼队契约](../wolf-team-access.md)、[审查](p4-g01.md)：互认/夜聊/刀权分离，历史事件按发生时授权，不借后续状态追溯扩权                                                                                                       |
| G02查询与资源  | [查验](../inspection-results.md)、[能力实例](../night-abilities.md)、[女巫](../witch-resolution.md)及三份G02审查：类型化结果/阵营分离、sourced实例生效/失效/调度、刀口/耗尽信息与16保护组合                                 |
| G03死亡所有权  | [来源](../death-causes.md)、[World授权](../death-action-authority.md)、[死亡链](../death-chain.md)及三份G03审查：独立原因、shot/pass/invalid、末神枪、临时窗口到消费点、整波先标死，遗言→警徽→死亡技能→追加波次→判胜        |
| 公共资格与窗口 | [参与资格](../public-participation.md)、[四窗口](../self-destruct-windows.md)及对应审查：白痴一次翻牌/永久资格、空候选/全退/零票、可配徽权，首日/天亮/发言间隙/投票前自爆真实位置与中断收尾                                 |
| G04结果闭环    | [核心](../victory-outcomes.md)、[记录展示](../victory-record-display.md)、[两份审查](p4-g04-display.md)：获胜membership独立于真实camp，三种primary/额外claim/名单/检查点，一次封盘，manifest/public/终端/审计/前端/视频一致 |
| 双语与兼容     | shared game-text、每局locale与display、受控i18n gate、实际wire/schema/error两语、旧公开/玩家v2原文；内部Tape2对source/lock/rules严格，旧1明确拒绝                                                                           |

能力赠予、个人／关系目标等合成profile案例检验公共机制契约，不能当作商人／机械狼／丘比特已实现；这些真实角色完整行为与Tape在对应阶段交付。

## 已验证板子与完整对局

- `six_player_mvp`：人工S01/S04，`twelve_player_standard`：人工S02/S03，实际SDK/ACP两语及两种座位分配的混合provider，两语并行局；全部literal动作不借World算答案，手写角色/存活/技能/顺序/完整结果与私有输入核对。
- 四个单窗口六人合成变体：每窗口×SDK/ACP×中英共16实际完整局，检查位置／首日待夜死／警徽／中断，并逐局严格Tape重放。连基础/混合/并行共50实际本地完整局。扩展窗口末神枪的证据来自人工真实PhaseManager专项；实际基础十二人S02/S03另核对枪，不能把它们计成这16个没有Hunter的窗口通路局。
- 另25 seed六人和25 seed十二人受限观察模拟，实际技能分支、零修复及每局Tape；这些用于补充随机覆盖，不代替手写oracle。
- `twelve_player_windows`公开示例有实际配置加载及对应四窗口基础判例。没有把该示例单独声称为已跑的额外十二人四窗口完整局。
- public展示夹具是合成个人＋关系胜利，不是新增角色对局。实际Chromium10交互、zh PNG/en MP4及单测门槛见[G04展示审查](p4-g04-display.md)。

真实接入指实际SDK HTTP/ACP进程/session/注入MCP及引擎，模型响应由本机合成服务给定，不调用用户认证或外部模型。T6真实模型策略质量、P10长局/更多组合/发布候选评测仍未执行，不能被本P4验证登记替代。

## 登记与当前文档

共享目录七项从implemented改verified；[目录回归](../../../backend/tests/runtime/role_catalog.test.ts)对implemented/verified都检查真实profile与规则卡。基础卡与角色目录引用本验收；功能文档统一现行Tape2，并清理已经关闭的“待修”措辞。历史reviews计数/边界不改写。

`witch-resolution.md`此前误复制旧基础卡，已还原女巫专用目标/资源/视角/保护契约与正确链接，规则规范仍只有一份。S03文档分清原完整场景最终存活oracle与死亡链专项人工徽章序列，未声称新增了不存在的整局断言。

25 seed场景执行25完整局＋25严格重放，显式30秒测试预算替代Bun默认5秒；根据G04并行渲染时的实际默认超时设置，动作/状态/分支断言、生产deadline和资源回收期限均未放宽。登记前定向5测试／272断言通过。

## 最终门槛与交叉审查

G04最终后端633／34433全release与smoke、前端67／539/types/build、真实Chromium10以及实际渲染已通过。目录登记改变共享源码指纹，阶段最终完整门禁重新生成并逐局重放Tape；结果随本记录收尾。

A审查架构/资源/真实门槛，R+T审查基础规则/oracle与支持范围，L+D审查双语/公开数据/当前文档与登记。问题修正、复查及最终门禁记录后才提交本阶段登记；后续从P5狼王、白狼王、骑士、守墓人继续。

最终阶段后端release:check再次633测试／34433断言／91文件通过，types/deps/boundaries/i18n/test/smoke全部exit0，日志 `/tmp/awa-p4-activation-release.log`；定向5／272见 `/tmp/awa-p4-activation-target.log`。没有在实际对局运行中修改生产源码。共享目录只改变状态标签，前端名称/数据/画面语义未改，复用紧接前一笔的实际前端/浏览器/视频门槛，不重复无变更编码。

### 最终独立结论

| 审查路                     | 最终结论与修正                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A / review_arch_tests      | 0阻断；架构、注册许可、T1–T5和50实际局／Tape证据匹配；独立目录3／153及diff check通过，核实最终633／34433日志。16窗局不混入Hunter证据已修 |
| R+T / review_scope_rules   | 0阻断；基础七项按声明范围verified，误复制女巫页／canonical卡／规则卡两status检查已闭；S03与枪专项／窗口wire范围准确，未重复full/browser  |
| L+D / review_i18n_delivery | 0阻断；配置当前登记、G04展示已交付和Tape2/旧1拒版说明已同步；用药不新增狼队视角且保独立合法权限，目录／双语／数据及T6/P10范围一致        |

当前文档相对链接与git diff --check通过；三路发现均修正并复查。P4完成，完整P1–P10目标继续P5。
