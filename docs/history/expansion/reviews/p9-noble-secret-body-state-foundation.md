# 觉醒之夜：身体资源与夜仆状态基础

本批只接入 `noble_secret_body/state.ts` 的纯状态读写。正式数量为48/64；夜之贵族／觉醒愚者仍为planned。跨夜原生命所有权、猎魔清除、实际期限提交、翻牌发言、已告知投影、公共配置与角色运行继续实施。

## 已明确的状态

- 身体只有一份判别资源：`intact`、`night_spent`、`exile_revealed`；没有另一个remaining库存。主动选择与资源分开，选择不消费；实际抵伤后只能消费一次，保留主动选择历史。公开免放逐使用独立消费原因；本模块不改变Alive、票权或警徽。
- `awa_nonconsecutive_nights_v1`与`awa_repeat_v1`按实际夜序判断；明确null打断连续，自动自护消费不改写主动目标。原夜资源用过后不能再次选择、重复耗身或免放逐。
- 夜仆记录创建夜N、到期夜N+1及唯一状态，至多一个pending。从N2开始可明确null或选其他存活人；占用期间没有选择。终态为cleared／expired／target_dead；N3结束的旧契约最早N4重选，N2结束的最早N3。到期不能提前或重复提交。
- `standard`与`no_blast_no_self_knife`政策只作明确状态参数保存；具体普通狼动作限制由后续运行与配置边界贯通。
- 所有状态／历史读写先取得plain own-data快照，拒绝Proxy、访问器、稀疏或自定义数组字段、未知字段及不合法判别联合；输出与原输入脱钩。候选名单同样取密集数字快照，再校验和查询，不执行调用方includes或iterator。

## 原反例与状态边界

R=`review_scholar_rules`，A=`review_configuration_closure`，只读原/tmp反例复验。

1. N2建立后N3关闭，草稿曾允许N3新建／null，且reader接受伪造占用夜pass。修正为choose及reader均要求后续选择晚于最近实际终结日；三种终态同夜重开均拒绝、合法N4保留。
2. 原livingIds.includes可以执行索引getter或伪造includes方法授权99号。修正为单次own-data候选快照，原getter和方法均零执行。

R原12项输入不改复跑通过，`/tmp/awa-noble-r-state-boundaries-green.log`；A原两文件14项／38断言通过，`/tmp/awa-noble-state-a-review-fixed.log`，包括别名、Proxy、错误库存、重复合同和提前到期。实现只负责状态规范，不证明原生命／技能实例资格；最终有效来源、唯一运行提交及延迟知情仍由后续owner负责。

## 维护证据

本批状态38项，加已有伤害原语22项，`/tmp/awa-noble-state-ported-first.log`为60通过／230断言、5文件。源码类型与新源码lint退出0；迁移独立测试时重复import的初次测试类型日志保留，合并import后源码与测试类型最终均退出0。没有修改引擎流程或注册新角色，不将本批单项门禁视为角色完整验收。

后续按[有限四组合规则卡](../../rules/awa-noble-secret-body-twelve-v1.md)推进：原生命／原技能所有权和跨夜契约→猎魔例外及最终伤害→免放逐／活人翻牌发言→统一已告知投影／双语事实→独立账本、真实对局／故障、私有前端及阶段验收。
