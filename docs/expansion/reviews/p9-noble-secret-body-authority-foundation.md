# 觉醒之夜：原生命与跨夜提交所有权基础

本批建立 `noble_secret_body/authority.ts`。正式进度仍为48/64，夜之贵族／觉醒愚者保持planned。此模块尚未接入正式角色、配置、请求投递、猎魔资格判断、夜间最终伤害、放逐或玩家视角；不将替代角色fixture算作完整对局证据。

## 职责与提交

- 安装时只捕获一份原角色／私有状态／阵营／身份／胜利成员／factory生命引用。有限板仅Good/Wolf、胜利成员为对应派系；精确角色与四组合资格留给bootstrap。缺字段、初始访问器或Proxy均拒绝，不把无效哨兵当初始合法值。
- 夜仆契约绑定原目标生命，贵族真实第一次死亡后已提交契约仍保留。目标真实死亡可关闭契约，复活、替换同ID生命或角色不会接走旧租约。选择、清除、到期均同步返回独立receipt；猎魔是否有资格、receipt与God operation一起记录由调用方负责。
- 开夜时冻结是否具备保护／夜仆选择窗口；占用的旧契约在本夜后来关闭，不重新开放已错过的窗口。pending到期夜不可跳过；正常前夜尚未完成最终伤害时不能开新夜。
- 正常动作关闭必须已完成必需选择及到期处理；最终有效来源仅在正常动作关闭后抵消一次。保护选择本身不消费，实际抵伤才消费原身体。所选者挡过一次不再自动自护；已提交保护不因施法者真实第一次死亡倒销。
- `normal`尚未完成最终伤害时允许失败清理为`aborted`。结算输入非法、写权限丢失或控制器取消会自动撤销未完成的夜效果；保留已经提交的选择及expired，不重复到期、重开同夜或补回真实消费。清理不要求已经被撤销的owner仍有效。
- 控制器资格回调期间禁止业务API重入。锁在finally释放；递归结算的拒绝在失败清理外，避免内层调用中止外层。不是通用清理框架，状态仍由本领域owner明确维护。
- 放逐接口只消费身体并返回receipt，要求当日夜伤已结算、无新夜及原角色仍活着；它不改变Alive、票权、警徽或执行发言。实际放逐资格与专属活人翻牌发言仍归VotingPipeline。

`snapshotNobleBodyAuthority`仅用于God／审计，包含真实库存与抵伤来源，不得用作玩家提示或MCP返回。下一批建立独立已告知状态，随后贯通真实阶段和传输。

## 独立审查与原反例

R=`review_scholar_rules`，A=`review_configuration_closure`，全程只读。保留原/tmp输入与初次失败日志，修复后复跑再迁入维护测试。

1. A原回调可递归抢begin、抢清除receipt或提前以其它来源消费身体；原4项反例复验通过。跨入口再验上一日免放逐、目标死亡关闭、回调abort及原错误后锁释放，共8项／29断言。
2. A原正常关闭后非法最终来源既不能中止也能重试；现在失败自动aborted，cleanup可重复、旧效果不能再次结算。
3. R原正常关闭后取消无法aborted；另证明pending到期夜可被跳过。两项原输入复验通过；旧契约N3结束不重开窗口、合法N4重选三项保持通过。
4. A初始missing Identity、Identity.id与Role.role访问器曾被保存为永久合法哨兵。安装时校验原字段，原4项复验通过，getter零执行。

原记录：`/tmp/awa-noble-authority-a-review.test.ts`、`/tmp/awa-noble-authority-a-crossentry-review.test.ts`、`/tmp/awa-noble-authority-a-initial-binding-review.test.ts`、`/tmp/awa-noble-r-authority-abort.test.ts`、`/tmp/awa-noble-r-authority.test.ts`。R另补失败／跨夜矩阵5项，原R组共10项／65断言；A有限roster补查8项／9断言通过。原日志`/tmp/awa-noble-r-authority-fixed-complete.log`与`/tmp/awa-noble-authority-a-roster-shape-finite-review-green.log`；共享空胜利成员仍合法，本有限板单派系约束另作明示，未将泛化假设的初次失败算作生产修复。所有输入已迁入 `noble_secret_body_authority_review.test.ts`；规则正例在 `noble_secret_body_authority.test.ts`，fixture明确标明使用现有替代卡仅证明原对象所有权。

## 维护证据与后续

本批连同纯状态和伤害原语7文件为104通过／450断言，`/tmp/awa-noble-authority-maintained-closure.log`。源码与测试类型、新源码lint、格式和diff检查分别保留退出码证据。本批没有公开注册或新角色完成声明。

按[四组合规则卡](../../rules/awa-noble-secret-body-twelve-v1.md)继续：独立已告知投影→正式角色／配置及严格请求→猎魔清除和最终有效伤害→真实放逐／翻牌→双语事实与独立Tape→四组合实际传输／私有前端及本批完整验收。
