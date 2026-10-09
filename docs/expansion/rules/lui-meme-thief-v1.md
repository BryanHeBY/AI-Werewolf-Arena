# P9a 盗贼：真实额外牌池与首次身份选择

状态：有限策略已implemented并完成本批功能门禁，见[验收](../reviews/p9-thief.md)；整体任务仍待用户验收。唯一策略 `lui_meme_thief_two_extra_villagers_v1`。

## 来源及工程边界

发行商《The Werewolves of Miller's Hollow》基础规则书，第9页（PDF第9面）的Thief与第12页的开局顺序：[发行商规则书](https://world-of-board-games.com.sg/docs/Werewolves-Millers-Hollow.pdf)。使用盗贼时在原牌组加入两张普通Villager，洗牌后向每名玩家发一张，两余牌面朝下留置。上场盗贼首夜私看两牌，可选一张替换；两张都是Wolf时必须替换。选择后扮演新角色；初始顺序Thief→Cupid→情侣。不能改成至少一张狼就必选，不能保证盗贼/神职发进玩家手中。

首批AWA有限支持 Thief 与 Wolf/Villager/Seer/Witch/Hunter/Guard/Idiot，至多一个Thief、City胜利且配置牌至少两个普通Wolf、至少两个非ThiefGood。这些组合下限是工程支持限制，保证有限实现的双方实际可存在，不冒称发行商条款。事件包及其它扩展角色未核验，配置显式拒绝，不补猜规则。

## N+2拓扑与时序

roleSetups描述N张原配置牌；盗贼存在时实际候选牌组另外加入两张普通Villager，完整N+2一次deal RNG洗牌，前N发给稳定座位，末两张按slot0/1留底。不重抽，不保送盗贼、狼或任一God，不从既已分发的N牌伪造底牌。无盗贼配置沿用原N牌和RNG路径。

完整固定fixture输入须N+2且精确多重集合匹配；完整原始顺序、底牌及初始玩家身份仅God录制，并作为当前Tape重执行输入。当前角色更换后的牌不能反写初始metadata。初始公共板子只发布N+2候选牌数量与N玩家/两余牌实际未知说明，不从world玩家角色反推底牌。

第一夜普通夜间流水线、狼互认和原生能力前完成盗贼窗口。初始所有实际玩家主体/生命/角色保持原发牌授权才继续；其它玩家的身份/生命外部撤权也取消setup，普通夜间入口不能跳过pending/failed/cancelled门禁。仅真实上场、活着且原生命/身份/阵营/私有状态与原底牌授权仍有效者可请求。底牌只有盗贼本人DTO/提示及God事实能看到；其余玩家不接收事件关联。若盗贼在底牌，没有选择请求。

## 选择与身份启用

两底牌Wolf：必须提交slot0或slot1，min1/max1/noFallback；预算内始终无合法动作是显式失败，不默认选牌或静默留Good。其它组合：min0/max1/noFallback，可以合法保留Thief，属于AWA明确映射为Good普通村民型身份；合法选slot后只更换Role/Camp/Victory及新角色的完整native privateState，依配置应用原生政策/资源。Identity/座号/姓名、Alive、Vote、Badge、Agent/人格/会话与已获历史保持原主体。

选择交换真实物理卡：所选slot换成原Thief牌，未选slot不改；全牌组多重集合守恒。重复Wolf底牌仍slot分别可选。原role/state、camp/victory与life、两底牌对象/字段、配置/phase/窗口/整局一次栅栏全部晚校验；撤权无换牌/错误消费，不以迟到回包补旧身份。接收付费、执行、更换与private通知是一次同步原子提交。身份更换后当夜新Wolf正常互认/刀权，新Seer/Witch/Guard原生能力按本配置执行，新Hunter获得原生枪；保留Thief没有复制/赠予能力。

所有SDK/ACP会话提示明确初始身份只是会话建立时状态，后续每轮引擎当前身份优先；保持会话与历史，不用重建Agent洗掉历史。当前私有换牌事实提供实际新身份。公共只知道板子规则，不得获取底牌、选择、身份变化或其事件数量。

## 必须实际覆盖的判例

- 无Thief时旧deal和完整局严格Tape保持；Thief掉底时零请求；God掉底时不产生该God actor。
- 两Wolf底牌必选，两slot各自合法；一Wolf+God不强迫选Wolf，可保留/选任一slot；空回包与耗尽非法强制选择显式失败。
- Wolf新身份首夜互认/knife，Seer/Witch/Hunter/Guard各完整原生库存及对应政策；同人座位/徽/票/history不更换。
- full fixed deal错误长度/多重集合拒绝；原始deal/底牌/换牌/初始及最终checkpoint严格Tape匹配，tamper拒绝。
- request构造/发送/await/提交前后生命、原role/state、底牌引用/字段、phase与配置撤权，重入/换体/复活/下一夜不重开。
- 两世界权限隔离；所有私有事实公共/其它玩家不可见，view-local provenance无隐藏行计数；双语机器事实与literal用户文本一致。
- finite6/12、实际SDK HTTP/ACP子进程注入MCP/混合双语完整局及每局Tape；受限ObservedBots、独立World oracle与完整门禁按冻结源码独立记录。

三组独立只读方案审查已闭合来源/空方约束、真实N+2拓扑、保密、原生库存及Tape/提示缓存风险。后续功能门禁按实际源码登记，方案审查不等同于功能验收。
