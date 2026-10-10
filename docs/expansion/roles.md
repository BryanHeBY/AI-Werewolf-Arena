# 可配置角色目标目录

返回 [实施路线](roadmap.md)。本目录共 **64 项定义**：23 verified、16 implemented、25 planned，合计 39 项已达到各自有限范围内的技术门禁。已有实现仅表示当前 AWA 版本，不代表其他同名版本均受支持；P9/P10 和用户总体验收仍开放。

基础七项及 P5–P7 的十六项为 verified。咒狐、丘比特、杠精、盗贼、野孩子、千面人、孤独少女、鬼魂新娘、猎魔人、纯白之女、狼巫、恶夜骑士、噩梦之影、赤月使徒、魔术师、定序王子登记 implemented。各角色来源、支持组合和验证边界见各自规则卡与验收记录；最新交付见[恶夜骑士验收](reviews/p9-evil-knight.md)、[噩梦之影验收](reviews/p9-nightmare.md)、[赤月使徒验收](reviews/p9-red-moon.md)、[魔术师验收](reviews/p9-magician.md)、[定序王子验收](reviews/p9-order-prince.md)。

## 使用与冻结要求

- 新 ID 为建议的稳定机器标识，须在 P1 契约审查中冻结。当前配置不能直接使用未实现 ID。
- 英文是首版工作译名，作为 i18n 内容审查；不据此合并海外同名角色。
- 下表“机制标签”用于排序实现依赖，是概括，不能替代完整技能规则。
- 来源链接是调研依据。部分发布稿、官方卡牌资料或赛事目录只证明角色存在/机制方向，具体交互仍待核验。
- 每项在实现前建立规则卡：来源、发布日期/核验日期、规则集与版本、身份/阵营/计数/胜利目标、互认/夜聊/刀权、动作/资源/时点、所有死因与保护/重定向交互、允许组合、AWA 改编说明、中英提示及期望测试。
- 有歧义的复制、替死、反伤、保护及判胜，必须选择并记录某个确定版本；未决规则阻止相关角色宣告支持。
- 基础/觉醒、机械狼/觉醒隐狼、通灵师/魔镜少女分别登记。白痴与愚者的别名、赤月与血月等名称仅在同规则版本下建立映射。
- 实现状态采用 `planned`、`rules_frozen`、`implemented`、`verified`；后两项不能省略规则来源和测试链接。当前统计以上方目录为准；剩余 25 项为 planned，不能直接用于已支持板子。

## 1. 基础角色：7 项，awa_classic 1.0.0 已验证

| #   | 计划 ID    | 中文       | English       | 机制标签         | 阶段 / 来源                      |
| --- | ---------- | ---------- | ------------- | ---------------- | -------------------------------- |
| 01  | `wolf`     | 狼人       | Werewolf      | 夜聊、狼刀、自爆 | `verified`；P1–P4 / [S01][cards] |
| 02  | `villager` | 平民       | Villager      | 发言、投票       | `verified`；P1–P4 / [S01][cards] |
| 03  | `seer`     | 预言家     | Seer          | 阵营查验         | `verified`；P1–P4 / [S01][cards] |
| 04  | `witch`    | 女巫       | Witch         | 解药、毒药       | `verified`；P1–P4 / [S01][cards] |
| 05  | `hunter`   | 猎人       | Hunter        | 死亡开枪         | `verified`；P1–P4 / [S01][cards] |
| 06  | `guard`    | 守卫       | Guard         | 狼刀保护         | `verified`；P1–P4 / [S01][cards] |
| 07  | `idiot`    | 白痴／愚者 | Village Idiot | 放逐豁免、投票权 | `verified`；P1–P4 / [S01][cards] |

## 2. 常见扩展：9 项

| #   | 计划 ID           | 中文   | English         | 机制标签             | 阶段 / 来源                                                                                                                      |
| --- | ----------------- | ------ | --------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 08  | `wolf_king`       | 狼王   | Wolf King       | 死亡带人、死因限制   | `verified`；P5 / [AWA规则卡](rules/awa-wolf-king-v1.md#wolf_king) / [S02][wolfking]                                              |
| 09  | `white_wolf_king` | 白狼王 | White Wolf King | 自爆带人、流程中断   | `verified`；P5 / [AWA规则卡](rules/awa-white-wolf-king-v1.md#white_wolf_king) / [S03][whitewolf]                                 |
| 10  | `knight`          | 骑士   | Knight          | 白天决斗             | `verified`；P5 / [AWA规则卡](rules/awa-knight-v1.md#knight) / [验收](reviews/p5-knight.md) / [S04][beautyknight]                 |
| 11  | `gravekeeper`     | 守墓人 | Gravekeeper     | 放逐后的信息反馈     | `verified`；P5 / [AWA规则卡](rules/awa-gravekeeper-v1.md#gravekeeper) / [验收](reviews/p5-gravekeeper.md) / [S05][gargoyleboard] |
| 12  | `dreamer`         | 摄梦人 | Dreamer         | 持续关系、保护/伤害  | `verified`；P6 / [AWA规则卡](rules/awa-dreamer-v1.md#dreamer) / [验收](reviews/p6-dreamer.md) / [S06][dreamer]                   |
| 13  | `wolf_beauty`     | 狼美人 | Wolf Beauty     | 魅惑、死亡牵连       | `verified`；P6 / [AWA规则卡](rules/awa-wolf-beauty-v1.md#wolf_beauty) / [验收](reviews/p6-wolf-beauty.md) / [S04][beautyknight]  |
| 14  | `bear`            | 熊     | Bear            | 邻接的公开反馈       | `verified`；P6 / [AWA规则卡](rules/awa-bear-v1.md#bear) / [验收](reviews/p6-bear.md) / [S07][bear]                               |
| 15  | `hidden_wolf`     | 隐狼   | Hidden Wolf     | 特殊互认、查验和接刀 | `verified`；P6 / [AWA规则卡](rules/awa-hidden-wolf-v1.md#hidden_wolf) / [验收](reviews/p6-hidden-wolf.md) / [S08][hiddenwolf]    |
| 16  | `gargoyle`        | 石像鬼 | Gargoyle        | 独立狼、身份查验     | `verified`；P6 / [AWA规则卡](rules/awa-gargoyle-v1.md#gargoyle) / [验收](reviews/p6-gargoyle.md) / [S05][gargoyleboard]          |

## 3. 信息与能力授予：5 项

| #   | 计划 ID                 | 中文     | English               | 机制标签                         | 阶段 / 来源                                                                                                                                                                                          |
| --- | ----------------------- | -------- | --------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | `psychic`               | 通灵师   | Spirit Seer           | 具体身份查验                     | `verified`；P7 / [AWA规则卡](rules/awa-psychic-v1.md#psychic) / [验收](reviews/p7-psychic.md) / [S09][mechanicalboard]                                                                               |
| 18  | `mirror_girl`           | 魔镜少女 | Mirror Girl           | 具体身份、查验限制               | `verified`；P7 / [AWA规则卡](rules/awa-mirror-girl-v1.md#mirror_girl) / [验收](reviews/p7-mirror-girl.md) / [S10][mirror]                                                                            |
| 19  | `mechanical_wolf`       | 机械狼   | Mechanical Wolf       | 独立学习、机械技能、资源和接刀   | `verified`；P7 / [AWA规则卡](rules/awa-mechanical-wolf-v1.md#mechanical_wolf) / [验收](reviews/p7-mechanical-wolf.md) / [S09][mechanicalboard]                                                       |
| 20  | `miracle_merchant`      | 奇迹商人 | Miracle Merchant      | 独立幸运库存、联合目标限制及反噬 | `verified`；P7 / [AWA规则卡](rules/awa-miracle-merchant-v1.md#miracle_merchant) / [验收](reviews/p7-miracle-merchant.md) / [S01][cards]                                                              |
| 21  | `black_market_merchant` | 黑市商人 | Black Market Merchant | 技能交易、反噬                   | `verified`；P7 / [AWA规则卡](rules/awa-black-market-merchant-v1.md#black_market_merchant) / [完整验收](reviews/p7-black-market-merchant.md) / [实现步骤](black-market-merchant.md) / [S11][merchant] |

## 4. 身份与阵营变化：6 项

| #   | 计划 ID        | 中文     | English        | 机制标签               | 阶段 / 来源                                                                                                             |
| --- | -------------- | -------- | -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 22  | `hybrid`       | 混血儿   | Hybrid         | 榜样、独立胜利归属     | `verified`；P7 / [AWA规则卡](rules/awa-hybrid-v1.md#hybrid) / [验收](reviews/p7-hybrid.md) / [S12][hybrid]              |
| 23  | `thief`        | 盗贼     | Thief          | 额外底牌、初始身份选择 | `implemented`；[来源规则](rules/lui-meme-thief-v1.md) / [验收](reviews/p9-thief.md)                                     |
| 24  | `shapeshifter` | 千面人   | Many-Faced One | 初始身份选择变体       | `implemented`；P9a / [规则卡](rules/awa-netease-shapeshifter-v1.md) / [验收](reviews/p9-shapeshifter.md) / [S01][cards] |
| 25  | `lonely_girl`  | 孤独少女 | Lonely Girl    | 崇拜对象、胜利归属     | `implemented`；P9a / [规则卡](rules/awa-netease-lonely-girl-v1.md) / [验收](reviews/p9-lonely-girl.md) / [S01][cards]   |
| 26  | `wild_child`   | 野孩子   | Wild Child     | 榜样死亡、阵营变化     | `implemented`；[来源规则](rules/awa-lui-meme-wild-child-v1.md) / [验收](reviews/p9-wild-child.md)                       |
| 27  | `ghost_bride`  | 鬼魂新娘 | Ghost Bride    | 伴侣、第三方目标       | `implemented`；P9a / [规则卡](rules/awa-melbourne-ghost-bride-v1.md) / [验收](reviews/p9-ghost-bride.md) / [S15][bride] |

## 5. 情侣与独立胜利：2 项

| #   | 计划 ID      | 中文   | English    | 机制标签             | 阶段 / 来源                                                                        |
| --- | ------------ | ------ | ---------- | -------------------- | ---------------------------------------------------------------------------------- |
| 28  | `cupid`      | 丘比特 | Cupid      | 情侣、殉情和目标变化 | `implemented`；[来源策略](rules/sourced-cupid-v1.md) / [验收](reviews/p8-cupid.md) |
| 29  | `cursed_fox` | 咒狐   | Cursed Fox | 特殊生存、查验和胜利 | P8 / [S16][salon]                                                                  |

## 6. 进阶攻防：11 项

| #   | 计划 ID            | 中文     | English          | 机制标签               | 阶段 / 来源                                                                                                  |
| --- | ------------------ | -------- | ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| 30  | `demon_hunter`     | 猎魔人   | Demon Hunter     | 夜间对决、伤害资格     | implemented；P9b / [规则卡](rules/awa-netease-demon-hunter-v1.md)、[验收](reviews/p9-demon-hunter.md)        |
| 31  | `pure_white_girl`  | 纯白之女 | Pure White Girl  | 查验与伤害             | implemented；P9b / [规则卡](rules/awa-pure-white-night-v1.md)、[验收](reviews/p9-pure-white.md)              |
| 32  | `wolf_witch`       | 狼巫     | Wolf Witch       | 狼队身份查验           | implemented；P9b / [规则卡](rules/awa-pure-white-night-v1.md)、[验收](reviews/p9-pure-white.md)              |
| 33  | `evil_knight`      | 恶夜骑士 | Dark Knight      | 夜间免疫、反伤         | `implemented`；P9 / [规则卡](rules/awa-evil-knight-v1.md) / [验收](reviews/p9-evil-knight.md) / [S01][cards] |
| 34  | `red_moon_apostle` | 赤月使徒 | Red Moon Apostle | 自爆、封夜、特殊死亡   | P9b implemented / [规则卡](rules/awa-red-moon-demon-v1.md) / [验收](reviews/p9-red-moon.md)                  |
| 35  | `alchemist`        | 炼金魔女 | Alchemist        | 刀口约束、特殊救人流程 | P9 / [S17][mist]                                                                                             |
| 36  | `raven_claw_wolf`  | 狼鸦之爪 | Raven-Claw Wolf  | 解封、特殊攻击         | P9 / [S17][mist]                                                                                             |
| 37  | `radiant_count`    | 流光伯爵 | Radiant Count    | 保护范围和限制         | P9 / [S01][cards]                                                                                            |
| 38  | `eclipse_maid`     | 蚀日侍女 | Eclipse Maid     | 技能吞噬与临时失效     | P9 / [S01][cards]、[S16][salon]                                                                              |
| 39  | `night_noble`      | 夜之贵族 | Night Noble      | 持续夜间状态           | P9 / [S18][tournament]；完整技能待核验                                                                       |
| 40  | `fragrant_phantom` | 寻香魅影 | Fragrant Phantom | 绑定、牵连、接刀       | P9 / [S19][awakenedseer]                                                                                     |

## 7. 控制与流程变化：8 项

| #   | 计划 ID             | 中文     | English           | 机制标签           | 阶段 / 来源                                                                                                      |
| --- | ------------------- | -------- | ----------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 41  | `nightmare`         | 噩梦之影 | Nightmare         | 恐惧、行动封锁     | `implemented`；P9 / [规则卡](rules/awa-nightmare-dreamer-v1.md) / [验收](reviews/p9-nightmare.md) / [S01][cards] |
| 42  | `magician`          | 魔术师   | Magician          | 夜间技能目标映射   | P9 / [S20][magician]                                                                                             |
| 43  | `trickster`         | 诡术师   | Trickster         | 号码映射及公开结果 | P9 / [S21][trickster]                                                                                            |
| 44  | `wolf_sorcerer`     | 狼术师   | Wolf Sorcerer     | 狼队目标/座位映射  | P9 / [S22][sorcerer]                                                                                             |
| 45  | `order_prince`      | 定序王子 | Order Prince      | 限次重投与发言     | P9 / [S23][prince]                                                                                               |
| 46  | `time_wolf_consort` | 蚀时狼妃 | Time-Wolf Consort | 反弹与封锁         | P9 / [S01][cards]                                                                                                |
| 47  | `day_scholar`       | 白昼学者 | Day Scholar       | 技能增幅/削弱      | P9 / [S01][cards]；效果矩阵待核验                                                                                |
| 48  | `night_mentor`      | 寂夜导师 | Night Mentor      | 技能增幅/削弱      | P9 / [S01][cards]；效果矩阵待核验                                                                                |

## 8. 娱乐与流程互动：7 项

| #   | 计划 ID         | 中文     | English         | 机制标签             | 阶段 / 来源                       |
| --- | --------------- | -------- | --------------- | -------------------- | --------------------------------- |
| 49  | `debater`       | 杠精     | Debater         | 挑战、辩论、投票资格 | P8 / [S24][debater]               |
| 50  | `silence_elder` | 禁言长老 | Silencing Elder | 表达权限与翻译       | P9 / [S25][silence]               |
| 51  | `crow`          | 乌鸦     | Crow            | 额外放逐票           | P9 / [S01][cards]                 |
| 52  | `white_cat`     | 白猫     | White Cat       | 延迟死亡             | P9 / [S01][cards]                 |
| 53  | `fox_cub`       | 子狐     | Fox Cub         | 迷惑及目标交互       | P9 / [S01][cards]；完整技能待核验 |
| 54  | `pufferfish`    | 河豚     | Pufferfish      | 投票反击、特殊死亡   | P9 / [S01][cards]；边界判例待核验 |
| 55  | `warden`        | 典狱长   | Warden          | 秘密交易/背叛决策    | P9 / [S26][warden]                |

## 9. 本次觉醒目标子集：9 项

| #   | 计划 ID                | 中文       | English                | 机制标签                 | 阶段 / 来源                                                                                                                                                                                    |
| --- | ---------------------- | ---------- | ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 56  | `awakened_idiot`       | 觉醒愚者   | Awakened Village Idiot | 秘密之身/伤害替代        | P9 / [S18][tournament]；完整技能待核验                                                                                                                                                         |
| 57  | `awakened_seer`        | 觉醒预言家 | Awakened Seer          | 双目标信息               | P9 / [S19][awakenedseer]                                                                                                                                                                       |
| 58  | `awakened_wolf_king`   | 觉醒狼王   | Awakened Wolf King     | 多次死亡技能、能力转移   | P9 / [S01][cards]                                                                                                                                                                              |
| 59  | `awakened_hidden_wolf` | 觉醒隐狼   | Awakened Hidden Wolf   | 复制、生效时机、独立狼   | P7；`verified` / [完整验收](reviews/p7-awakened-hidden-wolf.md) / [AWA冻结卡](rules/awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf) / [实现边界](awakened-hidden-wolf.md) / [S10][mirror] |
| 60  | `awakened_wolf_beauty` | 觉醒狼美人 | Awakened Wolf Beauty   | 替死/关系结算            | P9 / [S16][salon]；采用正式上线版本核验                                                                                                                                                        |
| 61  | `awakened_witch`       | 觉醒女巫   | Awakened Witch         | 多次调配、协助者秘密决策 | P9 / [S27][awakenedwitch]                                                                                                                                                                      |
| 62  | `awakened_hunter`      | 觉醒猎人   | Awakened Hunter        | 巡猎及死亡动作           | P9 / [S28][recenttournament]；完整技能待核验                                                                                                                                                   |
| 63  | `awakened_guard`       | 觉醒守卫   | Awakened Guard         | 特殊保护                 | P9 / [S29][awakenedknight]；完整技能待核验                                                                                                                                                     |
| 64  | `awakened_knight`      | 觉醒骑士   | Awakened Knight        | 连续决斗及特殊误中结算   | P9 / [S29][awakenedknight]                                                                                                                                                                     |

## 来源与规则核验

调研截止 2026-10-07。网易发布稿、官方卡牌快照与线下赛事规则分别登记，不视为同一套判例。尤其不把觉醒角色设计大赛投稿当作正式上线版本。

本目录是已约定 64 项目标，不是全部已发布角色。审查另外核实觉醒摄梦人、觉醒石像鬼具有官方发布依据，已补入 [长期候选](roadmap.md#12-长期候选不计入本次-64-项)，未擅自变更本次计数。盗贼与千面人已按发行商/网易各自具名版本冻结并复用真实物理牌底座，不能以注册自动允许未支持组合。

S01 是官网所引用的卡牌资料快照，不能保证涵盖最新全部角色，也不能保证解释所有交互。S18/S28 的赛事目录和计分说明主要用于确认角色/板子存在及核验方向，不能单独充当完整技能规格。正式规则冻结时应补完整说明和人工判例。

海外规则、社群规则的英文名称仅供资料引用；本目录英文标签需通过 i18n 审查。基础中文名称相同但技能不同的情况，以规则集/版本区分。

[cards]: https://langrensha.res.netease.com/pc/gw/20190509150909/js/kapaiData_02806e2.js
[wolfking]: https://melbournemasters.org/setups/roles/狼王
[whitewolf]: https://langrensha.com/hantiao/juese/2018/07/09/26896_763548.html
[beautyknight]: https://melbournemasters.org/setups/lang-mei-qi-shi
[gargoyleboard]: https://melbournemasters.org/setups/shi-xiang-gui-shou-mu-ren
[dreamer]: https://melbournemasters.org/setups/roles/摄梦人
[bear]: https://melbournemasters.org/setups/xiong-yin-lang
[hiddenwolf]: https://melbournemasters.org/setups/roles/隐狼
[mechanicalboard]: https://melbournemasters.org/setups/roles/机械狼
[mirror]: https://langrensha.com/news/official/20231113/26904_1119726.html
[merchant]: https://melbournemasters.org/setups/roles/黑市商人
[hybrid]: https://melbournemasters.org/setups/roles/混血儿
[cupid]: https://langrensha.com/news/official/2017/12/21/26904_730873.html
[characters]: https://cdn.svc.asmodee.net/production-asmodeeca/uploads/2023/07/WerewolvesCharacters_EN_Rules.pdf
[bride]: https://melbournemasters.org/setups/gui-hun-xin-niang
[salon]: https://langrensha.com/news/official/20260306/26904_1289873.html
[mist]: https://langrensha.com/hantiao/juese/20210712/26896_959025.html
[tournament]: https://langrensha.com/2023/mps/20230521/38513_1083716.html
[awakenedseer]: https://langrensha.com/news/official/20230302/26904_1076159.html
[magician]: https://melbournemasters.org/setups/roles/魔术师
[trickster]: https://melbournemasters.org/setups/roles/诡术师
[sorcerer]: https://melbournemasters.org/setups/roles/狼术师
[prince]: https://melbournemasters.org/setups/roles/定序王子
[debater]: https://melbournemasters.org/setups/roles/杠精
[silence]: https://melbournemasters.org/setups/roles/禁言长老
[warden]: https://melbournemasters.org/setups/roles/典狱长
[awakenedwitch]: https://langrensha.com/news/official/20240805/26904_1171626.html
[recenttournament]: https://langrensha.com/20260413/31014_1295775.html
[awakenedknight]: https://langrensha.com/news/activity/20260811/26906_1310699.html
