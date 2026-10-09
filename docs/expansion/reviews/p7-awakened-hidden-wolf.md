# P7：觉醒隐狼完整运行、原镜隐板与双语交付

规则：[AWA Awakened Hidden Wolf 1.0.0](../rules/awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf)；所有权：[实现契约](../awakened-hidden-wolf.md)。先前规则、枪协议、刀毒盾、资源与strict策略分笔保留；本笔启用完整角色及明确支持的六人缩编、原十二人板。

## 实现与首审修正

- 580选择另一个存活玩家，立即冻结真角色供具体身份查验；900实际夜末提交能力，Hunter此点armed，主动技能下一夜。仅六模板，不复用机械mode/反毒/穿盾/首刀夜过期。
- Mirror在900安装唯一原生role_check，空历史、独立资源、仅保存实例ID；模板已经没有G02实例不影响学习。转出/重apply不补资源。Poison仅单毒，Guard连续同ID拒绝而null打断，Wolf额外普通刀一次且可留后夜。
- 250只建立一次原body本夜权限；继承只由装配/实际整批死亡更新，查询不改事实。其它Wolf复活暂失当前刀权，不重置首夜与库存；同批本人已死不接刀。
- paid poison/guard耗空和闭夜后仍有效，施者首次实际死亡保前缀；复活/替换life、role/private/learning/skill owner撤换取消未结提案。目标原life不会伤害/保护新body。可撤毒不会回落旧PoisonMark，不抹其它合法来源。
- 八事件actor-only及字段白名单；本人state/G02报告/source各归唯一owner；God档保真实身份/阵营，玩家枪是中立player_shot/death_shot。
- **A修正**：枪快照遗漏同对象学习metadata；250同日重入可把复活body绑定旧刀权。补全原metadata与单夜权限，付费效果不按已耗库存撤回。A的耗空请求意见经getter与独立反例否证并撤回。
- **R/T修正**：Aw原生Mirror必须另绑学习owner；gift/copy保持独立。增加await/gateway/label×9撤换反例。第三次过期mimic回答后最后候选已消失时，合法wait关闭当夜、不耗学习，不能报还有目标的失败。
- **strict失败底座**：`1d6124e`已单独交付；Aw optional只把零提交clean wait当skip，真实三拒绝、取消/截止/transport错误不伪装成功。策略/Tape和failure records在本角色依赖下验证，见[策略审查](p7-strict-turn-policy.md)。

## 人工预期与实际整局

十条字面场景×SDK/ACP（真实注入MCP）/混合×zh-CN/en＝**60实际本机完整局**，每局strict Tape。Actor只持有自己脚本、当前授权DTO和公开候选，无World/牌面/seed。控制器用字面底牌和人工oracle核生命、遗言、day/phase/checkpoint、资源与胜者。

覆盖Villager、Mirror、Witch、Guard、Hunter、Wolf六模板；首夜900后枪杀末狼；后夜Aw枪→原Hunter枪连锁；原十二N2原H7枪2后Aw才接刀，N3自刀→枪G8→最后judge；单毒模板已用毒不影响新单毒；guard重复拒绝→null→下一夜恢复；N2空额外刀留N3；N2晚学N3用毒。枪actor/target、ready→枪→game_over及十二继承顺序都有直接断言。

两例各20 seed `awakened-random:0..19`：**40受限观察整局自然结束，0拒绝/回退，每局strict Tape**；无Wolf私聊/自爆、资源不补、Mirror无重复。两板实触发学习/激活/接刀/学习skip/复制毒；十二有实际复制枪。随机样本不是全部技能覆盖承诺，六模板与其它限定分支由上述字面整局及63核心规则测试保证。

## 最终证据

最终目录 **22 verified/42 planned** 在整局/Tape之前冻结，期间无生产源码编辑。以下日志已核进程终态exit0：

| 门槛                  | 证据与范围                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 60完整局＋40seed/Tape | `/tmp/awa-awakened-frozen-matrix.log` **32 pass/11544 assertions/2 files**；每决策/检查点/受众、无fallback、ACP/MCP/PID回收；非外部模型                                                             |
| 受影响后端            | `/tmp/awa-awakened-final-affected.log` **1223 pass/14272 assertions/104 files**；core/engine/game/AI/recording/replay/diagnostics/presentation及Aw配置/目录/failure Tape，非全backend release       |
| 核心专项              | `/tmp/awa-awakened-final-rules.log` **63/276**；真实同批死亡、先接刀后枪死、首夜毒/复合禁枪与Wolf复活、原owner/实例/paid前缀                                                                        |
| 静态                  | backend type/deps/boundaries/i18n全部exit0，仍57精确兼容字面例外；git diff --check                                                                                                                  |
| 前端                  | `/tmp/awa-awakened-front-unit.log` **157/1370/25 files**，type/build exit0；真实God fixture身份、查验mask、choice不致死、枪实际死亡、dead Wolf赢家与getter回退                                      |
| Chromium              | `/tmp/awa-awakened-browser.log` **6实际中英浏览器通过（2.3min）**；十二枪、守护、额外刀保留，席位与字幕布局、无提前赢家及末态成员                                                                   |
| PNG                   | `/tmp/awa-awakened-twelve-en.png` presentation frame6760，中立枪、七个已死亡席位且0winner；`/tmp/awa-awakened-guard-zh.png` frame2620，只有既死2号、目标6仍活。两render exit0，root/L独立目检无遮挡 |

最终宽回归首轮唯一失败为新增复合死因断言要求数组顺序；死因是集合，改排序比较后专项及最终1223全部通过。前端英文原文含撇号，静态HTML正确编码，断言同步按HTML转义核；没有改生产文案或真实fixture适配错误。

## 交叉审查与范围

三路最终复查均0残留，支持功能提交：A（review_arch_psychic）核原life/资源/实际900与PM职责、最终日志及22/42登记；R/T（review_rules_psychic）独立78测试/322断言，核来源、有限组合、人工十场与过程断言，并复读最终日志/文档；L/D（review_rules_gargoyle）独立投影/双语probe6/364，核真God fixtures、中立枪、两实际PNG及最终browser/日志。roles首页数字残留与规则卡当前planned措辞已同步，PNG改称‘七个已死亡席位’消除歧义，原审查者复查闭环。

支持范围严格为Aw、普通Wolf、Mirror、Witch、Hunter、Guard、Villager，Aw至多1且参数仅空对象。原十二是Aw+3普通Wolf+四神+4民；其它盾/反毒受控交互不自动开放Mechanical联合板。历史实际本机788人工场景加本笔新60累计848，本笔只重跑相关范围，不把历史全部重跑计入。

P7仍余黑市商人；P8–P10、64角色/22机制组合矩阵、长局/T6目标持续。未读取/修改用户configs或认证，未访问外部模型。本角色交付不等于完整扩充目标完成。
