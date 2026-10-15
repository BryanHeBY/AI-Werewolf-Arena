# P7：黑市商人规则与实现步骤冻结审查

范围仅[AWA规则卡](../../rules/awa-black-market-merchant-v1.md#black_market_merchant)和[资源/提交步骤](../black-market-merchant.md)，不注册角色、不修改生产源码。当前仍 **22 verified/42 planned**；原社区双枪狼王及节目狼兄弟不作为本笔已支持板子。

## 来源与AWA裁决

根与R/T独立读取Melbourne Masters角色及神秘交易标准版：支持任意夜一次交易、好人保原技能、狼人不知情失败、主动礼物下一夜/枪下一白天；源含双枪狼王。AWA明确采用单枪改编，self/skip、actor-local同kind去重、实例/时序/保护/compound与转移资源等细则单列裁决，不冒称源逐条证明。

## 三路首审、修正与复查

- **R/T（review_rules_psychic）**：补查验禁self/工具null非法、毒可self/none的严格形状；同actor同kind原生/礼物同夜禁同目标且跨actor独立；donor不披露、低层transfer保库存/closed/disabled/starts/armed/永久过期，礼物copy显式拒绝。补双枪首枪null、第一枪末Wolf/末神仍全部库存/死亡链后judge的最低人工场景。原审查者复查0，支持文档冻结。
- **L/D（review_rules_gargoyle）**：补fixed black_market_trade及target/skill严格字段；sourceDisclosed:false、ID不编码donor、完整外层/state/source/event白名单与商人不持success/camp/giftID/report。实现文档公共中立枪范围收紧到Native/复制Hunter与Black赠枪；旧WolfKing等保原具名协议，Wolf不当Black合法获赠方。原审查者最后复查0，支持文档冻结。
- **A（review_arch_psychic）**：核具名死亡实例、不塞NightAbility/不覆盖原生state、确切instanceID许可、原生真实commit+关闭permit后gift新permit、pending首次死完成后永久过期、donor已赠后独立、ledger及actual900。指出卡误将最后judge归DeathResolution；已改其只结算完整死亡链，PhaseManager最后judge，与契约一致，原审查者最终复查0，支持纯文档冻结。

本笔检查相对链接/规则anchor、角色计数与当前状态、git diff --check；仅文档不跑无关模型/引擎矩阵。生产实现的全局/失败Tape、实际本地SDK/ACP/MCP/混合、中英/前端/浏览器/PNG与每板20seed仍按卡逐笔执行，不把本审查当成功运行证据。

下一步按赠枪底座→完整Black与延期礼物→P7全已支持验收拆commit；随后P8–P10、64角色/22机制全矩阵、长局/T6持续。用户配置/认证未读取或修改。
