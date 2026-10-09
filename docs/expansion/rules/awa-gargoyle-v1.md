# AWA Gargoyle 1.0.0 规则卡

awa_classic 1.0.0扩展，ID `gargoyle`，石像鬼／Gargoyle，核验2026-10-08。采用普通石像鬼守墓人版；觉醒石像鬼仍为64之外长期候选，迷雾固定刀位变体不混入。

## gargoyle

- 真实Wolf阵营／Wolf胜利归属，原生count最多1；正常公共发言、投票／警长／放逐，不能原生自爆或死亡枪。与普通狼不互认、不夜聊、不读取其历史刀票或刀口；曾通过合法查验知道某狼身份也不加入狼窝或共享历史。
- 首夜起上半夜独立查验其它存活玩家的具体角色，`inspect_role {target_id}`；不能自验、同一role_check实例不能重复验同一稳定player ID。按最终提交点的规则角色标签（含明确伪装）返回 `{kind:role,role:RoleId}`，不是擅自绕过全部伪装查真实身份；旧结果不回写。native同实例跨life仍不能重复查验；不同gift/copy实例按显式初始state独立判断，不声明全玩家共享账本。
- 每个role_check能力实例每夜一次，有未验存活目标时本AWA版本必须完成查验；三次null/非法仍有资格和合法目标则明确失败，不静默无查验出刀。没有未验存活目标时不伪造ActionRequest/结果/资源消耗，视本夜查验流程结束。非法/迟到/演员或目标原生命撤销不写history、不耗资源；原已完成前缀保留。
- 查验优先级180（Dream150后、狼聊200/Guard300/刀400前），本局全部身份装配后再执行。组织者首夜将查验列在其它登记后，2018发布稿为上半夜；AWA明确以上离散时序，不能把查验结果提前给狼人或目标。
- 其它真实Wolf全部实际死亡后，仍存活的石像鬼获得基础刀权；开局唯一Wolf也获得。记录一次actor-only `gargoyle_awakened {actorId,day}`及曾获得事实，不猜待死亡／未结算刀毒。同批同死不获得，独立追加提案先获后死保原事实。
- 当前knife资格须当前原Role/state/生命有效且唯一活Wolf，并完成本夜原生查验流程后才进入普通`kill_vote`（可弃票／自刀）。合法查验可与刀在同夜分别行动；Day获得不立即出刀。原生查验被撤销／禁用不能让旧查验流程给新生命或新夜授权刀；其它Wolf复活可撤当前刀资格，不撤历史。
- 预言家／守墓阵营查验始终Wolf，熊始终可感知，Knight始终按真Camp.Wolf；隐狼查验标签按其已冻结规则，不采用迷雾永久平民。石像鬼与隐狼同入AWA组合时，两者接刀仍要求自己是唯一活真实Wolf，未产生双刀或固定顺位。
- 实际查验者拥有typed报告/history与本人的流程／接刀状态；受控transfer保完整history/uses并授权新持有者读取旧typed知识，不重发旧事件或改变阵营，这是AWA明确政策；目标无通知、marks、特殊错误或新行动。`role_inspected`仅actor，知晓身份来自私有记录，不等于自动wolfTeam知识授权。公开仅基础夜死／枪／放逐事实，接刀不翻牌。

## 能力、生命周期与参数

role_check沿G02实例保存id/资源/lastDay/history，支持受控gift/copy/transfer基础；native同实例跨life保历史，transfer保原完整知识和资源，新copy/gift以明确state政策独立。角色原native接刀事实与查验实例分开，获赠查验不变身份/阵营。原生流程完成范围只在World私有生命周期数据中，原role/state/ability/life及phase clock最终再验，不把引用落盘。复活／换组件／转移不能借旧实例回合晚报新生命；无目标不假耗用，重复进入不重复报告。

DeathResolution唯一提交死亡，装配及真实死亡整批后更新native继承事实，PM最后judge。基础狼刀沿已接入的每票原life、有效tally、临时刀scope、首日pending NightDamage生命复验，不旧刀伤新life；历史记录保留。

本卡描述兼容默认；`roles.gargoyle.inspectionPolicy`现可显式选有限AWA目标/行动策略，见[配置契约](../contracts/role-policy-configuration.md)，未知自爆/相认/self/固定刀位等参数拒绝；公开6/12只用注册角色，12为3Wolf+Garg／Seer Witch Hunter Gravekeeper／4Villager。范围由交互／完整矩阵证据说明，不宣布其它同名规则或觉醒支持。

## 来源

[组织者石像鬼守墓人板](https://melbournemasters.org/setups/shi-xiang-gui-shou-mu-ren)及[角色页](https://melbournemasters.org/setups/roles/石像鬼)说明独立行动、具体角色查验、其它狼人出局后查后带刀、被预言家查为Wolf。[2018-08-29发布稿（狼人杀Werewolves账号）](https://www.sohu.com/a/250791991_729113)明确不自爆／不互认／不夜聊／无刀口、不可self或重复、上半夜查验／接后可自刀；其托管域为搜狐，不称网易官网。

必须查验/耗尽目标、180优先级、typed规则标签含伪装、所有真实Wolf接刀条件／单原生、流程完成的原生命授权、G02借用／取消／序列化及同批/追加时点是AWA明确细则，逐项人工验证；不靠攻略汇总替代来源。

## 必验

单向皆无互认/聊/刀口、自爆禁；合法具体role/原有seer camp区分、self/repeat/dead/nullable/非法不耗、每实例每夜/无目标/mandatory失败；原role/ability/state/目标life/gateway/phase撤销、gift真实身份与history不变、转移资源；开局/Day/Night/同批/追加继承、查后刀/无目标刀/禁用撤权不旧授权；Keeper反馈/Seer/熊/Knight真阵营、王枪/白狼/Beauty/梦/隐狼核心交互与全链judge；actor-only/目标无通知/不回溯历史/Mask标签/中英/DTO/记录/终端/前端；公开6/12参数/count、SDK/ACP/混合两语字面完整局及每局Tape、20seed每板真实查验+继承/刀分支与重放，三路审查；P6结束完整支持回归。

P7已新增同role_check的[通灵policy](awa-psychic-v1.md)，其晚阶段/可repeat/skip独立；本卡禁重/必须与查后刀完成专属gargoyle policy，旧缺省仍gargoyle。
