# P7 混血儿规则冻结交叉审查

范围：[规则卡](../rules/awa-hybrid-v1.md#hybrid)、[实现与验收边界](../hybrid.md)。只冻结下一笔角色的明确规则；不注册角色、不启用配置、不改变19 verified/45 planned计数。

## 首轮与修正

- **R/T**：独立重查 Melbourne 角色/板与 GTV 官方 description。核心为首夜支持、平民/验好、随方胜利、本人判断支持方阵营；通知/互认/夜聊/刀权、死亡获胜、快照和错误策略未全部由来源规定，须明确 AWA 选择。卡已单列这些选择，真实狼全死后的 Good 判胜也明确为本版选择。
- **L/D**：汇编资料不应被总标题冠以第一方；修为“来源与版本边界”，标明 `langrensha.net` 不是网易域名且只是自有多版本汇编。
- **R/T、L/D**：旧措辞“公开复盘不含选择”与既有 God 主档含私有事件矛盾。修为明确 God replay 保完整裁判事实，普通公开游戏事件与非本人玩家档不含选择，玩家 DTO/receipt 不含冻结 camp。本笔不新增 anonymous public/player perspective 或静默过滤 God 事件。
- **根代理**：工具采用 `choose_exemplar`、事件 `hybrid_exemplar_chosen`，避免与 AI 模型配置概念重名。实现边界要求原 VictoryComponent 及 affiliation 内容在最终应用仍为空，不能只比组件引用而漏同对象被修改。

## 最终复查

- **R/T（review_rules_psychic）**：复查来源/AWA选择、首夜与原空 Victory、民边计数/冻结 camp/死亡成员、God 与玩家边界，最终 R0，0阻断，支持文档冻结提交；后续实施再核实际通路与字面预期。
- **A（review_arch_psychic）**：复查现有 bootstrap 保留显式空归属、membership 值复制、dead 成员判胜及真实 camp/goodSide 统计，可复用既有引擎。0规则卡架构阻断；补充同步 choice/membership 提交、第二并发回复丢弃、原对象内 affiliations 改写拒绝、110 重入账本等要求。
- **L/D（review_rules_gargoyle）**：最新两文档的工具/受众、God与玩家档、Good身份的Wolf获胜者、6/12×两语实际通路/Tape、每板≥20seed与双方胜利覆盖明确，当前 planned 无冒认。最终0阻断。其本轮直接打开 YouTube fetch 失败，未冒称独立读取字幕或视频；GTV description 由 R 直接核验，来源范围如卡所述。

未完成的角色门槛不算通过；启用笔仍需重新审查实际实现。

## 验证边界

本笔仅 Markdown、进度和角色表链接；不改生产代码、共享运行目录、用户 configs 或认证。`git diff --check`通过，新3文档本地引用和hybrid稳定锚点通过；未重复执行没有受影响代码的整套 runtime 测试。上一笔奇迹商人的1463后端/686完整局与Tape、127前端/54 Chromium证据仍只证明其冻结源码，不是混血儿功能验收。

下一笔必须依卡交付独立成员与秘密选择真实通路、有限6/12板、两语提示/标签与严格受众、生命周期/重复提交判例、字面完整SDK/ACP/混合局及Tape、每板至少20受限seed正分支、实际前端/视频和三路修正复查后才能启用。P7整阶段及P8–P10、64/22、T6/长局完整目标保持。
