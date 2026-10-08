# 实施进度

用户于 2026-10-07 明确授权启动完整目标，P0 结束后的等待要求已满足。持续目标覆盖 P1–P10；长期候选不自动纳入。

| 阶段 | 状态 | 当前证据 |
| --- | --- | --- |
| P0 | 完成 | 文档 commit `5337194`，三路审查闭环 |
| P1 | 完成 | `facea9c`共享目录；`87af121`机制参数执行；v2完整配置、迁移/检查及玩家绑定交付；193后端+33前端测试，三路复查0阻断 |
| P2 | 完成 | T01逐局随机/T02严格脚本/T03受限观察/T04动作录制与兼容回放；227后端+33前端测试，三路复查0阻断 |
| P3 | 完成 | I01–I04、诊断/CLI与受控源码扫描；实际SDK/ACP中英完整场景与Tape重放、前端/视频门槛；英文入口开放 |
| P4 | 完成 | A01/A02/M21、G01–G04、白痴/警长及四窗口闭环；七基础角色verified，双语50实际本地完整局/Tape、终端/审计/前端/视频一致，见[整阶段验收](reviews/p4-activation.md) |
| P5 | 完成 | 狼王/白狼王/骑士/守墓人逐项交付；11项verified，230双语actual局/Tape、820后端/83前端/20浏览器通过，见[阶段验收](reviews/p5-activation.md) |
| P6 | 完成 | 五角色与三路审查闭环；16项verified，最终全量1176测试／542实际双语整局/Tape、103前端／42浏览器通过，见[阶段验收](reviews/p6-activation.md) |
| P7–P10 | 未开始 | 按路线依赖推进，不把目录登记当成实现 |

## P1 已确认决策

- 资料目录与运行许可分开；未注册 profile 不可进入主动对局。
- 配置格式 `version: 2`，规则集标识与规则版本另行保存。
- 保留 board/rules/mechanisms/roles 的结构块，正常入口仅加载 `boards/<id>.json`；旧格式由显式转换处理。
- locale 为 `zh-CN`/`en`，seed 为非空字符串，语言/玩家资料与运行flags分开。
- 基础七项登记为已有实现，规则卡列出规范和待修差异，暂不标 verified。

后续每次阶段提交补充 commit、实际验证、审查记录和未决事项。

阶段证据：[C01 审查与快照验证](reviews/p1-c01.md)、[C02–C04配置与执行审查](reviews/p1-c02-c04.md)。

## P1 配置交付

配置实现commit `7562609`；公开格式及命令见[config-v2.md](config-v2.md)。板子、玩家资料、运行flags、provider认证各有明确职责；正常读取只接受完整v2，迁移保留有效旧执行语义，错误/检查报告脱敏。本地只转换板子并保留备份，没有改动密钥、模型或人格。

P1交付时尚未开放seed执行、英文执行/展示和混合传输，分别随P2/P3/P4验证后启用；64目录中57项仍是计划状态。阶段完整验证未调用外部模型，固定种子模拟门槛随P2建立后运行。

## P2 T01

[随机契约](randomness.md)已接入发牌和逐夜狼人顺序，显式seed可运行，未指定时记录实际生成seed。六人/十二人各25seed的交错游戏与重复动作事件等价；固定牌仍严格验多重集。runner实际保存指定/自动seed及玩家名字，使用manifest seed重建牌面成功，公开格式不透传随机元数据。T02脚本、T03受限模拟和T04严格失败录制/回放继续推进。

T01实现commit `47bca25`；阶段证据：[三路审查](reviews/p2-t01.md)，后端release检查199测试通过，0剩余阻断。

## P2 T02

实现commit `c7ae448`。严格脚本玩家及[四个人工完整场景](foundation-scenarios.md)完成，覆盖成功守护/空守、私人查验、药/枪、警长/白痴、遗言、自爆和自然终局。核对人工资源/存活/技能payload，manifest/公开档/玩家视角及受众；正常零拒绝/回退，失败独立收尾保留三种错误。独立快照release检查205测试通过，三路[审查复查](reviews/p2-t02.md)0阻断。

## P2 T03

实现commit `3063fbb`。[受限观察模拟](simulation.md)已交付，本人DTO/已授权身份/公开存活与world隔离，决策随机能力不含seed。基础两板子各25局自然结束、零拒绝/回退、关键技能实际分支覆盖。模拟CLI只读板子并保存唯一记录目录。后端release检查211测试通过，三路[复查](reviews/p2-t03.md)0阻断。

## P2 T04

实现commit `dda3f88`。[动作录制/回放](reproduction.md)保存版本、实际配置/发牌/动作、检查点和原始领域事件，严格核对领域事实且拒绝不兼容版本。必要文件和前缀失败不会被吞掉；closing防后台覆盖，CP失败保原错并阻止假封口。并发失败/取消以及合法重试按实录响应与开启边界回放，部分原因与错误来源核验。后端release检查227测试和前端33测试通过，三路[复查](reviews/p2-t04.md)0阻断。P2完成，持续目标从P3继续；没有把57项计划角色或英文链路标记为已实现。

## P3 I01

实现commit `f4e0d5f`。共享game-text与[中英文本契约](i18n.md)交付。角色名共用64项目录，默认技能说明共用中英模板，定制Profile/玩家内容保留原文。key/参数/缺译检查与不可变逐调用locale测试通过，后端release231测试、前端33测试，三路[复查](reviews/p3-i01.md)0阻断。英文全链路仍待I02–I04，不把目录资料当作执行支持。

## P3 I02：工具协议

实现commit `0ec4348`。SDK与MCP游戏/审计实际工具共用逐任务语言builder，完整输入schema一致，默认可省略字段保持输入语义。ACP子进程仅接收本任务语言，合法工具/回合/证据检查未改变。真实本地4MCP并发与4SDK HTTP验证通过；后端release237测试0失败。英文整局、提示/拒绝、终端和审计摘要仍继续推进，本批不宣称P3完成。审查结果见[工具协议审查](reviews/p3-i02-tools.md)。

## P3 I02：共享玩家提示

实现commit `e5d1d72`。内置系统/行动/重试/规则/私有状态模板统一中英，SDK与ACP通过共享策略接入逐局语言。七角色十四阶段、原文保留、定制注入及中英并发测试通过；SDK实际HTTP携带英文玩家提示。后端release246测试0失败；英文执行仍受P3全链路门槛约束。三路交叉审查与修正记录见[玩家提示审查](reviews/p3-i02-player-prompts.md)。完整拒绝/审计/终端与I03/I04继续推进。

## P3 I02：结构化拒绝

实现commit `0705807`。内置校验返回明确RuleViolation和共享稳定code；SDK/ACP游戏/审计入口提供逐任务语言解释，局部schema诊断与控制面错误也接通。资源/校验条件未变，自定原文和旧callback兼容；error/message API变化及旧记录政策已说明。后端release254测试0失败，三路[复查](reviews/p3-i02-rejections.md)0阻断。审计、终端及I03/I04继续推进，英文runner仍未开放。

## P3 I02：审计任务

实现commit `9cd912c`。SDK/ACP共享中英审计提示，检查locale与总结displayLocale经完整入口独立传递；真实ACP/session/注入MCP、SDK两种审计模式及子进程回收已验证。审计输入只接收安全传输诊断事实，保留领域参数和原话；合成秘密标记不可达。后端release264测试0失败，三路[复查](reviews/p3-i02-audit-tasks.md)0阻断。摘要模板/fallback/启发式、终端及I03/I04继续推进，不把任务语言接通当成完整audit交付。

## P3 I02：审计摘要

实现commit `ab09564`。确定性checks/观察使用稳定code与MessageRef，两个writer共享中英标题/metadata/统计，无AI与失败fallback也按displayLocale。严格摘要协议与当前任务证据交集已验证，历史原文不改译；换行/HTML/marker展示编码防伪结构。后端release272测试0失败，三路[复查](reviews/p3-i02-audit-summary.md)0阻断。终端、I03/I04及阶段总验收继续推进，英文runner仍未开放。

## P3 I02：终端事件

实现commit `1a7dce5`。chat/judge/live与ConsolePresenter/runner逐调用展示语言接通，共享目录及legacy兼容贡献有唯一文本来源。原始发言/遗言/夜聊结束理由保留，unknown和null历史边界可显示；事件/kind/stage/受众不改。后端release275测试0失败，三路[复查](reviews/p3-i02-console.md)0阻断。I03/I04、剩余日志与阶段总验收继续推进，英文runner仍未开放。

## P3 I03：公开复盘 v2

实现commit `94a5ddf`。公开writer/reader显式v2，后端导出和browser共用legacy转换；精确历史字段路径、未知/原文、只读源保护与128角色别名快照已验证。[格式政策](replay-v2.md)区分旧公开文件与内部Tape严格版本。actualRunner/复现携带locale，未来版本拒绝且英文gate保持。后端release283、前端34测试0失败，三路[复查](reviews/p3-i03-public-v2.md)0阻断。I03私人turn/request机器字段与I04继续推进，不宣称本阶段已完成。

## P3 I03：私有记录与行动请求

实现commit `77c12fc`。player记录v2与shared reader交付，RoundRecorder写机器phase/stage，内置请求说明改MessageRef后逐局渲染；旧档仅元字段归一，原话/unknown/day异常保。raw/empty优先、引用复制、坏嵌套/参数拒绝与API迁移见[private-record-v2.md](private-record-v2.md)。后端release291、前端34测试0失败，三路[复查](reviews/p3-i03-private-requests.md)0阻断。I04、剩余日志与P3整体门槛继续推进，英文执行仍未开放。


## P3 I04：工作台与视频

实现commit `6915c71`。共享文本目录、显式展示locale/timeZone、逐帧纯投影与真实离线PNG/MP4入口完成；用户语言选择独立于source hint，原话/unknown不改，时区/DST与空胜者终局有明确显示。[展示与渲染契约](replay-display.md)说明API、CLI、独占发布和资源所有权。后端release291、前端45单测/6实际E2E、类型/构建及中英PNG/英文MP4全部通过；同frame PNG重复哈希一致。三路[复查](reviews/p3-i04-display.md)0剩余阻断；P3剩余日志和整体英文运行门槛继续推进，不把57项计划角色或完整阶段标记完成。


## P3 剩余日志：安全错误诊断

实现commit `95a99d0`。模型/ACP错误记录、审计与持久化告警共用closed diagnostic；原始exception/provider字段不进入新错误记录或输出，displayLocale是独立临时输入。原生取消/超时、SDK RetryError、HTTP与有限Retry-After、原始玩家内容和legacy政策见[error-diagnostics.md](error-diagnostics.md)。CLI安全catch/closed配置code与strict可选private字段已接通；后端release304、前端45/type/build通过；实际SDK/CLI错误与数据安全反例经[三路审查](reviews/p3-error-diagnostics.md)复查0阻断。P3观察/CLI人类说明和整体英文运行门槛继续，未启用P4/计划角色。


## P3 运行提示与CLI

实现commit `1350d70`。CLI局部语言/安全失败JSON、共享运行/观察文字、structured人格回退告警与双语欢乐局示例交付；迁移报告在写盘前预检。[runtime-display.md](runtime-display.md)说明flags、API变化、原文与默认机器人策略边界。整体英文执行gate仍保持，后端release313、前端48/type/build通过，实际中英CLI/安全反例和[三路审查](reviews/p3-runtime-display.md)复查0阻断；不把CLI解析/显示支持当作英文整局或64角色完成。


## P3 最终英文激活

ACP合法pass已独立修正commit `e498014`。runner显式World.locale，英文执行/Tape重放开放，模拟locale与metadata同步；公开组件renderPrompt接两语、SDK历史中性标记与源码AST scan交付。[english-execution.md](english-execution.md)说明18真实本机通路对局、原人工oracle/机器等价/权限/资源与兼容边界。[最终审查](reviews/p3-activation.md)三路0阻断；后端release329、前端48/type/build、当前6E2E回归及I04真实视频证据闭环。P3完成，完整持续目标转P4；57计划角色/混合接入/新机制仍未被提前启用。

## P3 展示语言补充

模拟与动作复现 CLI 将临时 displayLocale 继续传给记录器，录制告警与所选终端语言一致；对局 World、manifest 与 Tape locale 保持不变。真实模拟→录制→复现回归 1 项、3 个断言及后端类型检查通过，L 只读审查 0 阻断。

## P4 A01：共同动作接收

SDK 与 ACP 共用 schema/归一化/原有业务规则/回合约束及一次选择负责人；无效动作保留重试窗口，成功 receipt 区分接受和生效，SDK 不信任传输伪造的 finalAction。候选名单/存活及过期报告缺口已修，最终[三路审查](reviews/p4-a01.md)0 阻断。后端 release338 测试/12845 断言、真实双语 SDK/MCP 反馈与既有18整局/Tape均通过；[动作接收契约](action-reception.md)说明兼容与旧规则待修边界。下一批 A02 处理混合装配、排队/初始化/重试 deadline 和取消关闭；G01–G04/角色扩展仍待交付。

## P4 A02：SDK 队列与整轮预算

排队/初始化提示/模型循环/required retry 共用一次 absolute deadline；队列撤销、公平交接、关闭拒新任务与幂等 lease 完成。SDK/fallback 等待可取消，迟到结果无动作/日志；外来异常按原实例传播一次，成功收尾关闭竞态已修。最终 release352 测试/12908 断言、专项21/103与实际 HTTP cancel 通过；[资源契约](runtime-resources.md)说明总预算 API 变化、逻辑 owner 计数和即时 Baseline 边界，[交叉审查](reviews/p4-a02-sdk.md)记录修正。ACP、混合装配、runner 完整清理继续下一批，未把 A02/P4 标完成。

## P4 A02：ACP 会话与物理回收

内部 session namespace 与远端 wire ID 分开，短 tN、玩家语言与DTO/Tape边界保持；初始化/动作/兜底沿同一deadline，注册表永久封口。会话池持有创建、discard/迟到关闭及错误；正常关闭失败仍force，进程组/MCP回收有实际PID/端口证据。取消原错、同截止计时器竞态、私有记录关闭窗口、审计prompt+cleanup双错均已修正。最终 release371 测试通过，实际双语整局/Tape/模拟回归全绿；[审查记录](reviews/p4-a02-acp.md)与[兼容契约](runtime-resources.md)说明严格错误及自定义非合作创建边界。混合装配、provider完整并发作用域与runner多错误收尾继续下一笔，A02/P4仍进行中。

## P4 共享调度器归属

将既有 ScopedRequestScheduler 从 ai/agents/llm 移至 ai/runtime，仅修相对导入；为下一笔 ACP/provider 并发与混合装配提供共同位置，没有修改算法。类型/模块边界与7项调度回归通过；A逐字独立审查0阻断。迁移独立提交，行为接入继续下一笔。

## P4 A02：混合装配与 provider 并发

SDK/ACP按actor已解析profile分派，factory持有独立配置快照；同provider配置一致，原对象变更不漂移路由/预算。ACP provider支持strict正整数maxConcurrentRequests、各自独立pool/scheduler；回收完成才交接lease，未能证明回收则永久拒该provider新模型请求并保原错误。实际34个双语纯/混合整局、两种交错七角色、人设继承/覆盖/null与原名wire、逐局Tape及跨provider物理回收均通过。最终release388测试29034断言，三路[审查记录](reviews/p4-a02-mixed.md)已闭代码阻断；公开mixed=true及[six_player_mixed模板](../../configs.example/games/six_player_mixed.json)交付。runner并发多错收尾接续下一子批，A02/P4仍进行中。

## P4 A02：Runner 并发失败与最终保存

runner记录决定后立即关闭一次，停止新模型并在录制前丢弃迟到成功；排空后采集真实失败CP/保存，阶段原错与其它并发决定、cleanup、disk原异常分别保留。实际四组合十二人失败/取消/迟到成功/写盘验证严格Tape、无pending/晚写与原错；旧错误名双读漏洞已补受控snapshot/getter/Proxy反例。最终release395测试通过，三路[审查记录](reviews/p4-a02-runner.md)闭环，当前A02资源/混合/provider预算/runner链路交付。P4继续M21日志开关专项与G01–G04，57计划角色及后续机制未提前标完成。

## P4 共享日志观察能力归属

原 LlmObserver 文件逐字移到 ai/agents/player/player_observer.ts，只更新4源码和2测试imports，class/flags/输出保持。类型、模块边界与既有语言/CLI显示回归通过，A只读逐字审查0阻断。目录迁移独立提交，M21跨传输flags行为随后接入。


## P4 M21：跨传输日志开关

SDK/ACP共享IO、轨迹和trace的终端语义，ACP初始化/实际行动提示加入共同观察器；流式message只输出一次，IO-only不输出thought/tool。展示locale与World语言独立，私有提示/思考/动作摘要始终保存，6种同步日志close触发无晚写和迟到动作。最终后端release411测试/29307断言、34实际双语纯/混合整局及严格Tape通过；追加原思考canary专项15/189通过。三路[审查](reviews/p4-m21.md)复查0阻断，[日志矩阵](runtime-display.md#p4-m21sdk--acp-日志开关)明确trace仍包含已接受动作参数与旧API默认。P4继续G01–G04，未启用57计划角色。


## P4 G01：狼队权限与事件时受众

角色profile分别表达互认范围、夜聊与刀权；共享Policy/观察DTO、阶段收集、接收/执行及默认Baseline沿同一实际目录查询。狼队领域事件必填内部audience，发生时复制冻结；后来加入不读旧事件，退出/死亡保留过去授权且不收未来狼聊，玩家wire与观战replay不带受众。公开板子构成固定，隐藏转换不改写数量；缓存会话通过每轮共享提示更新授权名单，不删除历史知识。内部RecordedGameEvent与领域类型分开，严格Tape拒绝受众篡改/缺失/重复，source兼容未放宽。

三路[审查](reviews/p4-g01.md)修正后0阻断；最终release436测试/29674断言、34实际双语纯/混合整局与严格Tape通过，前端48/336、类型/构建通过。新增同会话initial→grant→revoke两语实际SDK HTTP/MCP专项2/36。详细权限、低层API、历史文件及合成profile边界见[契约](wolf-team-access.md)。G01不代表特殊狼或继承规则已启用，基础七项其余规则差异继续G02–G04；57计划角色仍未登记实现。


## P4 G02：类型化查验子批

共享camp/role/combined结果、规则标签查询与两语展示交付；原生预言家仍仅执行camp，保留派生isWerewolf兼容但不拿false推断good，结果不改变真实阵营/身份/狼权。实际事件、私有latest/history/summary与玩家投影均隔离副本，模型不能选择额外查验mode。严格reader只读own data快照，legacy真bool仅缺typed结果时回退；终端/前端未知结果保持原JSON/未知标记，system提示明确标签/真实身份与完整结果语义。

最终后端release449测试/29877断言、34实际双语纯/混合整局/Tape通过；前端52/360、类型/构建通过，英文措辞最后微调经R/L审查且双语提示/文本9/1581回归通过。三路[交叉审查](reviews/p4-g02-inspection.md)发现的重复未知字段读取、嵌套投影共享与终端truthiness回退均修复并复查0阻断。[结果契约](inspection-results.md)明确原生Camp-only与纯查询基础的范围、旧状态及格式兼容。G02能力/资源/生效与调度及女巫缺口继续下一子批，不标M05/M07/M08或完整G02完成，57计划角色未提前启用。


## P4 G02：夜间能力实例子批

三类原生夜间状态迁入唯一能力实例，支持多来源、同类多实例、启用/到期、次数与封锁；阵营查验/守护/用药按实例调度，请求绑定ID，接收与执行重新检查。gift/copy输入与专用transfer路径分开，转移保留次数/同夜限制、显式知识策略及退役ID；所有安装路径脱离模板并规范JSON，不放宽Tape。来源默认不给玩家真实giver/原实例；身份、Agent与人设继续跟随玩家。每轮双语状态与目标提示按实际实例，晚到用药按真实日期派生自救。

最终release476测试/30135断言、34实际双语纯/混合基础整局与严格Tape通过；新增两语真实SDK HTTP/ACP进程和MCP赠予查验4/32，实例人工23/181，前端54/365/type/build通过。三路[审查](reviews/p4-g02-abilities.md)发现的伪转移、模板别名、晚到自救、JSON缺省/数组与目标提示问题修复后0剩余阻断。[契约](night-abilities.md)明确API/记录、源披露、知识与资源、预留阶段及合成fixture的范围。G02女巫刀口/耗药后信息与保护结算继续下一子批；死亡技能及胜利继续G03–G04，57计划角色仍未启用。


## P4 G02：女巫目标、当前刀口与保护/毒

解药在预检/最终执行只接受实际存活、具角色且被当夜狼刀标记的目标，错误目标不消费/不封接收窗口；药耗尽的请求缺省wolf_target，未知不伪装成空刀，历史信息不删除。毒来源独立于保护冲突，16人工组合以及实际复合毒猎人gun0覆盖，没有把禁枪负例当所有Hunter修复。新heal_target和本夜/未知提示两语一致，接入与旧档边界见[契约](witch-resolution.md)。

最终release490测试/30327断言、34实际双语纯/混合整局与严格Tape通过；actualSDK/MCP目标更正13/166，真实exhausted SDK/ACP进程/MCP输入（连赠予）8/60，PID回收明确ESRCH后8/68通过；前端54/365/type通过。三路[审查](reviews/p4-g02-witch.md)0剩余阻断。基础规则卡相应两项差异关闭；枪击来源、末神/空枪、自爆与死亡链继续G03，结果结构继续G04，计划角色状态仍未改变。

## P4 G03：死亡来源、末神与空枪子批

DeathCause 与临时状态印记分离，狼刀/毒/放逐/枪有明确来源，枪击不再记为狼刀；Hunter 根据非空原因集合决定资格，复合毒禁枪，移除硬编码神职及末神禁枪。明确 shot/pass/invalid 与 null 空枪，非法/异常不耗枪，三次请求上限；初批/追加波次请求分别记录实际死亡阶段。SDK/MCP 两语回执一致，预检保持不消费。接口及旧档边界见[契约](death-causes.md)，审查记录见[交叉审查](reviews/p4-g03-causes.md)。

完整release508/30549通过；审查建议后的最终engine/提示/真实wire/34基础完整对局与严格Tape185/25591通过，前端54/365与两端类型通过；三路结果见审查记录。G03 的 World 所有死亡动作授权、遗言/徽章/钩子/追加波次状态归属及自爆收尾继续下一子批。没有把全部G03/G04、死亡能力实例或57计划角色登记为已实现。

## P4 G03：死亡动作窗口子批

World持有 actor/tool/day/phase/generation 和生命版本授权；stage/trigger只识别请求，不独立授权。窗口覆盖真正消费，Hook同步点再次检查，生存猎人无自由枪权，遗言与枪分别授权。切换阶段/复活/组件替换/取消/原错均使旧窗失效或关闭；旧关闭句柄不影响新窗。原引擎/Tape保留ID，受限观察删除ID，隐藏他人窗口数量不透传。接口见[契约](death-action-authority.md)，三路竞态/生命周期/隐私修正见[审查](reviews/p4-g03-authority.md)。

最终release526/30955通过，修正专项50/845，前端54/365与类型通过，三路复查见审查记录。完整死亡链、普通自爆与警徽/遗言时序继续下一子批；G04与57计划角色仍未启用。

## P4 G03：基础死亡收尾与追加波次

DeathResolution统一写夜间/正常放逐/默认preVote自爆/枪击死亡，角色钩子和窗口返回事实提案。整波先dead，初批来源限定遗言，所有警徽后逐actor/逐hook技能，追加立即dead再入下一波，无追加遗言，最后PhaseManager判胜。自爆警长不残留，继续时day+1/Night。逐hook提交成功提案保后置错误前缀；生命账本防重复/循环，复活为新生命，来源union保复合毒。接口/失败终止及旧档见[契约](death-chain.md)，独立修正见[审查](reviews/p4-g03-chain.md)。

人工11/104、初步engine173/5022通过；最终完整release537/31062（含34真实双语纯/混合基础完整对局与逐局Tape）通过，三路复查0剩余阻断。扩展3自爆窗口准确位置、白痴/选举与G04继续，不将基础七项或57计划角色提前标verified。

## P4：白痴与警长公共参与资格

三项公开资格由profile/目录定义，并与Alive/VotingRight共同约束接收、最终gateway、流水线、警徽、Baseline及提示。白痴一次翻牌，永久禁投票/再放逐/竞选/持徽，仍可发言与正常其它死亡；重复低层钩子不重发事件。无人上警/全退不恢复候选，零有效票或全员上警不选警长，非法票不改投；正票平票沿配置策略。请求context副本隔离，异步收集后再验，迟到无效票不记录/计数。中英规则与两项stable拒绝同步，接口见[契约](public-participation.md)。

人工16/156，实际SDK HTTP/MCP25/284，初步engine/shared/prompt185/5282，前端54/365/type通过；最终release563/31339（含34真实基础完整对局/Tape）通过，三路[审查](reviews/p4-participation.md)0剩余阻断。三扩展自爆窗口与G04继续，计划角色不提前登记实现。

## P4 G03：四公开自爆窗口与首日收尾

v2四枚举、对应hooks与[]关闭实际接通；竞选前仅首日确实竞选前，天亮在夜结算/遗言后方向前，gap在每次正常speech后（含最后），放逐前仍Voting。early blast合并pendingNight与本身的原因/阶段，先整个死亡链后judge，不跳过末神枪/不重复遗言，也不自动次日补选。选择生命/ref/role/clock最终再验，最小仍有效ID；PhaseManager commit同步公共事实与进入标死，普通低层pipeline只返意图。新override空列表保留，历史迁移保旧[]默认/明确去无执行声明与中英警告。

契约见[四窗口](self-destruct-windows.md)，[交叉审查](reviews/p4-g03-windows.md)含模型信息与保存档案分辨。最终人工29/247、新16局真实双语SDK/ACP整局和逐局Tape8/2460，前端54/365/type通过；最终release600/34055（含50局真实基础/窗口双语纯混合对局及Tape）通过，三路复查0阻断，追加公开四窗口板子/运行配置加载1/4通过。G04与计划角色继续，尚不据此完成整个P4。

## P4 G04：胜利归属与核心结果子批

独立Victory组件/profile初始声明，不从身份变化/能力复制自动改归属；成员含dead，三种primary/额外claim明确并集，真实camp人数与Good神民独立。WinDecision通过实际checkpoint过滤并由PhaseManager一次封盘，最终按当前归属重验，maxDays明确noWinner且终局事件恰好一次，state/event/外部读取隔离。内部Tape升级2，严格保存membership/outcome/point与共享执行decoder的source指纹；旧1拒版，[]显式无归属，安装与录制共用strictreader。

[契约](victory-outcomes.md)、[三路审查](reviews/p4-g04-core.md)记录真实scope；初版full616/34154、修正人工16/100连repro28/228、front54/365/type过，最终full617/34160（含50真实完整局/Tape）通过，三路复查0剩余阻断。公共主档/reader、终端/前端/视频结果呈现与P4整体验收继续下一子批，57计划角色仍未启用。

## P4 G04：公开胜利记录与双语展示

manifest.game_result/public result.decision保存实际封盘，执行结束原因与判胜原因独立。shared reader检查字段／成员／投影／完整header-terminal一致性，返回副本再验，显式终局复制前拒getter及非枚举；plain坏JSON留raw但显示Unknown。终端、审计、工作台、timeline与frame共享中英formatter，全局roster一致验证，死亡获胜者保dead，终局前不提前标席位。旧档无名单不猜，未封盘运行失败为未结束。契约见[记录与展示](victory-record-display.md)，独立发现及复查见[审查](reviews/p4-g04-display.md)。

最终后端release633／34433（含50实际本地完整局和逐局Tape）及smoke、前端67／539／types／build、实际Chromium10交互通过；中文PNG与英文1280×720／6秒H264视频目视正常。合成个人／关系fixture不宣称新角色已上线。G04代码与呈现交付；P4整阶段目录验证登记另笔收尾，57计划角色继续后续阶段。

## P4 最终验收与七基础角色登记

A01/A02/M21/G01–G04和基础差异闭环；七項在awa_classic1.0.0已验板子范围升级verified，真实profile许可不变。当前目录/唯一基础规则卡/功能契约/Tape2与进度对齐，恢复误复制的女巫文档，历史review保当时事实。[阶段验收](reviews/p4-activation.md)列明six/twelve S01–S04和四个单窗口六人变体共50实际local SDK/ACP/mixed双语整局、严格Tape及50 seed补充；十二人四窗口公开示例不伪称额外完整局。个人/组合成fixture不是角色实现，T6与P10发布级门槛仍保留。

登记后最终后端release633／34433及smoke通过，定向5／272；前端67／539、实际Chromium10、PNG/6秒视频沿用紧接的G04门槛。25 seed＋25重放场景采用独立30秒测试预算，生产时限和断言不变。后续从P5狼王、白狼王、骑士、守墓人依次交付，再推进P6–P10；完整目标尚未完成。

## P5：狼王

`wolf_king`作为第八项真实角色交付：普通狼队/自爆能力、独立枪资源、明确死因/Shot连锁、共享单次枪schema/消费/修复及按演员profile的同名工具校验；每轮Day与本人状态中英一致，新death_shot/wolf_king_shot与旧Hunter契约分开。native shoot无locale metadata改英文角色中性，旧路径保留，主动SDK/MCP协议仍双语。规则/边界/API见[狼王卡](rules/awa-wolf-king-v1.md)及[接入契约](wolf-king.md)，五场景字面oracle与发现修正见[三路审查](reviews/p5-wolf-king.md)。

最后后端release664／38789／95文件及smoke通过；原50＋狼王30＝80实际本机SDK/ACP/混合双语完整局和逐局严格Tape，狼王24受限观察seed及重放补覆盖。新core12／327、配置2／10、加强身份/私有枪/日次的actual wire15／3967、随机2／34，front69／560/types/build、真实Chromium12、中英实际PNG均通过。三路最终0阻断，目录8verified／56planned；新6/12板子和运行example可加载，未改用户configs。没有声称完成外部模型质量或整个P5，后续先白狼王，再骑士/守墓人与P6–P10。

## P5：白狼王

第九项`white_wolf_king`实际交付：独立自爆带人/null工具与机会、WhiteWolfBlast来源、可追枪/复合毒禁枪、演员/目标生命与资源引用再验、最小有效候选及无效应false继续下一候选。PhaseManager私有pending-night caster不可吞刀/毒施放，接收不泄露，目标合并死因/阶段与完整死亡链后判胜。shared中英正确实际tool/遗言说明，新旧普通wolf/Hunter/King事件和schema2/Tape2边界保留。规则/明确版本选择见[白狼王卡](rules/awa-white-wolf-king-v1.md)，API迁移及验收范围见[契约](white-wolf-king.md)，三路修正和门槛见[审查](reviews/p5-white-wolf-king.md)。

最终后端release717／45747／99文件及smoke通过；原80＋白狼54＝134实际本机双语SDK/ACP/混合完整局与逐局Tape；两板32显式active受限seed实际技能正覆盖及重放2／42，核心22／319、配置4／16、front73／585/types/build、Chromium14与中英PNG通过。扫描全仓AST采用独立30秒预算、覆盖/精确57例外/断言不变，生产预算不改。目录9verified／55planned，P5尚余骑士/守墓人，后续P6–P10目标保持；未调用外部模型或用户认证、未改用户configs。

## P5：骑士

第十项`knight`交付：普通一次决斗、三离散窗口及[]关闭，真实Camp/查验伪装分离、公开wolf/not_wolf不揭第三方牌、双方生命/角色/camp与本人资源最终再验。资源/事实提案由同步commit提交，DeathResolution唯一死亡链、PhaseManager唯一推进和判胜；Duel禁枪/带人，纯Day初批DuelFailure获本人授权遗言及徽章。间隙含最后发言、自爆先手与双末窗顺序已明确。冻结版本/API/Tape及资料改编见[规则卡](rules/awa-knight-v1.md)、[契约](knight.md)，[审查记录](reviews/p5-knight.md)保来源/资源提示证据纠正及最终门槛。

最终release770／51514／103文件及smoke通过；原134＋新48＝182实际本机SDK/ACP/混合中英完整局及全部Tape，新增两板40受限seed零拒绝/回退/自然终局/技能正覆盖与重放2／50。core23／204，终端5／321，front77／614/types/build、实际Chromium18及中文命中/英文失误PNG通过。三路复查0阻断，目录10verified／54planned，新6/12 board和game example可加载。P5剩守墓人再推进P6–P10；未将12人已死骑士CP0当次日模型输入，未访问真实认证/外部模型或改用户configs；整体目标继续。

## P5：守墓人及第一批角色收尾

第十一项`gravekeeper`交付：前日真实放逐主目标的camp标签定案冻结、下一夜女巫后/预言家前被动反馈，无原生主动工具；PhaseManager私有fact输入、角色/DTO只有已交付历史，actor-only事件与条件终端显示，白痴/无放逐/自爆/决斗/追加枪死不冒充exile。审查修复Night取消后续写/结伤/覆盖跳转，以phaseRevision与阶段/await/gateway检查短路；camp-only共享严格reader让坏历史Unknown而非具体牌。接口与边界见[卡](rules/awa-gravekeeper-v1.md)、[契约](gravekeeper.md)，[审查](reviews/p5-gravekeeper.md)记录发现、复查与证据。

最终release820／60313／107文件及smoke通过；原182＋守墓48＝230实际本机SDK/ACP/混合双语完整局及全部Tape。core20／236，40受限seed/重放及条件终端合9／385，配置8／50；front83／711/type/build，最终actualChromium20（含席位/字幕bbox）与中英十二人真实PNG通过。英文字幕遮下排角色问题已修并复验，未改视频编码器。目录11verified／53planned，新6/12 public board与game可加载，四项P5要求闭环见[整阶段验收](reviews/p5-activation.md)。P6从摄梦人等冻结依赖继续，P7–P10/53角色/发布级矩阵与T6保持完整目标；没有把记录当模型实际输入，没有调用真实模型/认证或改用户configs。

## P6：摄梦人

第十二项`dreamer`交付：G02实例内强制梦、相邻同实例目标连续梦亡、本夜生命周期私有Frame与Night保护/牵连；核心Damage只收已验效果ID，Alive/所有徽章/追加波次归DeathResolution，PhaseManager最后judge。逐actor Night来源枪保护/消耗落空/命中施梦者牵连，普通Day无关系；同波死目标及时补Dream禁后续枪，匿名实际additional_deaths同步玩家和前端，God梦原因不提前泄待夜死。World级重入、mandatory耗尽、phaseRevision/最终gateway许可与gift规则缺口均由独立审查修正，见[卡](rules/awa-dreamer-v1.md)、[契约](dreamer.md)、[审查](reviews/p6-dreamer.md)。

最终release885／68872／112文件及smoke/type/deps/boundaries/i18n通过，原230＋新54＝284本机双语SDK/ACP/混合完整局及全部严格Tape；另4个gift实际任务身份/规则/只读接收/回收通过，非完整局。core30／440，配置10／60，两板40受限seed与重放2／50，front85／732/type/build、actualChromium24及中英PNG通过。三路0剩余阻断，目录12verified／52planned；新6/12 board/game示例可加载。P6其余四角色及P7–P10/T6/长局/发布矩阵继续，觉醒摄梦人仍在64外长期候选，未改用户configs或真实认证。

## P6：狼美人

第十三项 `wolf_beauty` 交付：普通狼队权限与无自爆／本人自刀，刀后女巫前可选魅惑，合法skip耗本夜清关系、相邻夜不能同目标；原World绑定不通知目标，hook令牌在await后同步认领才派生死亡／Night来源。Exile／Poison触发，Duel／Dream复合禁技能，Guard／Heal不挡，Night有效梦保护／梦链与同波原遗言、补因禁后续枪明确。PhaseManager私有末狼候选，仅SlaughterSide条目内应用实际放逐带最后神／民的特殊狼胜，保配置次序与全死亡／徽章连锁先结束。runner own cancellation保持AbortError，不转合法skip，实际失败／已提交前缀及严格Tape保留。

[卡](rules/awa-wolf-beauty-v1.md)、[契约](wolf-beauty.md)、[三路审查](reviews/p6-wolf-beauty.md)记录来源／AWA细则／内部API与修正。最终release963／79767／117文件、smoke/type/deps/boundaries/i18n通过，原284＋新72＝356本机SDK/ACP/混合双语完整局及全部严格Tape；core34／292含四条件徽章1→2→4再judge，runner取消重放／并发失败／配置8／94，40受限seed自然／0拒绝回退／实际Charm分支与重放2／52。front89／781/type/build、actualChromium28及中英真实PNG通过，三路0剩余阻断，目录13verified／51planned。六／十二人board/game示例可加载，用户configs／认证未读写。P6剩熊／隐狼／石像鬼，P7–P10／51角色／22机制完整矩阵／T6保持目标。

## P6：熊

第十四项 `bear` 交付：入夜按当前seat存活环取邻居，待公布样本仅manager持有原World／role／state／life版本；邻居本夜死亡不重算，完整夜死／原遗言／徽章／追加波次后才匿名公布day/bool，再judge。原熊夜死／已死quiet，取消／生命替换／复活无晚报，重复不加history；真Wolf感知独立Seer伪装和临时刀权。profile原生maxCount1在parse/directbootstrap聚合约束；实际竞选取消发现旧Election缺epoch并补所有await／gateway／阶段交接检查。来源版与AWA细则见[卡](rules/awa-bear-v1.md)，API及范围见[契约](bear.md)、[三路审查](reviews/p6-bear.md)。

最终受影响engine／配置／目录／中英终端／契约492／10133／51文件与type/deps/boundaries/i18n通过；本角色最终source的78实际SDK/ACP/混合双语完整局＋40受限seed／全部严格Tape，41／9214通过，roar与quiet都有正覆盖且自然／0拒绝回退。core36／215、public/config/console连core52／809；front93／848/type/build、actualChromium32、中英真实PNG过，三路0剩余阻断。目录14verified／50planned，六／十二人board/game示例可加载；来源Hidden／白神未冒认已实现，用户configs／认证未读写。

依delivery§3按功能运行受影响门槛，未把上一笔963全量的历史source证据当本轮全阶段通过；P6结束全部已支持回归、后续长局／T6／P10门槛保持。P6剩隐狼／石像鬼，P7–P10／50角色／22机制完整矩阵继续。

## P6：隐狼

第十五项 `hidden_wolf` 交付：单向其它Wolf授权ID、普通pack不知其身份、不夜聊／不补旧狼聊票；开局或真实死亡批后存活成唯一Wolf时一次本人接刀事实，当前资格与永久曾获得分开。伪装／熊按历史事实，真camp用于Knight／人数／胜利；死后标签不复位，原state不在query/预检中消费。完整提案mark后刷新避免顺序假接，聊天gateway后动态权限再验；合法票保prefix，目标life/version有效tally、临时knife scope到Damage前、首日pending NightDamage到真正mark前均复验，旧刀不伤同ID新生命。API/细则见[卡](rules/awa-hidden-wolf-v1.md)、[契约](hidden-wolf.md)，[三路审查](reviews/p6-hidden-wolf.md)记录具体fail→修复及范围。

最终所涉engine／配置／目录／console／契约524／10323／54文件与type/deps/boundaries/i18n过；隐狼＋8生命core30／156（含白狼/Beauty与正新生命票），本轮最终source72真实本机SDK/ACP/混合双语完整局＋40受限seed／全部严格Tape38／9858自然0拒绝回退，接刀与实际刀票正覆盖。12全active探索无继承未降低断言，采用既有四style0–19／六人active，40seed2／328通过；没有改变公开板子或机器人策略。

front97／893/type/build、actualChromium36及中英实际PNG过，三路0剩余阻断，目录15verified／49planned，六／十二人AWA board/game示例可加载。熊现时文档与已接入隐狼同步；迷雾永久平民／固定顺位／觉醒和石像联合玩法未冒认支持。依delivery§3功能门槛，P6石像鬼完成后全已支持release／阶段矩阵、P7–P10／49角色／22机制／长局T6发布目标保持；用户configs及真实认证未读写。


## P6：石像鬼与整阶段完成

第16项gargoyle按[冻结卡](rules/awa-gargoyle-v1.md)交付独立typed具体role查验、每实例禁重复、完整旧知识转移及原生本夜查后刀。world私有完成范围绑定原role/native state/ability/inspection/life/phase；真实完整死亡提案后继承，目标耗尽不假报告或消费。审查发现的转移清空、字段顺序误拒、第三次耗尽未完成、native状态替换旧授权均修复，查后六类撤权、熊/墓/Knight/White/Beauty/Dream/Hidden交互及copy/gift独立账本纳入core32/229。

最终目录16verified／48planned，完整release1176／105387／131文件、0失败、smoke/type/deps/boundaries/i18n通过，`/tmp/awa-p6-release-verified.log`。所有已支持542实际本机SDK/ACP/混合双语完整局与每局严格Tape、各板受限观察seed和资源故障专项共同回归；石像新增36完整局＋4gift重复拒绝/纠正任务。两板40 seed零拒绝回退、自然终局、真实查验/接刀/新刀票正覆盖及全重放；十二人0–19初探无接刀，扩展定位53后采用固定40–59，不改板子/策略或降低断言。

front103／953、type/build、actualChromium42、中文接刀与英文十二人具体角色查验PNG均过并独立目检。三路[角色审查](reviews/p6-gargoyle.md)和[整阶段审查](reviews/p6-activation.md)0剩余阻断，六/十二public board/game例可加载，未读写用户configs/真实认证或调用外部模型。P6关闭；P7从通灵师规则冻结开始，7项P7＋3项P8＋38项P9及P10组合/长局/T6保持持续完整目标。
