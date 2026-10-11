# P9d 觉醒之夜：独立记录账本切片

前置 `91470e9`。本批交付新板的独立档案推导、检查点游标和严格 Tape；**两角色仍 planned，正式 48/64 不变**。实际 SDK／ACP／mixed 完整通路、受限观察、完整人工交互与四政策、真实前端／Remotion 和冻结同源全支持门禁继续接续，不将这个切片当作角色完整验收。

## 数据边界

- `RecordedNobleBodyState` 严格保存原贵族／身体 ID、实际契约和身体资源、各自已告知状态、通知历史及每夜窗口状态。它是档案结构，不复用生产状态转换充当预期。
- 独立账本从初始牌面、实际请求／响应、事件及 God 操作推导契约、唯一资源、通知、原生刀药、五类有效来源、真实存活、投票／PK、警徽和屠边结果。没有导入生产 owner、伤害 reducer、World 权限选择器或可见性投影生成 oracle。选举复用既有独立档案算术。
- 同一事件数量内可有多条操作，因此检查点增加 `operationCount`、`decisionCount`、`settlementCount`；操作保存 `event_count`，请求保存 `openedAtEventCount`。合并事件／操作顺序时按两个游标定位，不拿 CP 状态证明它自身正确。
- `openedAfterSettlement` 保留原响应因果；开启事件游标冻结当时的本人 feed、阶段和存活。检查点不能纳入未来请求，错误响应也算已结算。最终成功或失败的末 CP 必须覆盖最终事件／操作／请求／结算，不能少计已提交死亡。
- 实时增量档案仍不导出 operations；没有新 CP 的真实 pending 前缀可自动落盘。最终档案导出完整操作，再做逐边界严格核验。旧板不能混入新板 CP、请求游标、角色私有子树或 God 操作。

## 提交凭据与失败前缀

原运行切片的 8 类事实加 5 类 God 提交事实，现为 **13 类**。新增事实是 `noble_body_night_opened`、`noble_body_knife_committed`、`noble_body_native_damage_committed`、`noble_body_sources_committed`、`noble_body_death_committed`。它们说明实际域提交时点，均永久 God-only，不能通过篡改 audience 注入玩家历史；本身不让播放器修改 Alive／警徽。

刀标记提交发生在有效狼刀标记添加之后；原生伤害提交发生在 `DamageResolutionSystem.resolve` 清除标记之后。账本按实际刀／药事实维护有序 marks，在清标提交处清空。严格 Seer 或其它必需阶段失败时不能伪造清标；刀毒同中、刀救同中、猎魔原生毒免尚未结算时都保留真实原始标记。最终源提交另核清除／到期及身体单次抵伤，不拿原生清标冒充最终死亡。

真正死亡与其 pending 夜仆关闭在同步域内先完成，再写 Required death operation。注入操作写入异常不允许留下 Alive=false 而原契约仍 pending；本人知情仍按下一夜通知。警徽选择继续原有单次 soft 规则：缺失或非法继承对象毁徽，provider 异常仍传播，不为了账本把其改成严格新技能。

## 独立交叉审查与修复

- R：原 5 个事件／操作变异关闭；真实刀药后 Seer 失败暴露 marks 固定为空的误拒；三个同目标／毒免标记顺序及两种合法毁徽均复验通过，原脚本合计 8/0/18。随后 4 个共改反例中“失败 Seer 后追加清标事件及匹配操作”初次仍接受；加上全部必需成功前置后原输入独立 **4/0**，`/tmp/awa-noble-r-marks-cotamper-independent-fixed.log`。
- A：原游标／旧板／God metadata 两文件独立 **23/0/30**。新真实失败前缀发现 error 结算可清零、末 CP 可漏最后死亡 op；修正后用同一原生成器重新录制当前格式、仅换输入路径，原两反例及两合法正例独立 **4/0/8**，`/tmp/awa-noble-ledger-failed-cursors-a-review-fixed.log`；原红证据保留。
- T/L/D：原 9 项提示共同篡改及四夜 Tape 独立全绿。真实 provider 未返回时的 Body／Noble／翻牌发言三前缀等待 350ms，读取真实 debounce 自动写盘，再完成当前周期及严格 Tape；加新事实后的复验 **3/0/1183**。新增两 God 标签因多传模板参数曾令隐藏终端和中英渲染也抛错，按各模板精确传参后原输入独立 **9/0/60**，`/tmp/awa-noble-new-god-render-delivery-independent-fixed.log`。

以上独立 `/tmp` 探测保留原输入、初次失败与复验日志，不与维护测试计数相加冒充唯一全量。

## 仓库回归与局部门禁

- 后端 4 个新维护文件：**57/0/1301**，`/tmp/awa-noble-ledger-maintained-final.log`。包括五个自然完整局、七种严格失败 Tape、四类真实标记前缀、两种毁徽、末 CP 完整计数、提交操作字段篡改、失败阶段伪清标、双删清标、提示／受众／通知／已知资源共改、三种真实 pending 自动落盘、死亡操作异常及中英标签。
- 文档最终复查后另补原 Body 阶段篡改、公有发言夹带私有 metadata、God audience 及两种重复提交事件回归；定向 **5/0/5**，`/tmp/awa-noble-ledger-maintained-followup.log`。这些增补不冒称重新执行四文件完整集。
- 前端两个维护文件：**8/0/59**，`/tmp/awa-noble-ledger-frontend-unit-final.log`，包括原活人翻牌和新增 God 凭据的无 Alive／警徽副作用、错误 envelope 拒绝与双语标签。
- 既有猎魔／赤月三份 reproduction 回归：**77/0/521**，`/tmp/awa-noble-ledger-old-demon-regression-final.log`；新格式没有扩散到旧板。
- 源码／测试类型、前端 typecheck、双端 lint、边界、i18n 与格式／diff 分别核验。首次临时 import、只读期望数组、nullable 标签类型和错误旧测试文件名的日志保留；不把未匹配文件命令称回归通过。

## 下一步

### 后续终局请求资格修正

实际通信切片 `dabb645` 后的空闲 A 审查证实：真实完整 expiry 档案在 GameOver 后追加活村民投票、同步补末 CP 计数和完整公开 feed，turn 1／2 均曾被公共 parser 接受。按开启时点统一拒绝 GameOver 请求，保留正常投票 soft 语义。原输入独立 **3/0/25**，`/tmp/awa-noble-after-game-vote-a-independent-fixed.log`；同原变异维护测试 **3/0/25**，`/tmp/awa-noble-postgame-maintained-final.log`，包含 fresh 自然终局与精确 Tape 正例。未扩展伪造投票情景或复跑通信矩阵；两角色计数不变。

### 后续自爆跳夜检查点修正

终局修复 `8159282` 后的受限观察捕获合法 CP：已完成 Night2、自爆跳过放逐，末 phase_changed 已为 Night3，snapshot.day=3。旧账本对事件日次再加一，误拒此路径。现在从独立事件折叠得到的已完成夜推导下一天，并核对 CP cycle；普通 Voting 路径不变，不拿 CP 自述夜次当 oracle。新增手写四夜真实贵族自爆、paid 契约继续到期、死贵族知情不刷新、自然 Good 与严格 Tape，单项 **1/0/7**；A 独立连维护及两个日次共改反例 **4/0/16**，`/tmp/awa-noble-blast-checkpoint-a-review.log`。相同原输入已迁入两份维护测试；首次模拟误拒和捕获日志保留，未放宽 event／source／资源验证。

复用真实 transport runner，按独立角色相对计划执行 SDK／ACP／mixed × 中文／英文，覆盖四政策、实际通知前后信息边界、严格 missing／late／撤权和资源关闭。补全部人工源组合、选举／自爆及受限观察种子；从真实档案导出 God／各玩家 fixtures，执行 frame／seek、Chromium 与 Remotion，再执行新源码同源完整门禁及独立最终核验，全部通过后才登记 50/64。

当前没有独立 board editor，公共 JSON 往返仍不代表编辑器交付。剩余寻香魅影／觉醒预言家、P9e 六项、P9f 剩六项、P10 长局／64角色22机制矩阵和预算授权范围内的 T6 均保持开放。本批没有真实模型调用或 push。
