# P3 I02 审计摘要交叉审查

日期：2026-10-08。范围：确定性MessageRef/标识、中英摘要/关闭AI的fallback、词面筛选、固定标题与任务证据解析。

| 代理 | 首轮发现 | 修正及复查 |
| --- | --- | --- |
| `review_scope_rules` R/T | summary用了全局证据而非本任务实际证据；None分支跳过缩进检查 | 取merged findings证据与global交集；None原始行exact并先检查格式。任务权限/真实ACP回归28测试382断言，最终容器10测试134断言，0阻断 |
| `review_arch_tests` A/T | 缩进/closing hashes/未知标题可绕过；phase自由字段可注入；引用块和list内标题仍被渲染 | 固定顺序/标题白名单、自由文本NL/HTML/原文marker展示编码、禁引用/容器header；逐层列表前缀缩短，不用歧义嵌套regex。最终独立10测试134断言与额外容器探针，0阻断 |
| `review_i18n_delivery` L/D | HTML comment能隐藏整个合法结构；同形未知phase不标异常；NLU词面可误报 | 禁HTML/comments/CDATA与代码格式，unknown requestPhase也需known集合；未知原值保留。文档说明API/旧Markdown及词面局限，复查0阻断 |

## 验证

- 后端release272测试0失败，类型/依赖/边界/对局/回放/真实SDK/ACP/MCP/烟测通过。
- 自动check/观察返回code/key/params；人工oracle核对中英code、actor、evidence和计数，渲染/展示切换不改输入。
- 无audit、无report和生成摘要被拒绝时均按displayLocale；null winner不显示未知阵营获胜。
- 中英bug/策略/角色/药声明及精确历史phase对照；词面结果仅待核查迹象，角色声称允许诈身份。
- 完整generator两种相反检查/展示语言组合及实际ACP/MCP有效PID退出继续通过；模型输出通过校验后原样保留。
- parser拒绝未知/重复/变体/容器/隐藏HTML/代码段、格式骗marker、非法数值和本任务不可见证据。容器测试使用授权evidence=2，单独证明格式拒绝。
- 原字段及自由文本展示编码防伪标题/引用，原录制未改。旧已存Markdown不转换；新生成验证门槛和自动checks MessageRef API变化已写明。
- 没有调用外部模型。游戏规则/资源/受众未变；终端、I03/I04与阶段总验收仍继续，英文runner尚未开放。

三路最终复查剩余阻断：0。
