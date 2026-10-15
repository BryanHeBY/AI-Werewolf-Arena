# P9d：迷雾鸦影玩家观察流独立账本

状态：本次 recording 功能切片完成。前置核心账本 `d66bfff`；两角色仍 planned，正式数量 44/64 不变。新角色实际 SDK／ACP／MCP、多种子自然局、前端与 Chromium 尚待交付。

## 边界

`mist_raven_feed_record.ts` 根据录像中的原始请求、结算顺序、领域事件和检查点验证有限十二人板的玩家观察流，不调用 live visibility registry、projector、frame 或伤害系统。固定白名单独立区分公开、本人和历史狼队事实；放逐摘要裁掉 tally。公开事实也必须符合精确字段表，不能利用合法事件外壳夹带他人库存。

每个玩家的 seq 从 1 连续、历史只追加。完整录像中的请求与独立推导的已发布投影精确匹配；未 checkpoint 的请求允许合法尾部，分别核原动作已结算、原夜存活、角色、事实所属日和阶段。夜间私人结果必须在白天公告之前，Raven 解封不追授旧狼聊或死人队友。未发布尾部的随机刀、夜死、选举／PK、遗言及警徽有各自的原始证据；不能只凭请求自己声称某事已发生。

已经完成的发言按原动作结算顺序完整出现，清洗文本使用已有纯文本规则；遗言授予与已经完成的遗言不能整波删除。每夜唯一事实／阶段有唯一槽位，不接受重复解封、重复排队、重复遗言、倒退阶段或未来结果。公开自爆请求另核具体 phase、首日警前限制、原夜存活及此前已公布死亡，死亡玩家的伪造 source 不能授权后继事实。

库存耗尽的自动 skip 不要求不存在的新行动；普通上警、方向、投票保持原 soft 容错。放逐四次内的修复按每个 actor 的一次最终票计数，允许自票；警徽转移更新 1.5 票权。警长弃票携带非 null 目标按既有引擎规则忽略，同步修正核心独立选举账本的旧误判。运行规则、模型预算、录像 schema 2 均未改变；非本板在主账本提前返回。

## 维护回归

新增 46 项维护测试（feed 30、兼容性 16），加原核心 58，共 **104 pass / 0 fail / 317 断言／4 文件**。真实 PM＋Trace 覆盖 pending、刚结算且尚未复制 events、失败已发布前缀，库存 skip、清洗狼聊、跨日重复发言、上警／警票非法回复、警徽转移、自票及有限重试；关键泄露、丢失、重复、时序篡改均被公共解析器拒绝。

`mist_raven_prefix.ts` 收走既有增量测试的真实前缀构造，固定角色与人工行动不替代 observed player。日志 `/tmp/awa-mist-feed-maintained-v14.log` 保留；最终同源综合门禁包含全部维护测试。

## 三路独立复验

- T：83 份固定真实正例、95 份负例；包括两种 PK、四自爆窗口、遗言、交徽、抽签及未落盘公共尾部。两份原 fixture SHA 保持 `5478f6889e71eef42b1fdd9eeb327302e7ef9261cc87a7cf7d9c28179876aef6` 与 `34b5fc0703bb5adb504f21a90a4e50cbf31f5f3c8586f2aa1f228b0eba0b0b67`，未重新采样。原始脚本 `/tmp/awa-mist-visible-*.ts`，最终 `/tmp/awa-mist-visible-*-final-review.log`。最后 dead-source 先在入口拒绝，不冒称其后续伪事件已执行。
- A：原 v2 八项／29 断言及追加救治前公告边界的 v3 十项／36 断言全绿。修复 Night／Day 提前公告、spent skip、投票 soft 误拒，以及公开警徽／选举摘要夹带 canary。日志 `/tmp/awa-mist-feed-boundary-review-v{2,3}-final.log`。
- R：22 份修复前保存的原始 pending／settled JSON 直接复验全绿，包括清洗发言、同文跨日、移徽票重、非法上警／警票、正常自票、重试成功及警长非法弃票；未重采样。日志 `/tmp/awa-mist-feed-r-final-recheck.log`。有限 Night／Raven／Snake 推导未发现其他已知阻断。

所有具体意见由主任务修改，原审查者复验关闭。上述范围不能登记真实通信、浏览器或完整角色已完成。

## 门禁与首次失败

最终综合门禁 `/tmp/awa-mist-feed-accepted/`：**405 pass / 0 fail / 2863 断言／20 文件**，43.80 秒。列表 `tests.txt`，命令脚本 `/tmp/run-awa-mist-feed-gate.py`。1414 个源码、测试、公开配置及包输入前后 SHA256 均为 `071051988c161f50f9548bf82bb7ff49c79ebd3170563ed703f654d4791977b6`；该指纹描述本功能输入范围，不替代 P9d／P10 全量阶段指纹。

root check（两端及后端测试类型）、lint、format:check、后端 build、git diff --check 均 exit 0。静态日志保留在 `/tmp/awa-mist-feed-first-sandbox/{check,lint,format,build,diff}.log`，源码与最终综合门禁相同。

首次维护迁入误将三条 test 定义嵌入另一 test，已提到顶层，原 `/tmp/awa-mist-feed-gate.log` 保留（319 pass／7 fail）。类型检查中 phase 临时变量推断及测试将 enum 写成字面字符串均修正，不能以 Bun 执行替代类型门禁。

首次冻结综合命令因沙箱禁止 localhost listen，学者导师既有 SDK 夹具在模块装配时 EPERM；记录在 `/tmp/awa-mist-feed-first-sandbox/`（344 pass／1 fail，输入未变）。获得本机通信权限后相同 20 文件完整重跑全部通过，没有调用真实模型、访问私密配置或改变来源来绕过失败。

## 接续任务

1. 补六种梦境交互与四自爆窗口的维护完整 finalized Tape；现四个人工完整 variant 覆盖仍不足以声称整张规则卡已交付。
2. 新三阶段双语 SDK／ACP／MCP 实际通信；Raven 狼队历史按解封 seq 授权。
3. 按 runtime-resources 的每局测试依赖精确收紧 late 请求，证明到达、超时、实际 MCP 迟到拒绝和物理回收；正常请求保留十秒。
4. 20–50 固定种子受限策略自然终局、严格 Tape、有效分支计数；完善仅依 DTO 的策略以达到延迟用药、明确弃刀等分支。
5. 使用实际录制生成前端 fixture，验证私有／公开文案、seek、帧与 Chromium。完成整角色交付后再调整正式计数并继续其余 P9d／P9e／P9f 与 P10。
