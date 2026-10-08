# 实施进度

用户于 2026-10-07 明确授权启动完整目标，P0 结束后的等待要求已满足。持续目标覆盖 P1–P10；长期候选不自动纳入。

| 阶段 | 状态 | 当前证据 |
| --- | --- | --- |
| P0 | 完成 | 文档 commit `5337194`，三路审查闭环 |
| P1 | 完成 | `facea9c`共享目录；`87af121`机制参数执行；v2完整配置、迁移/检查及玩家绑定交付；193后端+33前端测试，三路复查0阻断 |
| P2 | 完成 | T01逐局随机/T02严格脚本/T03受限观察/T04动作录制与兼容回放；227后端+33前端测试，三路复查0阻断 |
| P3 | 完成 | I01–I04、诊断/CLI与受控源码扫描；实际SDK/ACP中英完整场景与Tape重放、前端/视频门槛；英文入口开放 |
| P4 | 进行中 | A01/A02 已完成；M21日志开关专项及G01–G04待依次交付 |
| P5–P10 | 未开始 | 按路线依赖推进，不把目录登记当成实现 |

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
