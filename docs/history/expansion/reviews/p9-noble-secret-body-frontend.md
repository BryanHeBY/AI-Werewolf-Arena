# P9d 觉醒之夜：实际回放与画面切片

前置 `3d86e88`。四个完整族（expiry、新旧清除、刀毒／到期双中、活人翻牌移徽）×中英，以及翻牌发言缺失×中英，均从真实本机SDK运行、严格账本和Tape后导出。保留 **10份God replay／10份CP／44份玩家档**，共64个fixtures；不是手写伪造完整对局。

## 正确性修复

- Remotion原先只读metadata.role；私有最小画面将其他角色遮蔽为unknown后，即使合法公开翻牌已设置publicRole，席位仍unknown。现在仅对role===unknown使用publicRole作为显示回退，保持内部role/camp与已知真实身份；不会让旧公开身份覆盖后续已知identity_changed。
- 玩家档公开警长当选summary、不包含God-only sheriff_elected。reader现从合法数字winner的summary赋徽；backend在发布该summary之前已成功assignSheriff。进入PK的首轮平票winner=null不授徽，首轮直接获胜正常授徽；重复God elected幂等。非法winner／投票行／额外ID／已提供的非法round不产生部分effect，旧档省略round兼容。
- AST契约覆盖原先只读取EventPayloadMap直接成员，漏掉13个共享Noble父接口成员；现在显式解析该唯一直接父接口，未知父类型仍报错，不削减覆盖断言或把缺口改成允许列表忽略。

秘密选择、清除、抵伤、提交凭据和私有通知不更改前端Alive；统一night_resolved才宣布夜死。公开活人翻牌仅补角色，保留Alive／警徽；后续真正voted_out和badge_transferred分别改变死亡／徽章。回退帧恢复当时角色与徽章，不依赖工作台交互状态。

## 实际验收

| 门禁                                                        | 结果                          | 证据                                           |
| ----------------------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| 完整四族真SDK双语导出＋Tape                                 | 4测试／8局、0失败、15718断言  | `/tmp/awa-noble-frontend-fixtures.log`         |
| 缺失翻牌发言真SDK双语导出＋Tape                             | 1测试／2局、0失败、670断言    | `/tmp/awa-noble-frontend-failed-fixtures.log`  |
| God／五种授权玩家档、帧边界、私有翻牌、PK摘要及失败前缀维护 | 61/0/7750，四文件             | `/tmp/awa-noble-front-archive-final.log`       |
| 当前全部前端unit                                            | 872/0/33623，75文件           | `/tmp/awa-noble-front-final-full-unit.log`     |
| Chromium四God族与五玩家翻牌／徽章两语                       | 18/0                          | `/tmp/awa-noble-front-e2e-first.log`           |
| Chromium本人N3旧知情→N4通知更新及回退，两角色两语           | 4/0                           | `/tmp/awa-noble-front-notice-e2e.log`          |
| Chromium翻牌发言失败终帧Alive／徽、无假胜者两语             | 2/0                           | `/tmp/awa-noble-front-failed-e2e.log`          |
| 实际Remotion PNG，英文villager授权翻牌帧2115                | exit0，1280×720，人工目检通过 | `/tmp/awa-noble-private-reveal-en-3d86e88.png` |
| 实际Remotion PNG，中文God真实抵伤帧8865                     | exit0，1280×720，人工目检通过 | `/tmp/awa-noble-god-block-zh-3d86e88.png`      |

PNG实际展示公开Body仍活人持徽、其他玩家身份遮蔽；God抵伤帧保留真实来源且未提前宣布本夜死亡。标题、席位和字幕没有遮挡／裁切。两份renderer日志与退出状态已核；资源值／来源机器字段保持原样。

前端typecheck／lint／build，后端fixture导出测试类型，以及格式／diff分别通过。最初private角色回退8红、producer契约缺继承1红及畸形round反例均保留，不改原预期来变绿。原全量865/1是在契约覆盖修正前，最终全量872/0包含随后新增失败前缀及guard维护；不同轮次不混算。

## 独立交叉审查

- T/L/D原真实villager档翻牌角色／徽跨帧P2修后独立 **2/0/22**，`/tmp/awa-noble-masked-reveal-frame-delivery-badge-fixed.log`；另PK／非法winner／幂等／回退字面帧 **4/0/40**。所有原输入迁入维护；首次unknown标签校准失误另存，不当生产缺陷。
- A发现畸形round仍能授徽，补safe integer>=1后原输入独立 **5/0/6**，`/tmp/awa-noble-frontend-summary-a-independent-fixed.log`；非法尾部投票、额外ID整事件无effect，直接父接口13字段覆盖复核通过。
- R确认实际授徽先于summary、首轮平票和首轮获胜区别，公开身份回退不改隐藏camp／真实metadata，实际死亡和移徽各自按对应事件生效；无剩余原语义发现。

## 范围与接续

玩家画面使用实际授权事件和遮蔽metadata组成既有最小render契约，**不声称工作台已支持直接导入玩家文件或席位筛选等于权限切换**。God文件导入／timeline／seek走当前实际工作台。规则卡的独立board editor仍需后续交付，JSON往返不是编辑器证据。

两角色仍planned、正式 **48/64**。剩余实际窗口／撤权与配置差异补充、冻结同源全部支持范围门禁及最终独立审查全部通过后，才登记50/64。没有push、外部计费模型、用户configs／认证读取；其它P9与P10继续完整目标。
