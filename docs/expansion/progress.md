# 实施进度

用户于 2026-10-07 明确授权启动完整目标，P0 结束后的等待要求已满足。持续目标覆盖 P1–P10；长期候选不自动纳入。

**当前执行边界（2026-10-09持续授权）**：原P7交接已结束；按[持续实施契约](contracts/p8-p10-continuation.md)直接在main线性推进P8–P10、实际离线验收和本地原子提交。不push/部署/真实模型调用或改用户configs/秘密，总体仍待用户最终验收。

| 阶段      | 状态                     | 当前证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | 完成                     | 文档 commit `5337194`，三路审查闭环                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| P1        | 完成                     | `facea9c`共享目录；`87af121`机制参数执行；v2完整配置、迁移/检查及玩家绑定交付；193后端+33前端测试，三路复查0阻断                                                                                                                                                                                                                                                                                                                                                                                                                             |
| P2        | 完成                     | T01逐局随机/T02严格脚本/T03受限观察/T04动作录制与兼容回放；227后端+33前端测试，三路复查0阻断                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| P3        | 完成                     | I01–I04、诊断/CLI与受控源码扫描；实际SDK/ACP中英完整场景与Tape重放、前端/视频门槛；英文入口开放                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P4        | 完成                     | A01/A02/M21、G01–G04、白痴/警长及四窗口闭环；七基础角色verified，双语50实际本地完整局/Tape、终端/审计/前端/视频一致，见[整阶段验收](reviews/p4-activation.md)                                                                                                                                                                                                                                                                                                                                                                                |
| P5        | 完成                     | 狼王/白狼王/骑士/守墓人逐项交付；11项verified，230双语actual局/Tape、820后端/83前端/20浏览器通过，见[阶段验收](reviews/p5-activation.md)                                                                                                                                                                                                                                                                                                                                                                                                     |
| P6        | 完成                     | 五角色与三路审查闭环；16项verified，最终全量1176测试／542实际双语整局/Tape、103前端／42浏览器通过，见[阶段验收](reviews/p6-activation.md)                                                                                                                                                                                                                                                                                                                                                                                                    |
| P7 第三批 | 完成：七角色及全阶段验收 | [通灵师](reviews/p7-psychic.md)、[机械狼](reviews/p7-mechanical-wolf.md)、[奇迹商人](reviews/p7-miracle-merchant.md)、[混血儿](reviews/p7-hybrid.md)、[魔镜少女](reviews/p7-mirror-girl.md)、[觉醒隐狼](reviews/p7-awakened-hidden-wolf.md)、[黑市商人](reviews/p7-black-market-merchant.md)；23 verified/41 planned；Black新增84双语本地完整局/Tape、40seed与4失败Tape，全量后端2027测试/184573断言、前端173/78浏览器通过；见[阶段验收](reviews/p7-activation.md)，三路最终复查0阻断；功能commit `83cac45`，收尾交接见[文档](handoff-p7.md) |
| P8–P10    | 进行中                   | 按路线依赖推进，不把目录登记当成实现                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

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

## P7：具体角色查验模块归属

现有石像鬼阶段与私有夜范围移到roles/role_inspection，单独纯迁移，不改规则或提前启用通灵。两文件与HEAD逐字核对（唯一stage内部import修正），外部引用同步；type/deps/boundaries、core32/229和36实际双语SDK/ACP/混合整局＋40seed／全部Tape20/5715通过。两名独立R/A只读核无行为/资源/受众变化，见[迁移审查](reviews/p7-inspection-move.md)。目录仍16verified/48planned，通灵按另笔冻结/实现/验收。

## P7：通灵师

第17项psychic按[冻结卡](rules/awa-psychic-v1.md)与[契约](psychic.md)交付：Good神职，600女巫后允许跨夜重验/无工具skip；共用role_check明确实例policy，旧Garg默认规则保留。同名schema/validator中性，bound实例统一控制stage/目标/Baseline/共享提示；合法skip只关本夜不耗use，scope/policy/生命/gateway再验、完整JSON语义转移，不授狼或Garg刀权限。

最终source type/deps/boundaries/i18n与受影响engine/config/catalog/console **527/10558/42文件**过；通灵core24，连Garg/config58/413，三路独立复查0阻断。最终实际基础50＋Garg36＋通灵36＝**122双语SDK/ACP/混合完整局与全部严格Tape**、两角色80受限seed/Tape＋8gift专项 **73/36177**，日志`/tmp/awa-p7-psychic-wire-final.log`；新角色40seed实际查验/重验/skip自然终局0拒绝回退。没有把前P6全部542历史source当本笔复跑全部。

前端109/998、type/build、实际Chromium46及中英PNG过，copy/gift两个policy真实身份/规则/只读接收/PID回收明确；Role/Psy背景已注明原生。既有no-winner在浏览器首轮/定向各超时一次，保原证据；健康检查更准确等待转换入口，独立testinfra commit b78081a不改断言/预算，最终46全过。独立新缓存probe未复现原根因，没有假称API慢/HMR/冷transform已确定。

目录17verified/47planned，六/十二public board/game例可加载；源代码未在活跃最终对局中修改。P7剩机械狼、奇迹商人、混血儿及同依赖下魔镜少女/觉醒隐狼/黑市商人；P8–P10/组合矩阵/真实模型与长局完整目标保持。未读写用户configs/认证或调用外部模型。

## P7：毒药来源与原生命基础

为机械反毒先交付独立NightPoisonClaim来源基础；Witch等待/网关后复验原actor/target生命，Runtime私有source/target refs经NightPipeline进入Damage，不进state/DTO/events/summary/Tape。已提交毒保瓶数/事件前缀和caster死后效力，target新生命不受旧毒；legacy marks保持，实际两Witch来源保逐条，死亡按body合并。

最终type/deps/boundaries、engine512/8212、122受影响双语完整局＋80seed/全部Tape＋8gift专项73/36177通过，核心13/88由A独立复跑，L/D核无新增数据暴露，见[来源基础审查](reviews/p7-poison-attribution.md)。机械卡AWA差异先冻结，但角色仍planned/未启用，反毒/机械原生技能及完整矩阵后续独立交付；目录保持17已验/47待交付。

## P7：死亡枪原目标生命基础

每次request捕原target生命，await/gateway/shared/Actual owner再验；新retry可绑定当前新life，旧请求不伤新body。shared接受后保枪消费prefix，但公开hunter/king shot只真实追加死亡mark后发；失效Shot只剔此原因，保其它合法原因并匿名actual追加death同步，不假杀播放器。permit结束清零，refs只runtime不进state/DTO/Tape。

最终type/deps/boundaries、engine524/8259与278受影响actual双语完整局/全部Tape139/56818过；三路只读关闭原life/Actor/phase/legacy/公开投影问题，见[枪范围基础](reviews/p7-death-shot-life.md)。角色目录仍17已验、机械planned；下一笔机械状态/模式/特殊技能按已冻卡推进，不把普通枪基础冒认机械已完成。

## P7：机械伤害内部基础

核心 Damage 新增机械盾、逐源单次反毒、仅穿普通 Guard 的额外刀与独立连守自罚死因；输入绑定原生命和只读有效性谓词，不直接修改 Alive 或判胜。反射绕过施毒者机械盾、不递归，Dream 仍可挡；旧 caster 不伤新生命，普通已提交毒仍保留。三路审查发现普通同守同救后 extra 误用旧 Heal 标记，已修正并补有/无基础刀和独立机械盾人工判例；新死因实际 HunterHook 资格与消费也通过。

最终 type/deps/boundaries/i18n、engine **541/8355/40 文件**及 **278 双语本地 SDK/ACP/混合完整局与全部严格 Tape（139/56818）**通过，三路 0 剩余阻断，见[机械伤害审查](reviews/p7-mechanical-damage.md)。这是不可选择的内部基础；机械 profile/阶段/配置尚未接入，仍 17 verified/47 planned。下一步唯一状态 owner、模式/学习窗口和机械技能进入真实夜间流程；全目标继续。

## P7：机械内部状态与权限控制

六类学习独立库存、next-night/被动枪、学习/模式各自窗口、固定首次刀夜及 extra spent/expired、按实际夜次的连守已建模。原 World/role/state/life/phase 与模式/技能快照约束 runtime 权限；刀查询只读，JSON mode 不恢复旧范围。A/L 发现模式原对象改写、A 发现技能种类改写与跨 World 登记缺口，均修正并交叉复查；39/159 控制专项通过。

最终 type/deps/boundaries/i18n、全部 engine **580/8514/43 文件**通过，三路 0 阻断，见[控制审查](reviews/p7-mechanical-control.md)。这些 helpers 尚无生产装配，synthetic 控制测试不等于机械完整局；此笔未复跑 wire/browser。目录仍 17 已验/47 待交付，下一完整角色笔接实际阶段/网关/死亡 owner/双语/配置/呈现并完成全部功能门槛。

## P7：机械狼完整交付

第 18 项 mechanical_wolf 按[冻结卡](rules/awa-mechanical-wolf-v1.md)与[接入契约](mechanical-wolf.md)完整交付：六学习结果及独立次夜资源、250 模式/580 学习/650 技能/660 额外刀、真实批后固定首刀夜、仅穿普通 Guard 的额外刀、逐源单次反毒/独立机械盾/连守自罚、被动枪原生命与 owner、具体角色伪装和真实 Wolf 阵营分离。有限角色白名单在 parse/directbootstrap 同验；玩家无毒手因果，机械枪类型披露已明确授权。

三路独立发现的 skill 模式序列化绕过、毒瓶 gateway 后耗尽、枪浅 owner/camp/container、配置诊断及双语前缀问题均修并复查；真实同批不假接/不同提案保前缀、外部 G02 与原生排他也有实际核心场景。最终 verified 源码 type/deps/boundaries/i18n、engine/config/catalog **627/8916**，**176 双语本地完整局＋40 受限 seed/全部严格 Tape（90/46157）**通过；没有把候选 source 冒认激活后，登记后同矩阵再次运行。

front **119/1078**、type/build、实际 Chromium **50**与中英真实 PNG root/L 独立目检通过；详见[三路审查](reviews/p7-mechanical-wolf.md)。目录 18 verified/46 planned，新六/十二 board/game 示例可加载，未改用户 configs、未读取认证或调用外部模型。P7 其余奇迹商人、混血儿、魔镜少女、觉醒隐狼、黑市商人及 P8–P10、组合矩阵/长局/T6 持续，完整目标尚未完成。

## P7：奇迹商人完整交付

第19项 miracle_merchant 按[冻结卡](rules/awa-miracle-merchant-v1.md)及[接入契约](miracle-merchant.md)交付：125任意夜一次赠予／700独立当夜或后夜幸运验毒守，普通与Lucky独立库存、同actor同kind本夜及守前夜联合目标限制；原ID/activation/state/actor-target生命最终复验。真实Wolf不授且冻结MerchantBacklash提案，Dream可挡但不返次数，首夜遗言／徽章／全部死亡后PM判胜。无即时成功或donorID、opaque giftID、个人账本分离DTO、God分类不向任何玩家输出；死亡永久失效、transfer不返库存、copy附加gift拒绝。

三路修复并复查提交后账本变动、实例ID漂移、Lucky毒误用强制原生directive、none本人目标例外与roleCard锚点；真实反噬末神／末狼／徽章终局和九类字面Source计划相互验证。**verified最终source全release1463／134151／151文件＋smoke/type/deps/boundaries/i18n全过**，包括原632＋新54＝**686本机双语SDK/ACP/混合完整局及全部严格Tape**、各板种子与故障专项。新角色两板各20seed自然终局、0拒绝回退、赠予/反噬/Lucky/wait正分支及全重放；未把candidate54冒认激活后门槛。

front **127／1140**、type/build、实际Chromium **54**及中英真实PNG root/L独立目检通过，见[三路最终审查](reviews/p7-miracle-merchant.md)。目录19 verified/45 planned，新六/十二board/game例可加载，未读写用户configs/认证或调用外部模型。P7剩混血儿、魔镜少女、觉醒隐狼、黑市商人四角色；P8–P10／22机制全矩阵／长局／T6持续，完整目标尚未完成。

## P7：混血儿规则冻结

[规则卡](rules/awa-hybrid-v1.md)与[实现边界](hybrid.md)明确首夜榜样、实体 Good 民与独立 victory affiliation、真实阵营快照、验好及无狼权限，采用 Melbourne/GTV 核心并单列 AWA 精确选择。既有 God replay 保存合法私有事实；普通公开事件与玩家投影不带隐藏归属，未新增匿名 public perspective。三路冻结审查与修正见[审查记录](reviews/p7-hybrid-rules.md)。本笔仅文档，Hybrid 仍 planned，19 verified/45 planned 不变；下一笔完整角色/双语/6与12示例/真实本地通路/Tape/seed/前端门槛通过后才能启用，P7 后续四项与 P8–P10/T6/长局目标保持。

## P7：混血儿完整交付

第20项 Hybrid 按[规则卡](rules/awa-hybrid-v1.md#hybrid)与[接入契约](hybrid.md)完成：110首夜必选，真实Good民/验好不变，胜利独立跟随提交时榜样真camp；原Victory组件/数组/空内容与actor/target原生命最终复验，同步只首个提交、同日重入拒绝。本人仅choice，God affiliation不进入任何玩家输入，目标无通知/狼混无夜聊刀权；死者胜利/屠民与全真狼死后的Good优先仍由既有成员和实体统计决定。

审查发现真实SDK/ACP默认fallback会代选，已由显式 `allow_fallback:false` 共用校验修正，连注入备用策略也不调用；记录used=false、原重试/传输诊断和none，8故障落盘/失败Tape与篡改检测通过。十二人首日警选在公布夜死前，人工脚本按all electorate补齐H8请求；未改引擎流程。英文长终局caption遮角色已修为仅封盘席位预留空间，实际终局bbox断言与root/L双语PNG目检通过。

最终源码/目录20 verified/44 planned：**受影响后端964/23966/87文件**、type/deps/boundaries/i18n过，包含54真实本机SDK/ACP/MCP/混合两语完整局与每局严格Tape、两板40受限seed自然零拒绝回退与双方分支、8SDK HTTP/进程内ACP故障/failureTape。front **139/1224**、type/build、修正后实际Chromium **58**与双语实际PNG过，[三路复查](reviews/p7-hybrid.md)0残留。按delivery功能门槛，没有把奇商旧686历史局说成本笔全重验；累计740人工本地局各有来源范围，P7结束再全已支持release/矩阵。

六/十二 AWA board/game示例可加载；未读写用户configs/认证或调用外部模型。P7余魔镜少女、觉醒隐狼、黑市商人三项及P8–P10／22机制全矩阵／长局／T6目标保持，完整目标尚未完成。

## P7：魔镜少女规则冻结

[规则卡](rules/awa-mirror-girl-v1.md#mirror_girl)与[实现边界](mirror-girl.md)按网易2023-10-26正文和官方35/126秒规则帧冻结具体role禁重复；明确AWA独立600/mirror policy、optional/空目标闭夜、稳定ID/复活保历史、fresh copy/gift与完整transfer、原ID/来源/历史提交终验。三policy分别提示/调度、不借Garg原生完成权，四普通狼AWA例不冒原觉醒隐狼镜隐迷踪。R/A/L/D[冻结复查](reviews/p7-mirror-girl-rules.md)0文档阻断。本笔纯文档，不注册角色/policy或配置，目录20 verified/44 planned不变；共用作用域缺口独立fix，后续完整Mirror启用必须过全部角色门槛，P7余3及P8–P10/T6/长局保持。

## P7：具体身份查验原归属修正

Gargoyle/Psychic共用执行器绑定原ability ID/activation与来源ref/分类/owner，gateway和label callback后重验当前实例目标历史；Garg已付完成权限另保存原稳定actor/ID/private owner，正常闭夜消费后仍可出刀，撤权不回滚报告或资源。根6旧请求/重复历史反例、A已付ID意见及根5种paid撤权、R/T gifted→native伪装阻断依[独立审查](reviews/p7-role-inspection-scope.md)修正闭环。

最终冻结源码受影响 **750/22358/53文件**，type/deps/boundaries/i18n与专有core72/494通过；包含既有72双语SDK/ACP/MCP/混合完整局、四板80受限seed与每局严格Tape、赠予小任务；front139/1224/type通过，呈现字段/前端源码未改，未重复无相关变化browser/PNG。R/A复查与L/D最终登记0残留，目录20/44不变，Mirror仍planned，后续完整启用与P7余3/P8–P10/64/22/长局/T6继续。

## P7：魔镜少女完整交付

第21项mirror_girl沿[规则卡](rules/awa-mirror-girl-v1.md#mirror_girl)/[实现边界](mirror-girl.md)增加独立600 mirror policy：optional、整局按实例稳定ID禁重查、无目标闭夜不花uses、真Good神/胜利身份不变；Garg180/原生查后刀及Psychic600/repeat保持独立。能力贡献与实际实例预收三handler、显式Prompt/Baseline/ObservedBot映射；fresh native/copy/gift空历史严格校数组结构，transfer保完整旧状态，重apply/复活不清native历史、转出不补发。

A审发现完整ability/source与事件裁剪漏洞、假空history结构，已改元数据/state/history/result/source字段白名单和真正空数组校验；God原资料保留、玩家不继承未知内部字段。R逐盘核八人工oracle与末目标变历史/取消/原life/闭夜；king徽reason按直接放逐voted_out修字面预期。L/D实图确认验尽目标时所有人仍活，no_targets文案改为“没有可查验的存活目标”，原机器reason/原话不改。

最终目录21 verified/43 planned源码的受影响 **1065/34931/95文件**、type/deps/boundaries/i18n通过；包含新48及旧Garg/Psy72实际本机两语SDK/ACP/MCP/混合完整局与每局严格Tape，两板40受限seed自然0拒绝/回退、真实报告/skip正分支无重查。front147/1278/type/build、双语实际PNG与最终实际Chromium **62全部通过**；三路最后登记见[审查记录](reviews/p7-mirror-girl.md)，首轮旧测试断言误改不是全browser通过证据。

六/十二AWA board/game可加载，未冒觉醒隐狼原镜隐迷踪已交付；未读写用户configs/认证或调用外部模型。历史累计788人工本地局含本笔新48；本笔仅重验受影响120，不冒旧740全矩阵重跑。P7余觉醒隐狼/黑市商人及P8–P10、22机制全矩阵/长局/T6持续，完整目标尚未完成。

## P7：觉醒隐狼规则冻结

[规则卡](rules/awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf)与[实现边界](awakened-hidden-wolf.md)冻结原七角色/十二人镜隐组合、580即刻模板标签/实际900激活、主动实际激活次夜与Hunter同夜末armed、独立资源与无目标wait；once额外刀可留后夜、独立刀毒盾无机械反毒/破盾/模式/自罚。A关于迟到激活、Mirror原库存依赖、双盾毒顺序，R关于Native/复制枪类型及玩家event档stage推来源的意见已明确修正，见[冻结审查](reviews/p7-awakened-hidden-rules.md)。本笔纯文档，Aw仍planned/目录21 verified43 planned不变；随后按底座职责分笔及完整Aw/原12板通路/双语/全gate启用，P7余2及P8–P10/64角色22机制/长局T6继续。

## P7：中立玩家枪底座

NativeHunter内部/God旧hunter_shot保持，玩家visible_events统一player_shot{actorId,targetId}与玩家event档death_shot；白名单不携trueRole/库存/模板，ObservedBot排死、前端席位与双语字幕识别新事件。A发现审计遗漏新枪，同时补机械成功枪；blocked/silent不计。Aw尚未启用，21/43保持。

受影响backend163/1976/24文件与type/deps/boundaries/i18n57通过，6实际双语十二人LLM/ACP/MCP/混合完整局及每局Tape、玩家type/stage/PID验证全0；frontend149/1296/type/build、新增双语实际Chromium2全通过（2.3min），两个合成协议变体PNG frame4870核四死/0winner与中立字幕。详见[底座审查](reviews/p7-neutral-player-shot.md)，本笔只验受影响通路，未冒新Aw、外部模型或全已支持阶段release完成。下一笔正常额外刀/吸毒盾和实际900，随后Aw完整联合板及P7余2/P8–P10继续。

## P7：觉醒隐狼刀毒盾底座

NightAwakenedEffects独立typed盾/普通额外刀提案，NightPipeline空数组透传，Damage不拥有角色库存/ready/工具窗口或真实死亡。普通额外刀守救互消/Dream/独立盾判定，Aw盾先吸原毒再机械反射、也挡返毒且不递归；新awakened_hidden_knife沿普通刀遗言/严格全部来源枪许可。旧毒施者死保付费前缀/原目标life、其它伤害与机械原有穿盾反毒语义保留。

受影响engine731/9468/48及static四项通过，随后受控pipeline透传新例与Aw/旧Mechanical窄门槛48/107通过；机械reflection/extra/twelve双语SDK/ACP/MCP/混合18实际完整局、4260断言及每局Tape/PID验证0。见[本笔审查](reviews/p7-awakened-damage.md)。前端/呈现协议未变，不重复无关图/浏览器门槛；本笔不是Aw实际对局，paid owner/学习/实际900/原12镜隐板随后完成，21/43与P7余2/P8–P10/64/22/长局T6持续。

## P7：觉醒隐狼资源状态

六模板独立typed状态、actual夜末提交时间、Hunter同点armed/主动下一夜、Mirror单实例ID、独立接刀事实与固定首夜、once额外刀晚学和保留、Guard非法连续不支付/skip断链及单毒无补库存落为纯状态操作。JSON独立存储/六skill白名单投影，不复制目标历史/库存/人格，也不建机械mode或统一复制框架。

受影响116测试/672断言/5文件与type/deps/boundaries/i18n57通过，见[独立审查](reviews/p7-awakened-state.md)。未加Role枚举/profile/export/阶段/配置，未冒真实900或完整Aw对局/Tape，仍21/43；后续原owner/phase/life/学习实例安装与ready原子提交、全部真实Aw技能/接刀/枪及原12镜隐板继续，P7余2/P8–P10/64/22/长局T6保持。

## P7：觉醒隐狼运行候选（工作区未提交）

真实角色/阶段/接刀/枪、Mirror实例与私有双语投影已接入候选，审查修正gun metadata、同日权限重开、native Mirror owner及末候选消失路径。运行58/244、严格本地optional28/162与生产SDK坏JSON/错ID及取消8/40、默认生命周期40/212通过。十字面场景SDK预验9/10通过，原12镜隐组合预验成功；原生Guard连续自守的剧本已改尚待再验。详见[候选记录](reviews/p7-awakened-runtime-candidate.md)，其中明确旧886门槛/预验hash不是最终证明。

正在完成共享strict失败策略与真实MCP schema早拒边界，再做failure Tape/配置/40seed/60双语SDKACP混合局/最终呈现与交叉复查。Role/Profile在工作区候选，shared catalog仍planned/21-43，未提交或宣称Aw交付；完整64角色/22机制及P8–P10/长局T6继续。

## P7：公共严格失败策略交付

1d6124e独立提交公共策略：strict请求的领域拒绝、传输失败、取消/截止及最终交付迟到不再伪装合法wait；默认旧策略保持，3次正确nonce拒绝封闭，一/二次纠错有效、辅助/旧回合不耗行动预算。SDK早期坏JSON与本loop错nonce、生产MCP canonical schema早拒都有正式路径；SDK/ACP结构化失败原因和策略进Tape。

最终工作区受影响367测试/6014断言/49文件、front149/1296/24/type与backend静态门槛通过；由HEAD+仅暂存18公共文件构成的独立/tmp快照，不含Aw源码或依赖测试，最终37/303/type/deps/boundaries/i18n57通过。三路审查均闭，详见[公共策略审查](reviews/p7-strict-turn-policy.md)。Aw四failureTape例仅候选证据，不冒公共HEAD已启用它。

Aw候选与正式配置例子仍在工作区；六人AWA缩编和原12镜隐牌组加载、未知角色组合/参数及重复Aw拒绝15/46已通过。其余40seed、全60双语真实本机矩阵、最终catalog/呈现/三路交付与P7余黑市商人、P8–P10/64/22/长局T6继续，目录仍21/43。

## P7：觉醒隐狼完整交付

有限七角色组合、六模板、580即时身份伪装与900实际夜末激活、原生Mirror独立实例、单毒/可空守/被动枪/可保留额外普通刀及独立接刀已交付。已付效果与原life/owner、整批死亡后的权限更新、中立玩家枪协议、strict失败录制和中英私有投影保持各自所有权。六人AWA缩编和原12镜隐迷踪board/game样例均通过配置与真实整局。

最终冻结目录后**60双语实际本机SDK/ACP（注入MCP）/混合完整局＋40受限seed**及每局strict Tape通过，32测试/11544断言；十条人工oracle覆盖六模板、夜末枪、死亡连锁、毒库存不继承、空守断链、晚学与额外刀留用。随机局两板自然结束、0拒绝/回退，实触发学习/激活/接刀/skip/复制毒；其它技能正分支由手写整局保证，不声称20seed随机覆盖全部技能。

后端受影响**1223/14272/104文件**、type/deps/boundary/i18n57通过；frontend **157/1370/25文件**、type/build、6实际中英Chromium和两张中英实际PNG通过。新增复合死因断言曾错误要求数组先后，改核完整集合后63专项/276及最终受影响全量均通过；生产规则没有为适配断言改变。见[交付审查](reviews/p7-awakened-hidden-wolf.md)和历史[候选修正记录](reviews/p7-awakened-runtime-candidate.md)。

当前22 verified/42 planned。本笔不是全backend release或P7阶段结束；P7黑市商人、P8–P10、64角色/22机制全矩阵、长局及外部模型T6继续。未读写用户configs/认证，未调用外部模型。

觉醒隐狼完整功能commit `83e6379`（57文件）；三路最终0，详见正式审查。黑市商人规则与[实现步骤](black-market-merchant.md)已完成[三路文档冻结审查](reviews/p7-black-market-rules.md)，0残留，仍planned且22/42不变；先被动赠枪授权底座，再完整角色与延期主动槽，最后P7整阶段验收。

## P7：死亡许可实例绑定

World短期death permission与当前请求的ability_id严格匹配，原生undefined兼容；赠予ID不能附遗言或借原生许可，旧close不撤新库存许可。仅授权底座，不建立赠枪库存、自动第二枪或注册Black。新11核心与2双语实际SDK/MCP反例、旧18双语实际枪整局/Tape、受影响1050/11744/72文件及四项静态通过，见[本笔审查](reviews/p7-death-action-instance.md)。原schema/事件/前端文字不变。目录22/42与Black后续实例/角色、P7验收及P8–P10全目标保持。

## P7：独立被动赠枪底座

独立DeathGun与owner/World/body/metadata作用域、真实900激活、各native Hook真正commit后关闭permit再gift、paid shot生效终验和首次死亡finally永久过期已接入；source/DTO白名单及共用中英状态/事件标签完成，原身份/阵营/胜利不变。Profile即使夜初无库存，也能贡献夜末处理器；不增加Black注册或交易/公开板。

独立审查修复跨World借权、target ID与lifeScope错配、judge标签遗漏和malformed armed/null状态，原审查者probe闭环。核心39/254、16真正SDK HTTP/ACP进程+注入MCP与私人记录、4受控PM完整临界局、旧18实际双语完整局/全部Tape、受影响1188/13101/87文件通过；前端163/1429/type/build、4实际浏览器与中英最终PNG通过。见[本笔验收](reviews/p7-gift-gun-foundation.md)。

目录仍22/42。新gift严格Tape随真实Black交易启用后验证，本笔不冒Black完整交付或新板模拟；下一笔完整角色/延期主动礼物与例子，再P7全已支持验收及P8–P10/64/22/长局/T6。

## P7最终黑市商人与阶段收尾（2026-10-09）

Black完整功能commit `83cac45`；赠枪底座 `5c41428`、死亡实例许可 `0c3c878`、规则冻结 `0b389d8`。另以 `3bcadb6` 独立修正11份旧配置测试中的planned角色例子，31测试/179断言通过，未改生产规则。Black新增84实际本机双语SDK/ACP/MCP/混合完整局、40自然seed及4受控失败Tape，最终48测试/13906断言通过；三路功能末审0残留。

最终全backend release **2027测试/184573断言/182文件/0失败**，type/deps/boundaries/i18n（57精确例外）/smoke全部exit0；前端173测试/1496断言、type/build及全78实际Chromium通过，两Black双语PNG root/L独立目检。A、R/T、L/D复核正式文档和全量终态后0阻断。详细范围见[阶段验收](reviews/p7-activation.md)，下一Agent从[交接](handoff-p7.md)进入。

本轮止于P7，当前23 verified/41 planned。P8–P10、64角色/22机制全目标、定时1000seed、发布长局/T6未完成，不访问外部模型或修改用户认证；保留后续指令入口。

## 2026-10-09：P8–P10接续授权与范围更新

整改功能05cd47b、浏览器证据024a933已获用户验收并普通推送，随后授权“完成所有剩余任务，避免停下来询问”。恢复41角色（P8 3/P9 38）、有限首组事件道具及P10；不重复觉醒隐狼或扩大长期候选。执行契约见[持续实施](contracts/p8-p10-continuation.md)。本笔只更新docs执行边界，P8三角色来源核验/规则卡继续，目录仍23verified/41planned。main线性小提交，本次新提交暂不推送，不读用户configs/秘密或无界调用模型。

## 2026-10-09 P8 首项：咒狐

[规则卡](rules/netease-cursed-fox-v1.md)与[三组审查/验证](reviews/p8-cursed-fox.md)已交付；implemented首项、剩余40项planned，P8/P9/P10持续推进。三组源/执行/时序问题修复复查关闭；本批2441后端、229前端、88浏览器无失败，1000固定seed局及48实际双语SDK/ACP/MCP局含strict Tape。未推送、未运行真实模型；总体任务等待用户最终验收。下一项丘比特规则草案正在核对计数、保密与殉情波次，不把草案登记为支持。

## 2026-10-09 P8 第二项：丘比特

[来源策略卡](rules/sourced-cupid-v1.md)区分网易2017丘比特始终跟随与Lui-même未被选丘比特仍随好人，保留真实身份/刀权、情侣互认ID、殉情禁技能和完整链后胜利。三组审查发现的请求构造撤权、当前关系DTO生命、数组choice丢失、取消与外部种子漏链均修复复查。60实际双语三transport局/Tape、480受限ObservedBot局逐局Tape、1200World基线、前端/浏览器与最终源码门禁分别见[验收](reviews/p8-cupid.md)。implemented已2项，23verified/39planned；杠精与首组事件道具、P9/P10继续开放，不关闭总体用户验收。本批只本地commit，未push或调用真实模型。

## P8 第三项：杠精（2026-10-09）

杠精implemented，来源为Melbourne Masters 2026特定赛事，唯一具名AWA普通发言前改编。匿名活人严格过半、整局一次付费、临时普通/PK禁票、完整徽资格与配置权重、原发言顺序/骑士自爆间隙、生命/身份/phase撤权及前端活人翻牌均闭环；三组已报告项修复复查关闭。见[规则卡](rules/awa-melbourne-debater-v1.md)/[验收](reviews/p8-debater.md)。最终冻结源码后完整backend 2648/237397/219文件、frontend248/2411/36文件、Chromium104/104均0失败；check/lint/format/build通过。36实际本机双语三transport完整局/Tape、320受限观察局逐Tape、1008独立World基线分别记录。当前23verified/3implemented/38planned；首组事件道具/P9/P10继续，总体等待用户最终验收。

## P8 首组有限事件与道具：匿名墙（2026-10-09）

发行商New Moon匿名墙独立变体适配为AWA首日完整非终局Voting后一次窗口，唯一event pack与anonymous_note个人实例；默认关闭、七基础组合有限支持。schema/库存/私有提示、晚撤权/异常finally、匿名多重集合shuffle、God与公共矩阵、录制/严格Tape及共享回放呈现闭环。三组审查与共享夹具污染修正均复查关闭，见[规则卡](rules/awa-wall-notes-v1.md)/[最终验收](reviews/p8-wall-notes.md)。最终backend2726/247401/222文件、frontend258/2508/38文件、Chromium112/112全部0失败；check/lint/format、双端build通过。24实际双语本机SDK/ACP/MCP/混合完整局逐Tape，200受限自然观察局逐Tape与1000独立World基线分别记录。P8既定三角色和首组有限事件道具已implemented；不是36卡/通用道具全部实现。目录23verified/3implemented/38planned，P9/P10继续，总体待用户最终验收。仅本地commit，未push/真实模型/秘密读取。

## P9a 首项：盗贼（2026-10-09）

唯一来源策略真实N+2发牌、两Wolf必选与其它可保留、原生新身份/库存及首夜动作、原物理牌交换/晚授权、私有提示/录制/strict Tape和初始回放身份已完整贯通。52核心/失败Tape/样例测试，90实际双语三transport完整局及逐Tape、200受限ObservedBot逐Tape、1000独立World自然局分别验证。三组只读审查所有报告项修复复验关闭。最终后端2834/266021/225文件、前端267/2601/40文件、Chromium120/120均零失败；check/lint/format、双端build通过。见[规则卡](rules/lui-meme-thief-v1.md)/[验收](reviews/p9-thief.md)。当前23verified/4implemented/37planned，继续P9a其余角色及P9/P10；仅本地commit，整体仍待用户最终验收。

## P9a 第二项：野孩子（2026-10-09）

唯一来源AWA适配首夜必选榜样、实际完整死亡波次转真实阵营/胜利、下一实际Night才双向狼队权限、原始roster与严格因果Tape已贯通。47核心/309断言、60实际双语三transport完整局及逐Tape、8真实严格失败partial Tape、200受限观察局逐Tape、1000独立World自然局（788转换/678实际activation）分别验证。三组已报告问题修复并由原审查者复验闭合。冻结源码后全backend **2932/281583/229文件**、frontend **277/2696/42文件**、完整Chromium **128/128**均0失败；type/lint/format与双端build通过，双语12人实际PNG/shared frame已目检。见[规则卡](rules/awa-lui-meme-wild-child-v1.md)/[验收](reviews/p9-wild-child.md)。当前23verified/5implemented/36planned；main本地commit，继续千面人/P9/P10，总体待用户最终验收，无push/真实模型/用户configs或秘密操作。

## P9a 千面人规则冻结

网易现用公开卡表真实HTTP与静态解码确认一狼强制、无狼仍必选，与已实施发行商Thief默认分开。三组只读审查/复验已关闭空方配置和请求/私有槽/录制字段缺口，共享底座、原Thief兼容与God/本人实际回放门禁冻结于[规则卡](rules/awa-netease-shapeshifter-v1.md)。尚未注册，目录23verified/5implemented/36planned不变；立即接续实现，整体仍待用户最终验收。

## P9a：共用初始身份物理牌底座

Thief 原物理牌/投影/optional 政策保持，共用 kind 所有权与 PM/Night/狼知识门禁已提取；旧接口不暴露其他角色。176 受影响离线测试、90 实际双语运输逐 Tape、200 受限观察逐 Tape与全部静态/后端构建通过，三组只读复验闭合，见[底座审查](reviews/p9-initial-identity-deal.md)。千面人仍未注册，23verified/5implemented/36planned，继续其授权窗口与完整功能。

## P9a 第三项：千面人（2026-10-09）

网易现用卡表直接来源的首夜必选、一狼强制与原Thief optional策略分开，真实N+2物理deal、原native身份/库存及同夜技能、独立God/本人档、严格decision/物理牌因果Tape已贯通。三组只读复核报告全部修复复验闭合，见[规则卡](rules/awa-netease-shapeshifter-v1.md)/[验收](reviews/p9-shapeshifter.md)。冻结源码后全backend **3049/303048/233文件**、frontend **294/2869/44文件**、完整Chromium **140/140**均0失败；check/lint/format、双端build通过。96实际双语三transport完整局及逐Tape、8严格失败Tape、200受限观察逐Tape、1000独立World自然局分别验证；旧Thief90实际双语完整局/Tape保持。当前23verified/6implemented/35planned，main本地commit，立即继续孤独少女/P9/P10，总体待用户最终验收。

## P9a 孤独少女规则冻结

网易num24直接来源与2020相近暗恋者/2024赛事评分辅助已分别核实；首夜关系秘密、真实Good民与独立胜利、原Camp/空Victory授权、精确God→本人lean事件/关闭矩阵及终局winner推断边界，经三路原审查者复验闭合。见[规则卡](rules/awa-netease-lonely-girl-v1.md)/[冻结审查](reviews/p9-lonely-girl-rules.md)。仅冻结文档，未注册；目录23verified/6implemented/35planned不变，立即接续实现，整体仍待用户最终验收。

## P9a 第四项：孤独少女（2026-10-09）

来源首夜崇拜、胜利跟随与双方秘密语义通过独立原组件授权、God五键/本人lean四键事实、原Girl/Good民边、独立胜利目标和失败安全审计贯通。保持Hybrid旧窗口/状态/接口，修正首夜阶段重入、getter、原choice污染和慢ACP中途刷盘边界，三组报告全部复查闭合。见[规则卡](rules/awa-netease-lonely-girl-v1.md)/[验收](reviews/p9-lonely-girl.md)。冻结源码全backend **3164/318832/237文件**、frontend **312/3072/46文件**、完整Chromium **152/152**均0失败；check/lint/format及双端build通过。72真实双语三transport完整局逐Tape、8严格失败partialTape、200受限Observed逐Tape、1000独立World自然终局分别验证。目录23verified/7implemented/34planned；main本地commit，接续鬼魂新娘/P9/P10，总体待用户最终验收。
