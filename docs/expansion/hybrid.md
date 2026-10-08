# P7：混血儿实现与验收边界

规则依据与 AWA 选择以[冻结卡](rules/awa-hybrid-v1.md#hybrid)为准。本文是下一笔角色实现要求，不是已交付功能说明；当前 Hybrid 仍为 planned，不能配置运行。

## 状态的唯一负责人

复用现有 `RoleProfile`、首夜阶段、`VictoryComponent`、动作接收与玩家投影。无需新增阵营类、投票引擎或 Agent 基类。

| 事实 | 所有者 | 玩家可见范围 |
| --- | --- | --- |
| 真身份 Hybrid、真 Camp Good、民边 | RoleComponent / RoleProfile | 本人，及规则允许的查验者 |
| 首夜是否已选择、榜样稳定 ID、选择日 | 本人 role.privateState 的 Hybrid 状态 | 仅本人，投影显式字段白名单 |
| 冻结榜样真阵营与胜利成员资格 | 独立 VictoryComponent.affiliations | God / 严格内部 Tape；不是普通观察字段 |
| 狼队互认、夜聊与刀权 | 既有 WolfTeamPermissions 查询 | 不从胜利归属派生 |
| 存活人数与民边人数 | 原真实 camp 与 profile.goodSide | 既有判胜条件读取，不查 affiliations |
| 最终胜利成员与判定点 | PhaseManager 封盘的 GameResult | 终局公开，不附带榜样 ID |

初始 affiliation 是显式 `[]`；合法选择安装 Good 或 Wolf faction membership 的独立值。自身选择状态不得保存已推断/实际榜样阵营、对象底牌或角色组件引用；提示明确“未知，需自行判断”。已有阵营计数及结果呈现可以复用，必须以实际角色测试证明分离语义。

## 一次合法提交

`choose_exemplar` 使用稳定工具名、整数 `target_id`、首夜必选约束与三次无效回复上限。补齐动作联合类型、工具 schema/参数修复、validation、目标提示、stage、规则错误与中英提示；SDK 与 ACP 使用同一接收校验。默认机器人也必须仅基于自己的观察 DTO 行动。

首夜阶段捕获原 actor role/privateState/Hybrid 状态/生命与原空 VictoryComponent；提交前对 owner、资源值、阶段以及 affiliation 仍为空再次检查，防止同一组件被别的动作原地修改。合法候选只按公开存活和本人 ID，内部额外捕获目标原 role/camp/privateState/生命，用于迟到响应复验，不能拿隐藏牌过滤候选或透露错误差异。

await 返回、gateway 完成与实际应用点检查同一作用域。成功才同时提交自己的 choice 和独立 membership，中间无 await，并追加一条 actor-only `hybrid_exemplar_chosen`；无效/过期/撤权不改新 owner。并发只接受首个合法提交，第二个回复丢弃，不覆盖或误报已经完成为缺失。提交后的 affiliation 不依赖目标引用、生命或后续 camp；本夜/后夜重复提交不重置机会。phase 结束和最终判胜由现有流程拥有。

## 记录与展示

本人事件及 ownState 仅含自己已经选择的 ID/日/状态；不提供隐藏 camp 的 receipt、God 因果字段、target 真实身份或狼队信息。严格 Tape 保存 God checkpoint 中的 affiliations，以复现成员变化。普通公开游戏事件与其他玩家档不含选择；既有离线 `replay.json` 明确为 `perspective=god`，保持完整裁判事实与事件序列，不过滤这些合法私有记录，也不把此文件声明为匿名公众视角。本笔不新增 public/player perspective。终局 decision 可以列出身份仍 Good 的 Wolf 获胜者，也可以列出已死混血儿，不改其真实 camp/角色/座位。

控制台遵守现有 private-events 开关。共享中英事件标签用于私有/God 展示；原始玩家发言与人格不翻译。前端 God 时间线可显示合法私有事实，但帧投影及 Remotion 不因选择触发身份、阵营、死亡或座位变化。

## 实施与功能 commit

1. **规则冻结文档**：来源、AWA 差异、所有权、有限支持板及验收要求；三路独立审查复查。此笔不注册枚举/profile、不改变可用配置或已验证数量。
2. **完整角色启用**：状态/阶段/工具/校验/观察机器人/受众、两语规则与标签、六/十二示例、核心与组合判例、完整本地通路及严格 Tape、随机种子、前端与视频；关闭审查意见后，才更新目录 verified 并按功能提交。
3. **后续组合**：本卡之外的 Merchant/Mechanical/Psychic/第三方/关系/变阵营等联合板，另冻结语义和测试后扩大双方 profile 白名单，不能单方添加枚举就声称支持。

完整启用前必须证明：Good 和 Wolf 榜样、HiddenWolf 伪装但真阵营冻结；非法/重选/撤权/组件原地改写；狼混验好且无狼权限；真狼全死与民边/屠城/半数条件；榜样和自身死亡后成员；首夜死亡遗言与警徽顺序；God/玩家/public 受众差异；6/12 两语 SDK/ACP/MCP/混合字面 oracle 完整局及严格 Tape，受限每板至少20种子与正分支；实际 Chromium 和双语 PNG。

R/T 审规则与独立预期、隐藏状态反例；A 审状态/原生命/重复提交/资源与严格重放；L/D 审双语、DTO/玩家档与 God 复盘/终局身份与成员显示、配置与证据计数。每轮保留首审、修正及原审查者复查，依据 [delivery.md](delivery.md) 执行受影响门槛；P7 结束另做整阶段门槛。外部模型 T6、P8–P10 与长局目标不由此笔文档或本地通路通过替代。
