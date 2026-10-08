# P3 中文/英文执行验收

## 已开放的入口

- runGame接收ResolvedGameSetup.context.locale/displayLocale，bootstrap明确绑定游戏locale；CLI的--locale只覆盖本次配置副本，--display-locale独立选终端语言。
- simulateGames新增可选locale（默认zh-CN，未知拒绝），CLI simulate --locale与游戏World、manifest/Tape一致。
- 英文reproduction.json可通过既有离线replay:actions重放；语言由已校验metadata进入World，身份名字和动作文本原样。source/lock/RNG/schema/规则兼容门槛保留。
- check报告executionSupport.locales为zh-CN/en，P4 A02后mixedTransports为true。基础七角色及P5狼王/白狼王/骑士已验证当前实现；54计划角色不能因有双语目录而运行。

## 实际通路与人工oracle

生产runner、factory、bootstrap、网关、阶段/结算、投影、记录、收尾未替换。只将外部模型响应替换为本地literal计划：SDK用真实安装的AiSdkClient访问本机HTTP，ACP用真实JSON-RPC进程/SDK与注入MCP sidecar。

计划来自S01/S04/S02/S03，seed预先选择为foundation-six:116、foundation-twelve:124680，实际正常随机发牌必须严格得到人工牌面；没有在runner中启用测试固定牌。每个actor只持有自己的计划，不查询World、其他玩家script或真实引擎结果来生成行动。

矩阵：4人工场景 × SDK/ACP × zh-CN/en，共16自然终局；另2个并行SDK语言对照，共18局。人工核验结果为好人胜、all_wolves_eliminated、day2（S03 day3）/game_over、对应存活列表及牌面。药/枪/守护/翻牌/警长/遗言/自爆细节由既有foundation人工断言和完整事件/CP跨语对照共同覆盖。

- 每个script恰好消费，普通轨迹没有拒绝、错误或fallback。ACP可选pass修正独立提交e498014；不把主动pass当失败。
- wire验证actor/stage/turn，Tape.request.context.day/stage序列逐项对照计划；pair请求/动作（剔除真实并发调度settle/opening时序）必须一致，机器events/全checkpoint一致。
- ASCII固定名字/动作夹具下，英文实际system/turn/tool schema不存在内置汉字；其他自定义名字/原话不要求翻译。源码覆盖由独立受控扫描补足，不以一个运行分支证明所有字符串。
- wire负向检查上帝/其他技能/狼聊不越权，正向确认预言家后续实际prompt收到全部查验target。档案逐actor轮数与language、无fallback标记、manifest/公开/私有格式核对。
- 每局Tape实际离线重放到相同终态，并行游戏的World/AsyncLocal记录作用域/语言独立；每个录制checkpoint/请求保原事实。
- ACP fixture持久化的agent/MCP PID是合成进程，收尾实际检查ESRCH；不只验证close方法调用。trace不保存控制token、provider配置或认证。
- display刻意与游戏语言相反，实际确定性审计摘要使用display语言。真实SDK/ACP审计检查/总结与MCP授权由既有I02多任务入口测试联合验证。

## 公共提示API与源码门槛

Alive/Camp/Badge/VotingRight/StatusMarks/Role的renderPrompt支持显式locale；工厂可绑定默认语言，bootstrap绑定World.locale。一次展示覆盖不改变默认语言或组件资源。Camp展示当前字段，不再捕获创建时的旧值。裸Role组件使用共享角色名；bootstrap的RoleCatalog仍用角色自身完整技能提示覆盖它。默认phase贡献表改从共享term生成，不再维护文本副本。

SDK旧tool历史仍按兼容端口作为user文本传入，前缀改稳定机器标记[tool_result]，原内容/类型转换策略不改；实际本机HTTP验证没有中文固定前缀。

release:check新增lint:i18n。TypeScript AST扫描backend/src、frontend/src与frontend/scripts的StringLiteral、模板head/middle/tail及JSXText，覆盖Unicode Han；忽略注释及测试数据。精确file/text/count例外见[i18n-source-exceptions.json](i18n-source-exceptions.json)，增量、删改、缺理由与未批准literal均失败。没有整个角色/目录免检：57处保留项仅旧gateway/tool-spec默认中文metadata、默认win-condition描述、历史phase别名和原生语言选项。真实SDK/MCP的主动协议及规则摘要已用共享双语builder；这些旧无locale查询API保兼容，不能当成新功能文本入口复制。

不扫描目录内shared字典的中文值属于独立I01 key/参数/缺译校验责任。未使用“禁止所有汉字”规则抹掉原始用户内容。

## 当前行为与后续边界

P3交付时，末神禁枪、重复白痴资格和自爆警徽残留仍为已知差异；跨语相等只证明当时同一实现。P4已统一共同接收，修复[死亡来源/末神](death-causes.md)、[死亡链及自爆警徽](death-chain.md)、[白痴/警长资格](public-participation.md)，并开放[四窗口](self-destruct-windows.md)；独立oracle与新增真实通路门槛见各批审查，不能将P3历史边界当作当前未修清单。

本阶段未调用外部模型或读取真实认证；actual transport是本地合成agent/provider，不声称已完成Codex/Claude真实模型质量评测、发布级长局/并发故障矩阵、所有64角色或22机制。P4–P10继续完整目标。

P5狼王接入后，shoot的旧HUNTER_TOOL_SPECS路径仍保留，但native描述已改英文角色中性；该项无locale静态API不再默认中文。实际SDK/MCP协议和行动hint仍双语，迁移边界见[狼王契约](wolf-king.md)。每轮共同提示显式给当前日次。
