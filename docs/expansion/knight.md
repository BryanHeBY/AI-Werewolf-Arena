# P5：骑士接入与契约

普通 `knight`／骑士／Knight 是第十项真实角色；[冻结规则](../rules/awa-knight-v1.md)与觉醒骑士分别登记。下列行为只针对 awa_classic 1.0.0 的明确选择，未实现的狼美人决斗禁牵连在 P6 验证。

## 动作、信息与资源

`duel {target_id,confirm:true}` 指向其他当前存活玩家，只在本板开放的离散 Day 窗口使用，可跳过。本人私有 `knight.canDuel` 与受限观察 `ownState.knight` 同步，所有其他玩家不会看到此机会。接收 `accepted=true/applied=false` 只代表该回合合法候选；真正采纳后一次消费，非法/取消/过期/资源、角色或双方生命变化不消费。

命中按 RoleComponent 的真实 camp；查验伪装不改变判断，白痴的放逐豁免不影响决斗。Wolf 目标死亡，非 Wolf 目标存活、骑士死亡。公开 `knight_duel {actorId,targetId,result:"wolf"|"not_wolf"}` 不额外揭露非狼的好人/第三方或具体牌；狼人互认、狼聊、刀权不授予骑士。

三种合法 stage 与 `context.duel_window` 必须一致：`before_speeches`、`between_speeches`、`after_speeches`。错误窗口/无机会/错误目标/未确认使用独立稳定拒绝码，两语解释来自共享文本；SDK/MCP 同样校验，可在原 turn 纠正错误目标。native schema 中性英文，主动协议/提示按本局语言。

## 所有权与结算

KnightDuelWindow 并发收集并保留双方生命组件、版本、角色/camp 与本人资源引用，最终网关后再验。每窗最低仍合法 ID 一名，未选者保机会；明确无效应拒绝可继续下一候选。该对象不改变 Alive、阶段或胜负。

`commitKnightDuel` 只消费一次机会、写公开事实并返回死亡提案。PhaseManager 拥有提交许可（夜间死亡必须已公开结算），交 DeathResolution 按整波标死→初批遗言→警徽→死亡钩子→追加波次执行，最后判胜。成功目标为 Duel，不能开猎人/狼王枪、不能白狼王带人且没有基础遗言；失败骑士为 DuelFailure，只纯此原因的 Day 初批获本人授权遗言。命中未终局入下一夜；失误未终局继续原发言/投票，跳过已经死亡的演员。

顺序：天亮自爆→发言前决斗；每次普通发言→间隙自爆→间隙决斗；末次间隙处理完→发言后决斗→Voting 与其自爆窗口。间隙含末位，between/after 同开时最后是两个独立窗口，不使一名普通骑士获得第二次机会。实际自爆/终局已中断则不发后续决斗请求。

## 配置与程序接口

```json
"roles": { "knight": { "enabledWindows": ["after_speeches"] } }
```

默认 after_speeches，`[]` 关闭；未知/重复窗口、额外参数拒绝。角色参数归 profile，读取/解析仍走严格 v2。公开[六人](../../configs.example/boards/six_player_knight.json)是一狼/骑士/预言家/三民、无警长；[十二人](../../configs.example/boards/twelve_player_knight.json)是四狼/预女骑白/四民、有警长。两者屠边、关闭狼自爆以聚焦决斗；并非官方标准竞技配比。对应 games 沿用现有 example Agent，可自行选其他已授权配置，不包含认证，用户 configs 未修改。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_knight
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_knight
```

低层 DayPipeline 新增可选 `commitKnightDuel(selection)`，返回 `rejected|continue|night|terminal`；选出真正合法动作却无 callback 时抛 `knight_duel_commit_missing`，不能靠结果对象假装已消费/杀人。其它无骑士板子不需要 callback。结果新增可选 `duel`，既有 summary/selfDestruct 字段保持；PhaseManager 正常入口提供唯一提交路径，错误与已提交前缀按原策略保留。

Role/ToolName/ActionStage/DeathCause 增量闭合枚举、typed 领域事件及严格 Tape 请求/归一化配置同步。公开/私有 schema2 与 Tape2 保留，source/lock/rules/RNG 检查不放宽；前端使用共享公开 DTO，不引入引擎依赖。历史原名、发言、未知事件保持原文。

## 真实验收范围

[角色判例](../../backend/tests/engine/rules/knight.test.ts)覆盖中英严格接收、真实/伪装/第三方 camp、翻牌白痴、三窗/关闭、双末窗、多骑士、生命/角色/资源/阶段变更、原错不耗、自爆优先、两类临界判胜、遗言/徽章及禁枪。

[字面计划](../../backend/tests/support/knight_scenarios.ts)提供三窗命中、失误继续投票、末神失误、命中狼王/白狼王、十二人三日局，共 8 case×SDK/ACP/混合×zh-CN/en＝48 实际本机完整局。runner/bootstrap/记录/SDK HTTP/ACP 进程与 MCP 实际执行；模型决策仅持本人静态计划、不查 World。独立预期核对请求、错误纠正、角色/日次/stage/本人机会1→0、他人私有负例、遗言/徽章/存活/结果及全部 Tape 重放；ACP/MCP 合成 PID 收尾验证 ESRCH。

资源0的实际模型提示正例来自两个六人失误遗言；十二人骑士第二夜死亡，没有次日模型请求，只检查录制 checkpoint 中的已用机会0，不把记录状态当作模型收到的提示。

两板各20固定 seed、显式 active 风格受限观察模拟，只使用本人 DTO 与具名 RNG；要求自然结束、零拒绝/回退、决斗分支正覆盖，每局严格重放。此40局为补覆盖，人工脚本负责限定技能与临界规则。

前端命中/失误档案来自真实 SDK 完整局，双语工作台和纯 frame 均只杀败者、非狼目标保活，终局前无胜者标记、死亡获胜成员保留。Remotion 实际 PNG 分别核对中文命中、英文失误；未改编码管道，已有 P3/G04 的 MP4 门槛保留，不宣称本批另跑视频编码。

最终命令、独立审查与修正见[验收记录](reviews/p5-knight.md)。48局为本地真实接入通路，不是外部模型质量评测；P5 守墓人、后续54项及 P10 发布/真实模型门槛继续。
