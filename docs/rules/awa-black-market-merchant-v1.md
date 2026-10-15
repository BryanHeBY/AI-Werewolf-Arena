# AWA Black Market Merchant 1.0.0 规则卡

规则集 `awa_classic` 1.0.0；ID `black_market_merchant`，黑市商人／Black Market Merchant。核验2026-10-09。当前 `verified`；规则经过R/A/L交叉审查及修正复查冻结，见[规则审查](../history/expansion/reviews/p7-black-market-rules.md)；完整功能证据见[交付验收](../history/expansion/reviews/p7-black-market-merchant.md)。支持范围为本卡限定的AWA版本与板子。

## 第一方来源与版本选择

[Melbourne Masters黑市商人图鉴](https://melbournemasters.org/setups/roles/%E9%BB%91%E5%B8%82%E5%95%86%E4%BA%BA)及[其神秘交易标准版](https://melbournemasters.org/setups/shen-mi-jiao-yi)是本版本的社区法官规则来源，不称网易官方规则。2026-10-09读取：可在任一夜一次交易；另一存活好人获额外一次查验、毒药或猎枪，原身份/阵营/技能保留；狼人不获知交易，商人失败出局。查验/毒药下一夜幸运儿环节可用，枪从下一白天生效。其夜序为商人、幸运儿、摄梦人、狼、女巫、预言家。首夜只有通知，没有当夜使用主动礼物。

该社区十二人原板含双枪狼王；AWA当前wolf_king是单枪，双枪狼王不在已约定64项中，不能换个名字就宣称原板交付。AWA本笔采用下述普通狼/单枪狼王改编，不扩充64项目标。节目及其它同名规则只作差异参考，不混入当夜可用的奇迹商人版本。

## black_market_merchant

好人神职，至多1，参数严格空对象。全局一次交易，无强制首夜，任一夜可以等待：零提交合法wait关当夜、保留机会；合法动作才消费。仍有候选的三次非法动作、超时、取消和传输失败按strict策略报错，不伪造skip或选人。

交易工具固定为 `black_market_trade`，严格参数 `{target_id: positive integer, skill: "check"|"poison"|"gun"}`，两字段必填、拒绝额外字段，不借Miracle的 `bestow_ability` 与guard枚举。合法等待是provider返回null/零提交，不是提交null target或虚构none物品。

交易目标只能是另一存活稳定player ID；不得self/null/死者。候选只按公共存活筛选，不泄露真实阵营。选择 `check`、`poison`、`gun` 之一，以接受时目标原Role/Camp/life判断：真实Camp.Good成功，Camp.Wolf失败（包括被查成好人的隐狼）；附加胜利归属不改变交易判断。本笔不开放neutral或阵营变化联合板。

成功给目标独立一次能力，原技能/真角色/阵营/名字/人格与胜利归属不变。不复制商人或目标旧库存/报告；商人已消费的机会不会因复活、重apply、撤销礼物而补回。目标收到本人礼物种类、库存、关闭/启用日次，**不披露商人号码**：`sourceDisclosed:false`，source本人投影仅kind，稳定实例ID不编码donor号码；事件和DTO的外层/状态/source均按已知字段白名单。商人只存choice/consumed/closed，不保存或展示即时success、目标camp、礼物ID或报告；具体成功/失败是God事实。获赠方的后续查验报告只给获赠方。

礼物实际提交后由收者的实例及原body拥有，商人后来死亡、复活或状态撤换不回收已赠礼物。未提交的旧选择仍受原交易owner约束，不可借此污染新收者或新商人。source只记录来历，不作为已赠库存持续依赖donor仍活的条件。

失败目标完全没有礼物/能力变更/通知或商人的私人事件。商人的反噬作为本夜统一结算的专有死因，守/救/Dream不抵消；其原life/paid owner被替换时不伤新body，原施者第一次真死仍保已付前缀。统一DeathResolution负责实际死亡、遗言/警徽与完整死亡连锁，PhaseManager最后judge；不在交易阶段提前标死或判胜。

## 礼物时序与资源

- 交易槽在夜间主动角色动作之前。下一夜开始，幸运儿查验/毒药在狼刀之前、固定独立槽处理；保留原生技能槽，不让原Seer/Witch动作误消耗礼物。晚夜才赠也一律下一夜可用，不用原Miracle的当夜late slot。
- 查验：一次阵营查验，沿已有信息标签规则，禁自验，只允许另一存活正整数ID；`check_identity`的target_id:null非法。零提交clean wait关当夜不消耗，可留后夜；成功报告属于这一实例，不覆盖原生历史。
- 毒药：一毒、无解药、看不到刀口，可自毒；沿 `use_potion {target_id:positive integer,potion_type:"poison"|"none"}`，none为合法工具skip（target保合法存活ID），null target/解药非法。零提交clean wait或none关当夜不消费，可留后夜。命中按普通毒及既有保护规则处理，不穿Dream或觉醒盾，不发明机械反毒规则。
- 同一actor同一夜的同kind原生与礼物动作不能对同一稳定ID成功两次，早槽礼物与后槽原生同样受限；非法尝试/skip不写ledger、不耗另一个实例。不同actor独立，不把他人目标或全知信息拿来筛本人候选。查验/毒跨夜无额外禁重复。同kind受限ledger是actor事实，礼物转出或耗尽不抹掉本夜记录。此为AWA明确裁决，沿既有幸运儿限制，不能由目录继承暗中决定。
- 猎枪：独立被动单枪，在交易当夜实际夜末之后、下一白天死亡动作之前armed。该夜刀死可以在白天死亡结算中开枪；900前中断不猜已激活时间。原猎人收到枪拥有原枪及礼物枪两个独立库存，按原生先、礼物后依次选择当时还存活目标；每次合法null也消费该枪。两枪逐项实际追加死亡之后再请求下一枪；不是从一份旧活人快照同时射击。毒、Dream/牵连/决斗/自罚及任何含禁枪来源的复合死因禁礼物枪。
- 无可用枪或未armed不请求。首次实际死亡完成后礼物永久过期，复活不补；禁枪也不能留下库存供复活用。主动礼物同样不跨首次实际死亡复活补使用权。原life/owner和能力实例必须在回答后及网关/消费/真正生效点复验，取消/过期不能污染新owner。

原猎人第一枪合法null后仍应有礼物枪机会。第一枪已造成末Wolf或末神死亡时，仍先完成该actor另一可用枪及应有死亡连锁、警徽，再统一judge；不得在两库存之间提前结束对局。pending死亡不能用首次死亡过期逻辑抢先撤掉当次仍可发射的礼物枪。

本板没有玩家主动copy/transfer工具。低层授权transfer如用于G02回归，只允许另一存活Good持有人，完整保留库存、closed/disabled、starts/实际armed、报告与永久deathExpired，不变成新native、不重置窗口/日次；原实例转出后退休，重apply不补。死亡持有人不能趁pending gun转走、过期实例不能被enable救回。copy黑市礼物不支持，显式拒绝；不复制资源/报告或为新实例补一份枪。转移source仍不披露actor号码，实例ID保持不编码donor。公开板子不因低层API存在就宣称P9转移玩法已交付。

上述未在第一方简述中写完的skip、实际夜末/首次死亡、双枪次序、反噬保护与compound判例是明确AWA裁决，审查须分别核对，不能说全部均有来源逐项证明。

## 结构与信息约束

沿已有G02实例与独立资源组合。被动礼物枪建立具名死亡能力契约/实例，不塞入NightAbility伪造夜间动作，也不修改每个接收角色的原生state以表示枪。DeathResolution拥有death permit和逐次真实提交；gift枪的验证/请求携带明确实例ID，不能用native shoot授权替代礼物库存。

商人选择/skip本人可见，礼物及资源只给获赠本人；God outcome独立。私人投影必须裁剪状态/source/event未知字段；通用中立 `player_shot` / `death_shot`不能泄露原枪来源。zh-CN/en覆盖规则、状态、目标提示、工具schema描述、拒绝、事件、终端/前端/视频；玩家原文不改译。

## 本笔支持范围和交付

已开放组合白名单：Black Market Merchant、普通Wolf、Wolf King、Hidden Wolf、Seer、Witch、Hunter、Guard、Dreamer、Villager。需每个受限Profile共同通过组合检查；未核组合不得因角色都存在就通过随机组牌。

已交付公开示例：六人AWA缩编（2Wolf+Black Merchant+Seer+Witch+Villager）；十二人AWA单枪改编（3Wolf+Wolf King+Seer/Witch/Black Merchant/Dreamer各1+4Villager）。明确注明与社区双枪版、节目狼兄弟版不同，不承诺未实现狼兄弟或双枪狼王。

按功能拆提交：先被动赠枪实例/授权/逐枪提交底座与原生枪回归，再完整Black角色/延期主动槽/例子/双语，最后P7阶段全已支持验收。不要将半角色注册为implemented/verified。

至少手写成功check/毒/gun、skip后晚赠、赠Wolf/Hidden失败不泄露、原Hunter双枪（含首枪null及首枪命中末Wolf/末神后仍完成另一枪）、原生与礼物同kind去重/跨actor独立、首夜knife/poison/compound、Dream保护/死亡、死亡与owner撤换、原12改编警徽/遗言/临界胜利的整局预期。角色正常及失败Tape、SDK/ACP（实际MCP）/混合×两语完整局、每板20受限seed、资源与私有信息、前端God档与玩家中立枪、实际browser/PNG全部过；R规则/人工oracle、A实例/授权/时序/清理、L/D双语/投影/呈现分别审查复查后启用。

本卡规则及完整实现已验证，P7交付与当时交接见[历史阶段验收](../history/expansion/reviews/p7-activation.md)；该验收只证明其冻结输入，不代表当前源码全量通过。当前交付状态由[角色资料目录](../../packages/game-catalog/src/index.ts)维护，未完成的总体要求见[重构进度](../history/refactor/progress.md)，不以本角色登记关闭其它阶段、组合矩阵、长局或T6。
