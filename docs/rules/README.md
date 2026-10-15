# 现行规则卡与稳定身份索引

本目录是完整角色规则的唯一维护位置。来源／采纳版本、有限板子、身份与阵营、胜利、能力库存、时点、死亡／到期、信息、交互及不支持变体由对应卡维护。内部模块只说明自身职责与链接，不复制第二份全文。

资料中的verified／implemented是目录状态，不等于所有角色组合均受支持；实际支持由schema、ruleset与真实测试决定。尚未交付的planned资料不会因本索引变成可执行角色。

## 当前交付角色与规则来源

| 稳定RoleId              | 名称       | 唯一规则卡                                                                                                     |
| ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `wolf`                  | 狼人       | [awa-classic-v1.md#wolf](awa-classic-v1.md#wolf)                                                               |
| `villager`              | 平民       | [awa-classic-v1.md#villager](awa-classic-v1.md#villager)                                                       |
| `seer`                  | 预言家     | [awa-classic-v1.md#seer](awa-classic-v1.md#seer)                                                               |
| `witch`                 | 女巫       | [awa-classic-v1.md#witch](awa-classic-v1.md#witch)                                                             |
| `hunter`                | 猎人       | [awa-classic-v1.md#hunter](awa-classic-v1.md#hunter)                                                           |
| `guard`                 | 守卫       | [awa-classic-v1.md#guard](awa-classic-v1.md#guard)                                                             |
| `idiot`                 | 白痴       | [awa-classic-v1.md#idiot](awa-classic-v1.md#idiot)                                                             |
| `wolf_king`             | 狼王       | [awa-wolf-king-v1.md#wolf_king](awa-wolf-king-v1.md#wolf_king)                                                 |
| `white_wolf_king`       | 白狼王     | [awa-white-wolf-king-v1.md#white_wolf_king](awa-white-wolf-king-v1.md#white_wolf_king)                         |
| `knight`                | 骑士       | [awa-knight-v1.md#knight](awa-knight-v1.md#knight)                                                             |
| `gravekeeper`           | 守墓人     | [awa-gravekeeper-v1.md#gravekeeper](awa-gravekeeper-v1.md#gravekeeper)                                         |
| `dreamer`               | 摄梦人     | [awa-dreamer-v1.md#dreamer](awa-dreamer-v1.md#dreamer)                                                         |
| `wolf_beauty`           | 狼美人     | [awa-wolf-beauty-v1.md#wolf_beauty](awa-wolf-beauty-v1.md#wolf_beauty)                                         |
| `bear`                  | 熊         | [awa-bear-v1.md#bear](awa-bear-v1.md#bear)                                                                     |
| `hidden_wolf`           | 隐狼       | [awa-hidden-wolf-v1.md#hidden_wolf](awa-hidden-wolf-v1.md#hidden_wolf)                                         |
| `gargoyle`              | 石像鬼     | [awa-gargoyle-v1.md#gargoyle](awa-gargoyle-v1.md#gargoyle)                                                     |
| `psychic`               | 通灵师     | [awa-psychic-v1.md#psychic](awa-psychic-v1.md#psychic)                                                         |
| `mirror_girl`           | 魔镜少女   | [awa-mirror-girl-v1.md#mirror_girl](awa-mirror-girl-v1.md#mirror_girl)                                         |
| `mechanical_wolf`       | 机械狼     | [awa-mechanical-wolf-v1.md#mechanical_wolf](awa-mechanical-wolf-v1.md#mechanical_wolf)                         |
| `miracle_merchant`      | 奇迹商人   | [awa-miracle-merchant-v1.md#miracle_merchant](awa-miracle-merchant-v1.md#miracle_merchant)                     |
| `black_market_merchant` | 黑市商人   | [awa-black-market-merchant-v1.md#black_market_merchant](awa-black-market-merchant-v1.md#black_market_merchant) |
| `hybrid`                | 混血儿     | [awa-hybrid-v1.md#hybrid](awa-hybrid-v1.md#hybrid)                                                             |
| `thief`                 | 盗贼       | [lui-meme-thief-v1.md](lui-meme-thief-v1.md)                                                                   |
| `shapeshifter`          | 千面人     | [awa-netease-shapeshifter-v1.md](awa-netease-shapeshifter-v1.md)                                               |
| `lonely_girl`           | 孤独少女   | [awa-netease-lonely-girl-v1.md](awa-netease-lonely-girl-v1.md)                                                 |
| `wild_child`            | 野孩子     | [awa-lui-meme-wild-child-v1.md](awa-lui-meme-wild-child-v1.md)                                                 |
| `ghost_bride`           | 鬼魂新娘   | [awa-melbourne-ghost-bride-v1.md](awa-melbourne-ghost-bride-v1.md)                                             |
| `cupid`                 | 丘比特     | [sourced-cupid-v1.md#cupid](sourced-cupid-v1.md#cupid)                                                         |
| `cursed_fox`            | 咒狐       | [netease-cursed-fox-v1.md#cursed_fox](netease-cursed-fox-v1.md#cursed_fox)                                     |
| `demon_hunter`          | 猎魔人     | [awa-netease-demon-hunter-v1.md](awa-netease-demon-hunter-v1.md)                                               |
| `pure_white_girl`       | 纯白之女   | [awa-pure-white-night-v1.md](awa-pure-white-night-v1.md)                                                       |
| `wolf_witch`            | 狼巫       | [awa-pure-white-night-v1.md](awa-pure-white-night-v1.md)                                                       |
| `evil_knight`           | 恶夜骑士   | [awa-evil-knight-v1.md](awa-evil-knight-v1.md)                                                                 |
| `red_moon_apostle`      | 赤月使徒   | [awa-red-moon-demon-v1.md](awa-red-moon-demon-v1.md)                                                           |
| `alchemist`             | 炼金魔女   | [awa-mist-raven-twelve-v1.md](awa-mist-raven-twelve-v1.md)                                                     |
| `raven_claw_wolf`       | 狼鸦之爪   | [awa-mist-raven-twelve-v1.md](awa-mist-raven-twelve-v1.md)                                                     |
| `radiant_count`         | 流光伯爵   | [awa-radiant-eclipse-twelve-v1.md](awa-radiant-eclipse-twelve-v1.md)                                           |
| `eclipse_maid`          | 蚀日侍女   | [awa-radiant-eclipse-twelve-v1.md](awa-radiant-eclipse-twelve-v1.md)                                           |
| `night_noble`           | 夜之贵族   | [awa-noble-secret-body-twelve-v1.md](awa-noble-secret-body-twelve-v1.md)                                       |
| `fragrant_phantom`      | 寻香魅影   | [awa-fragrant-pair-seer-twelve-v1.md](awa-fragrant-pair-seer-twelve-v1.md)                                     |
| `nightmare`             | 噩梦之影   | [awa-nightmare-dreamer-v1.md](awa-nightmare-dreamer-v1.md)                                                     |
| `magician`              | 魔术师     | [awa-magician-wolf-king-v1.md](awa-magician-wolf-king-v1.md)                                                   |
| `trickster`             | 诡术师     | [awa-trickster-exile-v1.md](awa-trickster-exile-v1.md)                                                         |
| `wolf_sorcerer`         | 狼术师     | [awa-wolf-sorcerer-seats-v1.md](awa-wolf-sorcerer-seats-v1.md)                                                 |
| `order_prince`          | 定序王子   | [awa-order-prince-first-ballot-v1.md](awa-order-prince-first-ballot-v1.md)                                     |
| `time_wolf_consort`     | 蚀时狼妃   | [awa-time-consort-reflection-v1.md](awa-time-consort-reflection-v1.md)                                         |
| `day_scholar`           | 白昼学者   | [awa-scholar-mentor-twelve-v1.md](awa-scholar-mentor-twelve-v1.md)                                             |
| `night_mentor`          | 寂夜导师   | [awa-scholar-mentor-twelve-v1.md](awa-scholar-mentor-twelve-v1.md)                                             |
| `debater`               | 杠精       | [awa-melbourne-debater-v1.md#debater](awa-melbourne-debater-v1.md#debater)                                     |
| `crow`                  | 乌鸦       | [awa-netease-crow-v1.md](awa-netease-crow-v1.md)                                                               |
| `silence_elder`         | 禁言长老   | [AWA 文字动作与翻译版](awa-melbourne-silence-elder-v1.md#silence_elder)                                      |
| `white_cat`             | 白猫       | [awa-animal-dream-twelve-v1.md](awa-animal-dream-twelve-v1.md)                                                 |
| `fox_cub`               | 子狐       | [awa-animal-dream-twelve-v1.md](awa-animal-dream-twelve-v1.md)                                                 |
| `pufferfish`            | 河豚       | [awa-animal-dream-twelve-v1.md](awa-animal-dream-twelve-v1.md)                                                 |
| `awakened_idiot`        | 觉醒愚者   | [awa-noble-secret-body-twelve-v1.md](awa-noble-secret-body-twelve-v1.md)                                       |
| `awakened_seer`         | 觉醒预言家 | [awa-fragrant-pair-seer-twelve-v1.md](awa-fragrant-pair-seer-twelve-v1.md)                                     |
| `awakened_hidden_wolf`  | 觉醒隐狼   | [awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf](awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf)     |

## 尚未启用的觉醒角色规格

以下规格已经核对第一方来源，并明确列出 AWA 工程补全；角色的实际支持仍须通过完整实现与交叉审查。

| 稳定 RoleId            | 名称       | 规则规格                                             |
| ---------------------- | ---------- | ---------------------------------------------------- |
| `awakened_wolf_king`   | 觉醒狼王   | [双爪与亲传](awa-awakened-wolf-king-v1.md)           |
| `awakened_witch`       | 觉醒女巫   | [三类药剂](awa-awakened-witch-v1.md)                 |
| `awakened_wolf_beauty` | 觉醒狼美人 | [隔夜魅惑与一次替死](awa-awakened-wolf-beauty-v1.md) |
| `awakened_hunter`      | 觉醒猎人   | [定向巡猎](awa-awakened-hunter-v1.md)                |
| `awakened_guard`       | 觉醒守卫   | [昼夜保护单位](awa-awakened-guard-v1.md)             |
| `awakened_knight`      | 觉醒骑士   | [连续决斗](awa-awakened-knight-v1.md)                |

## 共同规则与维护

- [具名规则变体](policy-variants.md)：守卫、隐狼、查验、死亡枪、摄梦、狼美人、女巫及公共策略。
- [共同游戏机制](../contracts/common-gameplay.md)：权限、查验、死亡、自爆、公共参与和胜利。
- [新增机制指南](../guides/add-mechanism.md)与[当前契约](../contracts/README.md)。

规划中的角色不因资料登记而具有运行支持；稳定机器 ID、外部来源和版本限制分别保留。
