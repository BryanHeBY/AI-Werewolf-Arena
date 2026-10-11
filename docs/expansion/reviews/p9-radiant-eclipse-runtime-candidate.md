# 猎日逐光：夜间运行候选实现（2026-10-12）

状态：工作区候选，未进行阶段登记。流光伯爵和蚀日侍女仍为 planned；正式进度仍为 46/64。不得将本页的局部证据替代记录账本、真实通信、前端或阶段全量门禁。

后续状态：本页保留候选期间的原证据与失败；两个角色现已通过[完整有限板验收](p9-radiant-eclipse-stage-acceptance.md)。原46/64及待验收描述属于候选时点，当前正式统计见完整验收及角色目录。

## 已接入职责

- 精确十二人公共预设与内部板校验；女巫字段使用内部 `canSelfHeal=disabled`、`knifeVisibility=awa_with_heal_v1`、`potionPolicy=awa_one_native_v1`。两角色参数均为同一有限政策，非法字段不可被另一角色参数覆盖。
- 单一 NightFrame 捕获原角色、身份、生命、原生资源及不可变政策。侍女只知道初始化时的三只普通狼；无狼聊、自爆，刀权按真实夜初冻结并在使用时核验原侍女。
- 女巫重置 100 → 吞噬 110 → 庇护 120 → 梦 150 → 狼聊／狼刀／药／查验。原生封禁和借用授权由本次成功取得夜所有权的 Pipeline 关闭；拒绝重入不清理其他正在运行的夜。
- 借用快照按四种能力白名单构造，药不刷新或写回，梦／庇护保留必要上一目标与夜序。原生空药行为保持既有规则，空借药不发虚构 none 请求。
- 已付庇护及借梦绑定原施法者和原目标，在正常关闭后继续结算；中止后撤销效果资格、保留已提交事实及消耗。庇护与反噬输出的数组、声明和目标结构不可被重定向。
- 新技能及本板狼聊／狼刀严格区分明确 pass、错误工具、同名非法参数、缺失和中止；失败保存前缀，无正常恢复通知、夜死或胜利。
- 中文／英文公共规则、角色提示、阶段、事件文案、能力标签；严格事实读取和单一受众投影。侍女提示仅加入自己的吞噬历史，不借走原主的私密历史。

## 原审查者复验

R：`review_scholar_rules`；A：`review_configuration_closure`；T/L/D：`review_scholar_delivery`。均只读，主任务修复后原输入复跑。

关闭的问题：原主库存变动不撤权、可变借用 ID 逃过清理、恢复事实失真、替换／复活生命仍被清理、state/source getter 执行、disabled setter 执行、原对象 kind/source 改写被当新基线、已付目标身份替换、abort 未撤销效果、可写效果目标转移伤害、刀权不核原侍女、null pass 绕过网关资格、预设女巫字段错误、错误码降级及重入 finally 抢关原夜。

原最小反例日志：`/tmp/awa-radiant-frame-final-independent.log`，26 通过／59 断言；重入原复验 `/tmp/awa-radiant-pipeline-reentry-fixed.log`，1 通过／7 断言。所有原红日志保留，未覆写为绿。

## 维护测试与证据

- `/tmp/awa-finite-diagnostics-tests.log`：14 通过／64 断言。公共错误码修复单独提交为 `fb8ad88`，包含既有迷雾板 config-check 与 bootstrap 的相同拒绝边界。
- `/tmp/awa-radiant-runtime-related-final-fixed.log`：257 通过／0 失败／1985 断言，26 文件。包括状态／封禁／伤害基础、26 个维护边界、13 个独立字面伤害预期、四种借药库存、严格失败与中止、跨夜库存、梦与庇护记录、三轮完整 PhaseManager 对局，以及既有梦／女巫／预言家／能力回归。
- 原审查者的同名非法参数五例已维护；矩阵中的错误工具模式改名 `wrong_tool`，没有冒称它覆盖同名非法参数。
- 中英 × 四种借能力 × 两个独立 World 的真实 PlayerPromptPolicy、Observation 与玩家事件视图比较，共 8 通过／248 断言。改变原主旧结果、历史、使用次数与历史 canary，保留可借的当前库存及必要上一目标：原主视图确实变化，侍女吞前／借用请求／关闭后视图保持相等，且不含 canary。
- `/tmp/awa-radiant-types-final-fixed.log`：后端源码与测试类型退出 0；`/tmp/awa-radiant-front-types-final-fixed.log`：前端类型退出 0；`/tmp/awa-radiant-lint-all-final.log`：前后端 lint 退出 0。这些局部门禁不等于阶段全量门禁。

首轮跨夜测试曾未按 `ability_id` 选择历史多个借用实例，3 例测试自身失败；改为实际请求的能力 ID 后 24/24 通过，原日志保留于 `/tmp/awa-radiant-cross-night-first.log`，修正日志 `/tmp/awa-radiant-cross-night-fixed2.log`。首次末狼测试错误查验已死普通狼，修为侍女合法自验后通过；不曾放宽生产规则。

## 后续必须完成

1. 独立记录资源／请求／伤害／受众账本与严格 Tape：正常、失败、pending、非法档案变异；所有 checkpoint，包括夜初末狼和已付借梦关系。
2. 中文／英文实际 SDK、ACP/MCP 和混合通路的正常／缺失／同名非法／取消／迟到及失败前缀；有界模型仅本地合成服务。
3. 受限观察策略的固定种子对局、完整胜利和复杂警徽／遗言链，不能用直接标记死亡替代真实对局因果。
4. 真实档案到前端玩家视角／上帝视角、终端、Remotion 逐帧前进／回退与最终 checkpoint；Chrome 门禁。
5. 输入与工具链冻结、独立 R/A/T/L/D 审查、阶段全量门禁后，再同步 catalog、规则卡与角色进度，并按功能提交运行候选。当前 enum/profile 候选尚未对应正式 catalog 状态，不能声称 T1 或阶段通过。
6. 继续 P9d 其余贵族／觉醒白痴、幻影／双生预言家，随后 P9e、P9f 与 P10；本角色完成不是总目标完成。
