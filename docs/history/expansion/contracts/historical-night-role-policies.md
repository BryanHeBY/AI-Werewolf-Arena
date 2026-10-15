# 摄梦、狼美人与 Seer 基线复核

核验日 2026-10-09；实施基线 `ef2f48f`，在原目录 main 线性实施。以下是有限具名角色参数，不是完整网易或 S7 板子 preset。没有改用户 configs。

## Seer 的最初实际请求

`eb4f026` 的 `seer/night_stages.ts` 调用 makeRequest 时没有显式 requiresAction；同版本 `engine/phase_pipeline/night_pipeline.ts` 的 makeActionRequest 解构默认 **requiresAction = true**，action_request_factory 与 turn_constraints_context 将它变为 min_valid_actions=1、max_valid_actions=1、required_any_tools=[check_identity]。因此当前 awa_required_when_legal_v1 与最初实际请求一致，无需更改默认或升 ruleset 主版本。

本次把最初提交的 backend/src 与 packages 导出到 `/tmp/arena-seer-eb4f026`（普通临时源码副本，不建分支/worktree），用该版本 bootstrapGame + 实际 runSingleCycle、固定六人角色和返回 null 的离线 provider 采集请求。可复现命令 `bun backend/scripts/check_seer_baseline.mjs`（只读Git源码与依赖，输出与固定证据严格比较；结束清理临时副本）。字面证据提交在 [seer_baseline_request.json](../../../backend/tests/support/seer_baseline_request.json)。没有运行旧用户配置；没有模型调用。当前 [seer_default_tape.test.ts](../../../backend/tests/runtime/seer_default_tape.test.ts) 对省略、空对象、显式默认、target-only、旧内部 config 反转五种入口逐夜比较这份实际请求约束；显式 optional 独立保持 min=0。每种入口三夜录制并严格 Tape 重放。

## 摄梦来源与有限策略

[网易 2026 普通能力回顾](https://langrensha.com/news/update/20260402/26905_1294456.html) 此轮抓取仅返回站点壳，保留此前已读的每夜必选、夜伤免疫、仅夜死牵连和连梦致死条款；不以抓取失败结束核对。[官方账号 2017 技能解析](https://www.sohu.com/a/203299808_729113) 此轮可读正文：强制施梦、目标不知情，夜刀/药/枪落空，连梦不可救，摄梦人夜死牵连，梦死猎人/狼王禁技能。该文猎人枪例没有完整定义后续 Day 来源链；本引擎继续用 Night 来源传播，并把这种传播标为 AWA 工程约定。

| roles.dreamer.protectionPolicy | 行为                                                                                                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| awa_night_damage_v1（默认）    | 与 ef2f48f 兼容。挡普通刀、毒/合法返回毒、机械/觉醒刀、Night 来源枪/魅惑、奇迹反噬；不挡机械守护失败、黑市反噬；不挡 Dream 死因                                                                                       |
| netease_2026_night_immunity_v1 | 保持强制选择/夜关系/连梦/禁枪；将本引擎初始夜伤中的机械守护失败和黑市反噬也归入免疫。**这两项扩展交互是根据“夜伤免疫”作出的工程补全，原文没有这些角色的逐项矩阵**。连续梦亡和施梦者实际夜死牵连仍使用 Dream，不被免疫 |

策略只改变上述已列夜伤矩阵，不开放任意 bool、自梦、弃梦、白天牵连。其它合法目标为空则没有请求；非法/取消/晚提交不构成合法梦，每夜至多三个离线能力请求尝试，失败沿既有处理。Guard/Heal不救 Dream；复合 Dream 禁枪。保护关系绑定演员/目标生命版本，白天普通死亡无保护/牵连，夜源枪虽在 Day 收集仍沿 Night 根传播。独立梦实例用自己的策略，transfer 保策略、lastTarget/lastDay、计数/本夜使用标记；受赠人原生参数不重写实例。政策变化撤销未提交 scope；已提交夜关系保持提交时政策。

机械狼 profile 的支持组合仍不含摄梦人；此次没有放开该公开组合。机械失败与梦交互仅以低层真实 frame/伤害结算测试覆盖，不能称对应公开板子已验。黑市/摄梦属于已支持组合，已通过实际双语对局与严格 Tape 验证分叉。

## 狼美人历史条款与工程补全

[2017 英雄榜 S7 手册](https://www.sohu.com/a/138501023_729113) 狼美人段规定放逐/猎人枪牵连、毒杀不能发动，禁自刀/自爆/相邻夜同目标。不是 AWA 原来毒牵连的来源。[官方账号 2019 狼美人骑士攻略](https://www.sohu.com/a/323447967_729113) 明示可以空连及骑士决斗封魅惑；没有可读取的完整复合死因表，技能图此次链接 404。因此不推断完整 2019 死因矩阵，也不创建同名全平台 preset。

| roles.wolf_beauty.deathLinkPolicy | 放逐 | 毒   | 本次死亡链原生猎人枪 | 狼王/复制/赠枪/无来源 Shot | 复合死因                                                                                                                                         |
| --------------------------------- | ---- | ---- | -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| awa_exile_poison_v1（默认）       | 触发 | 触发 | 不触发               | 不触发                     | Exile/Poison 至少一个且无 Duel/Dream/Lovers；其余死因沿现有 AWA 行为                                                                             |
| heroes_s7_2017_exile_hunter_v1    | 触发 | 抑制 | 触发                 | 抑制                       | 非空且每个原因均为 Exile 或有原生猎人来源的 Shot；含 Poison/Duel/Dream/其它/未知均抑制。**抑制优先是工程补全，不能称 S7 原文规定了所有复合情况** |

原生猎人来源由 DeathResolution 本次 resolve 内真实提交的 hunter_shot 记录，生命周期只限本死亡链；不扫描旧公共事件猜来源，不把通用 Shot 自动认作猎人枪。Night 猎人枪牵连可被有效梦保护；白天放逐/枪链无上一夜梦保护。目标 Charm 死因禁尚未执行的死亡枪，追加波次不重复遗言；已提交合法动作不回滚。关系消费前重验来源与绑定的 policy/角色/state/生命，策略改动撤销晚提案。末狼放逐优先仍是 AWA、只作用于真实 exile_settled 的 slaughter_side 条目；S7 来源不证明此额外判胜规则。

**2019 空连与骑士抑制作为已支持的独立约束保留**，S7 参数仅选择死亡触发表；不宣称复刻完整2017赛事。null/无行动消费本夜、清关系并打断相邻限制。自刀限制保持仅本人的刀票，不因队友目标校验泄漏狼美人身份。这也是 AWA 工程边界，S7 原文未定义秘密校验协议。

## 配置、提示、录制与验收

```json
{
  "roles": {
    "dreamer": { "protectionPolicy": "netease_2026_night_immunity_v1" },
    "wolf_beauty": { "deathLinkPolicy": "heroes_s7_2017_exile_hunter_v1" }
  }
}
```

这是参数片段，完整板子须有对应角色与合法支持组合。省略/{} 归一化为表中 AWA 默认；未知值/字段/无角色参数拒绝。profile schema→BoardConfig→原生 state→运行、独立 ownState DTO、双语板子与角色提示均消费同一策略。反转保存和 reproduction 严格内部 schema 保留策略，当前源码指纹隔开旧 Tape；没有放宽旧指纹校验。既有公开死亡 wire 不新增秘密标记。

[historical_role_policies.test.ts](../../../backend/tests/runtime/historical_role_policies.test.ts)：所有 DeathCause 单项和成对组合、猎人来源有/无；两类 schema 默认/反转/非法输入；scope/绑定撤权、独立 DTO、grant/transfer 政策与计数；真实 frame 复合失败/反噬/Dream；16 局双语实际请求、录制与严格 Tape（毒、猎人枪、狼王枪、黑市反噬）。有行为分叉的 Tape 改 policy 后拒绝。已有 dreamer/dream_scope/wolf_beauty 完整局与 SDK/ACP 回归继续验核心机制。

用户尚未验收，整体扩展任务保持待验收；此次交付不等于所有外部规则或 P8–P10 完成。
