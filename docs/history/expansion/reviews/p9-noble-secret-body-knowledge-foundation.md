# 觉醒之夜：独立已告知状态基础

本切片在[原生命所有权基础](p9-noble-secret-body-authority-foundation.md)上增加同owner持有的知识与通知账本，未注册两新角色或接入玩家提示、正式事件feed、MCP、Tape、前端。正式48/64不变。账本可由God快照序列化，尚未接入正式checkpoint。

## 唯一资源与玩家边界

实际身体仍只有`privateState.secretBody.body`，实际契约仍只有`privateState.noble.contracts`。没有新增可操作库存或NightAbility uses/maxUses影子资源。知识仅记录玩家已被授权告知的事实，不能决定实际伤害或技能资格。

- `beginNobleBodyNight`合法取得新夜所有权后同步提交通知receipt及独立账本，随后才能打开选择。即使身体已耗尽、贵族旧约占用而整夜没有新技能请求，两人仍获通知；原生死者不新增通知或静默更新。调用方必须先将receipt写入私有feed再发送任何新夜请求，并负责已经结束的游戏不再开夜。
- 身体只获`intact`／`spent`／`exile_revealed`、告知夜、本人主动选择及公开翻牌日。即使下一夜，也不复制实际抵伤目标、来源或消费夜；实际保护主选目标或自动回退本人，玩家输出同形。
- 贵族立即知道本人选择与新pending契约。猎魔清除、目标真实死亡或到期只改真实契约；下夜通知才更新已知终态及日期。返回旧receipt不随新选择或终态变化。
- 白天`awaitingNightReport`按公开phase产生，不比较actual与known。无实际变化也显示同一等待标记；本人公开翻牌已知消费可立即更新，不将夜伤消费提前输出。这里phase与活跃游戏资格由未来正式调用方提供，不接受模型context作为时序凭证。
- 白天免放逐同步更新已知`exile_revealed`与公开日，不改Alive；不修改旧通知记录。真正翻牌事件与专属发言仍待接入。
- `getNobleBodyPlayerState`只取独立knowledge；`snapshotNobleBodyAuthority`同时保留实际状态、knowledge与notices供God审计，绝不作为玩家返回。

知识state与夜初receipt递归冻结且脱离内部对象。DTO及God快照的外层包装可变但detached；God实际状态副本可变，不声称所有返回对象整体deep-frozen。纯复制函数输入是可信typed knowledge，不作为unknown parser。

## 交叉审查

R=`review_scholar_rules`、A=`review_configuration_closure`、T/L/D=`review_scholar_delivery`只读原/tmp用例，无新增P1/P2。

- R6项／38断言：完全无请求夜仍通知、到期／白天真实死亡延后、死亡演员保留已知历史、不同实际目标同形、后续abort保留合法已提交通知、公开翻牌立即知情。
- A12项／39断言：多层冻结、God副本修改无alias、false／throw／重入失败不通知、回调读旁路拒绝、原状态／身份／生命替换和复活拒绝、真实伤源／失败与昼间known隔离。
- T5项／46断言：五种伤源×主选／回退的10种实际状态下一夜DTO完全一致、目标死亡延迟、死者零静默更新、JSON／审计副本不回写与开夜异常零提交。

原文件与日志分别`/tmp/awa-noble-r-projection.test.ts`、`/tmp/awa-noble-r-projection-first.log`；`/tmp/awa-noble-knowledge-a-review.test.ts`及`.log`；`/tmp/awa-noble-known-delivery-review.test.ts`及`.log`。原输入迁入`noble_secret_body_player_projection_review.test.ts`，主任务8项配对测试在`noble_secret_body_player_projection.test.ts`。

## 维护证据与下一步

本切片31项，加先前104项，9文件135通过／617断言：`/tmp/awa-noble-known-maintained-first.log`。维护独立测试的首轮类型日志保留：判别联合未收窄与字面期望宽化，已改为明确字面类型及等价字段匹配；原输入不变，最终31项／167断言通过。源码与测试类型、新源码lint、格式及diff检查保留独立退出码。没有把仅领域DTO的配对测试冒认SDK／ACP／MCP隐私证据。

继续正式角色与公开四组合、严格请求／期限、猎魔夜仆例外及FINAL来源、真正放逐翻牌；统一PlayerObservation／statusDirective、私有新通知事件与永久God事实；独立Tape／checkpoint、双语完整实传与故障、实际玩家前端及本板全量验收。下游必查入口见[规则卡](../../rules/awa-noble-secret-body-twelve-v1.md)，必须检查完整system/current/delta_messages/schema/错误，不能只测事件行或只藏state字段。
