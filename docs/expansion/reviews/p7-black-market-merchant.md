# P7：黑市商人完整运行与双语交付

规则：[AWA Black Market Merchant 1.0.0](../../rules/awa-black-market-merchant-v1.md#black_market_merchant)；所有权：[实现契约](../black-market-merchant.md)。规则冻结、死亡许可与赠枪底座分别由 `0b389d8`、`0c3c878`、`5c41428` 提交，本笔交付最后一个P7角色。

## 实现与审查修正

- 商人130可在任一夜交易一次，目标为另一存活玩家；clean wait关闭本夜而保库存。三拒绝、取消与传输异常沿strict策略报错，不伪装skip。
- 好人保持真身份、阵营及原生资源，新增独立礼物实例；狼人（含伪装隐狼）不获通知。商人本人仅保存remaining/closedDay/choice，不获成功结果、目标阵营、gift ID或报告；结果仅God可见。
- 主动礼物下一夜在140早槽行动，奇迹商人原125/700流程保持。check/poison可留后夜；Black毒没有解药或刀口信息，none可选任一存活ID。同actor同kind原生/礼物共用已接受目标历史，跨actor独立，转出不抹历史。
- gun在实际900夜末armed，原生枪真实提交、关闭许可后才开gift新许可；原生放弃及第一枪清空末狼/末神仍完成剩余库存、完整死亡与警徽链，PhaseManager最后判胜。首次死亡后的礼物永久过期，毒/梦/牵连等禁枪按卡处理。
- Black反噬是独立typed cause，守护、解药与梦保护均不挡；旧Miracle反噬保护语义保持。纯首夜反噬有遗言，实际死亡与警徽处理由已有结算owner执行。
- 付费毒保存首次死亡前缀，不因库存已耗或本夜关闭撤回；原生命复活、角色/私有状态/实例撤换阻止迟到作用。低层transfer只给存活Good、保库存/窗口/metadata，copy明确拒绝，不开放玩家转移玩法。
- **A修正**：夜能力/本人提示按已知状态字段投影，未知字段/getter不读；statePolicy回调后再次核原角色、生命、所有权、资源、activation及disclosure；Black140规则不混入Miracle700。
- **R/T修正**：纯反噬遗言与最后候选消失时的合法wait；新增查验报告、双库存、晚赠时点、双枪和两种警徽reason直接人工断言。失败测试的事件ID拼写已修为真实committed/resolved，定点4 failure Tape复验通过。
- **L/D修正**：合法camp/role/组合查验报告保留，只裁未知字段；礼物转出后的recipientPolicy历史仍提供正确目标规则，赠予者source仅投影kind。

## 人工完整场景

`black_market_scenarios.ts`的14条字面剧本分别是check_cross、check_duplicate、poison_duplicate、late_hold、hidden_backlash、seer_gun、gun_poison、gun_compound、native_double、native_pass、last_wolf、last_god、twelve_gun、twelve_backlash。预期来自冻结卡与人工底牌，不调用生产判胜/伤害函数计算期望。

覆盖原生/礼物同目标拒绝与纠正、跨actor独立查验、donor死亡后礼物保留、N2晚赠/N3保留/N4用毒、隐狼失败反噬与接刀、不同死因禁枪、原生放弃/连续两枪、末狼/末神中间态不提前终局、十二人首日竞选与夜死/放逐两次警徽转移。

14场景×SDK/ACP（真实进程及注入MCP）/混合×zh-CN/en＝**84实际本机完整局**，每局strict Tape，actor只持自己的脚本与授权DTO，不持World、全牌面或seed。两公开板子各20 seed `black-random:0..19`＝**40受限观察完整局**，自然结束、0拒绝/回退，每局strict Tape；随机样本补充交易/skip及礼物分支，不能代替14条限定分支。

另4个SDK/ACP×两语失败Tape使用生产provider/runner及受控SDK callbacks、进程内ACP session，验证三拒绝保库存、无伪skip/commit/result、最终checkpoint.complete=false及严格复现；这4例不声称真实HTTP/ACP进程故障通路，通用真实故障通路由全阶段回归覆盖。

## 最终功能证据

目录 **23 verified/41 planned** 在最终完整局/Tape前冻结，生产源在运行期间未修改。以下进程均终态exit0：

| 门槛                        | 范围与本机日志                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 84完整局＋40seed＋4失败Tape | `/tmp/awa-black-frozen-matrix.log`：48 pass / 13906 assertions / 3 files；实际SDK/ACP/MCP/混合、正常无fallback、严格Tape与回收                                           |
| 失败断言修正复验            | `/tmp/awa-black-failure-final.log`：4 / 48 / 1 file；仅修改测试事件ID，生产源与录制兼容指纹不变                                                                          |
| 受影响后端                  | `/tmp/awa-black-affected-preview.log`：1175 / 12678 / 88 files；core/engine/game/AI/记录/回放/配置/呈现，非全backend release                                             |
| 配置/目录与seed             | `/tmp/awa-black-seeds-config.log`：20 / 604 / 3 files；参数仅strict空对象、至多一位，有限组合和公开六/十二例                                                             |
| 静态                        | backend type/deps/boundaries/i18n exit0；57条精确既有字面例外；git diff --check                                                                                          |
| 前端                        | `/tmp/awa-black-front.log`：173 / 1496 / 27 files，type/build exit0；含10条Black中英投影/文案单测及5份实际God档                                                          |
| Chromium                    | `/tmp/awa-black-browser.log`：新增4实际浏览器通过；`/tmp/awa-p7-browser-all.log`：全量78通过，3.1分钟                                                                    |
| Remotion PNG                | `/tmp/awa-black-trade-en.png`、`/tmp/awa-black-backlash-zh.png`，均frame280、render exit0；root/L独立目检十二席无遮挡、仍全活/无赢家，反噬结果仅提案，V9获枪仍是Villager |

日志路径是本机验收记录，临时目录不属于版本化产物；可复跑命令与仓库测试位置见[交接](../handoff-p7.md)。P7全阶段门槛另见[阶段验收](p7-activation.md)，不得将上述受影响范围冒充全量。

## 三路交叉审查与支持边界

A（review_arch_psychic）冻结源末审0残留，独立核投影/statePolicy回调/付费前缀/原生命和140/700；R/T（review_rules_psychic）源码与14场景人工预期0阻断，发现并闭环失败测试拼写缺口；L/D（review_rules_gargoyle）呈现末审0残留，独立核5份God档与两PNG及中英数据边界。正式文档与P7最终日志另作阶段末审登记。

开放组合仅Black/Wolf/Wolf King/Hidden Wolf/Seer/Witch/Hunter/Guard/Dreamer/Villager，至多一位Black且参数仅空对象。六人是AWA缩编，十二人是**单枪狼王改编**；社区双枪狼王、节目狼兄弟、未冻结角色联合板均未开放。未读取/修改用户本地配置或认证，未调用外部模型。

按2026-10-09最新指令，完成P7验收后交接，停止在P7。其余41 planned及P8–P10、64角色/22机制全目标、定时大样本、发布长局/T6不标完成。
