# F01：生产回退不恢复过期狼队资格

## 已确认差异

真实 `a6e62126` 旧源码上的四个原 SDK／ACP 用例均失败：请求还列出狼聊或狼刀工具时，生产观察回退忽略本局明确撤销的 wolfTeam 政策，仍返回行动。旧轨迹保存在下方固定证据中，本笔作为独立 F01 行为修正，不能称作旧策略等价搬迁。

## 新政策与职责

PlayerObservation 必填 `currentWolfActions`，只有自己的 `canChat` 和 `canVoteForKill` 两个布尔值。角色目录通过原 supplier 注入；完整游戏捕获在原知识、公布存活、行动、能力与枪字段读取之后，查询当前 actor 的原 wolfTeam 政策。自定义政策结果读取后，仍核对自己的当前角色引用、角色标识、阵营和存活量。

这两项是资格快照，不是原生命或请求 lease。引擎提交仍验证当前性、目标、库存与资源；不返回撤权原因、对手真实存活／身份或运行句柄。knownAliveIds 继续依已发表死亡计算，队友知识和历史状态不能代替当前狼队资格。

生产 fallback 按原 allowedTools 和 handler 顺序选择；狼聊／狼刀还必须分别得到 literal true。某工具不具资格时继续找后续已允许的工具，无可选行动返回 null。原文本、首候选、方向、其它工具、期限、取消与记录流程保持。SDK 与 ACP 已使用同一个 project→strategy 接线，没有新的传输包装或模型调用。

## 交付与证据

- 4 个主源：观察 DTO、完整捕获、仅传 Catalog 的提示策略、受限 fallback。
- 3 个旧手写 DTO／捕获 fixture 补明确 false 和 Catalog supplier，不改变旧断言；同期 C44 World 类型参数退出独立归属。
- 新 6 个有限用例：两语言正向允许／独立撤权、旧工具名单、literal true、按原优先级继续、对手未公告死亡与库存隐私、冻结、自己的死亡撤权、可信政策回调中改角色／阵营／生命的撤权。游戏根流和所有 fork 的 next 都由独立测试日志计数，捕获不额外抽取。
- 原四个 SDK／ACP 用例保留原断言，真实 4 pass／0 fail／8 断言。新 6 个不同 case 最终有绿 receipt，共 31 断言；新合法 stage 修为 wolf_discussion，随后加强 RNG 用例及增对抗用例，只复验改变的用例。没有重本批其它已绿的套件或完整对局。
- 4 个原完整程序在只反演本 F01 增量后，AST 与 ESNext／CommonJS 输出相同；3 个旧 fixture 完整断言、字面值和正文在具体输入增量及独立 World typeargs 逆后相同。
- 8 个职责头检查无失败；公开 events、replay-contract 入口、记录契约与 reproduction schema 四个真实 Git 控制字节不变。没有新增公共事件、归档字段、玩法或 RNG。

首次有限类型进程 44344 实际退出 2：新测试使用不存在的 wolf_chat stage（只修新 fixture），其它错误来自同时移除 World unchecked generic 的临时采样。稳定后的有限 9 个 root（8 个本批源／测试及原四个 SDK／ACP 用例文件）真实进程 35267 已退出 0；这是有限依赖闭包，不是全仓类型。未把中间失败写成通过。不跑计费模型、物理传输、全套门禁或新的复盘验收。

固定证据与独立审查见[收据](generated/fallback-current-wolf-actions-evidence.json)。其他观察、状态、目录迁移和最终同输入全量验收继续执行。
