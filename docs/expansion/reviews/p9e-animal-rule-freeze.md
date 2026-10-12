# P9e 动物梦境规则预审

本批仅冻结[原生十二人规则卡](../rules/awa-animal-dream-twelve-v1.md)的实施目标，白猫／子狐／河豚仍planned，目录52/64不变。网易两篇正文、静态卡矛盾、平台与AWA裁定分开记录；没有开放板子或登记运行支持。

## 独立三路原意见

| 审查  | 原发现                                          | 冻结答案                                                                                         |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| R     | 旧熊入夜取样与来源天亮活邻不一致                | 新板显式dawn-live，旧省略保night-open；原owner夜初锁定                                           |
| R/T   | Fox仅跳美人请求仍留前夜夜魅惑                   | 同支付清当前绑定，保历史，blockedNight断连续；无伪null行动                                       |
| R/A   | wolf priority来源范围、整队或单体禁刀及遗言量词 | 全链优先标AWA；命中任狼整队无刀；每实际波词→徽→hook→追加波                                       |
| R/T   | Cat首次延寿、单位、skip边界与真实来源           | 一次延期保Alive/version；PK全单位；纯expiry新来源，不搬旧夜刀；skip变体到期先于判胜              |
| R/T/A | Puffer最后轮全弃、自票、零目标及被动独立        | final包括最终全弃且不回退；普通合法自票、PK候选禁投；零对象无请求，false不耗；主动与刀死被动独立 |
| T/A   | 首日公告、预接收与付款、失败前缀                | 竞选前本人也无未提交pending；最后域授权receipt才付款；已付失败不退款、不造未提交死亡／公告       |
| A     | PM夜公告与旧voted_out提前画死Cat                | 原夜伤集合∩实际commit；纯爆／expiry不冒夜死；Exile真提交后才voted_out                            |
| T/L   | 旧player_role_revealed同时包含死亡effect        | 新动物活人亮牌仅publicRole，复用现有masked显示；旧死亡亮牌语义保持                               |

R、A、T/L/D分别只读审查来源及人工裁定、唯一生命／票单位／原票receipt与配置、知情／实际通信／播放器门槛，原意见经原提出者复查关闭。范围来自临时候选，不以纯算术测试代替真实World或对局。原报告：`/tmp/awa-animal-dream-architecture-a-review.md`、`/tmp/awa-animal-preset-architecture-a-review.md`、`/tmp/awa-animal-dream-tld-review.md`、`/tmp/awa-animal-information-delivery-pre-review.md`。

## 实施次序与必要门槛

纯状态／原生命底座 → Fox许可与Bear策略 → Cat实际延期及单位 → Puffer原投票与完整链 → 独立CP／玩家知识／Tape → 四公开配置／两语实际SDK与ACP／受限seed／真实前端 → 同源阶段全量及三路复核。每个可构建边界本地main提交，计数在完整交付后变化。

配置apply／serialize不得依赖角色参数键顺序；Bear optional/defaults{}保旧roles.bear:{}和history-only状态，显式dawn只限本板。字段归属、内部strict schema、具名错误白名单与旧机械配置期望同步处理，避免只更新公开参数而遗漏直接bootstrap或验收读取。

Actor投影共用已发布知识：Cat时钟／unit、Puffer刀死日、Fox命中只God；动态statusDirective、能力metadata、role.renderPrompt、Beauty旧target/history与Bear未发布history均需同前缀核验。新提案不能复用会画死的voted_out／charm_death。前端只实际公共死亡改变Alive，翻牌／God原事实无死亡effect。

已准备纯状态与有限资格原型，原Cat旧unit提前到期／外部iterator/getter及Puffer死亡后历史反例已修并原审查者静态关闭；正式源迁移后另跑类型与维护测试。此处不登记角色、真实模型、编辑器或P10完成。
