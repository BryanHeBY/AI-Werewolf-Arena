# P8 杠精功能验收

本笔以b5f27ba8c271dfb416570b59fcefd96aae1bfb7e之后的main线性差异交付。来源为Melbourne Masters 2026组织者角色图鉴及争锋相杠板子；不是网易统一规则。单策略awa_melbourne_2026_speech_gap_v1明确普通发言前的离散窗口、双方各一次发言、活人匿名表决和工程取消约定；见规则卡。

配置严格schema/default/apply/serialize→RoleProfile实例→Day普通发言窗口→授权接收/完整晚Scope复验→玩家独立DTO/双语→God事实与完整录像→严格当前Tape→共享回放reader/终端/前端/video frame均闭环。真实Good神职无刀/狼队/死亡能力，首批11角色有限白名单；3既有AWA胜利条件计数不变，不冒称整套赛事preset。

整局一次接收commit独立于可替换privateState；合法开杠后立即付费，真实败/平票及后续取消均不退款。原生命/role/camp/privateState/政策/库存、双方徽/vote组件及字段绑定。Window与DayPipeline入口都拒重入；原phase关闭不追加晚事实。匿名选民在合法接受时冻结，已翻牌Idiot亦1票；逐provider发送前gate、收齐并再次终验选票、固定分母、不猜票/缩水。公共只有总数，不含逐票关系；God账本保存true/false/null。

成功只跳过当前常规发言，保留原自爆/骑士gap及冻结警长方向顺序；配置警徽权重/后续holder policy自动转移；资格不全取消，不意外毁徽。失败禁actor当日常规/PK放逐票；成功禁target。生命/日次处罚与永久VotingRight分离，同身角色更换不洗白、复活/换体/次日撤销，不恢复Idiot永久禁票，不影响警长选举。Gateway缺日次保守拒受罚票。活人翻牌专属事件不会标成死亡。

## 独立审查及实际判例

三组只读审查修复：严格reproduction.context漏三debate字段；分母冻结早于接受；完整接徽资格；失效选民及双方撤权后仍启动请求；死人取消后仍普通发言；已接受Window/Day重入；缺day绕罚；前端God ledger未知voterID；安全状态槽getter。后续玩家DTO删内部debate计数token，事实拒不可能人数/缺账本参与方。审查已报告问题按最终代码和独立短回归关闭，记录最终门禁在下。

62规则/异步/匿名/组件边界测试、428断言：6活人4支持成功、3支持tie、3支持+2弃/invalid失败，先失效选民不再发请求仍固定分母，接受前非双方死亡/复活重新冻结，三stage×多Scope撤权/异常保持合法扣费，无late事件/罚/徽；每票true/false/null合法、getter0/extra拒绝、private swap public projection invariant、PK禁票、Knight/selfdestruct gap、配置徽/原speakerorder、checkpoint inert penalty和实际DTO token隐藏。

6/12人×success/tie/abstain×SDK本机HTTP/ACP子进程注入MCP/混合×双语 =36个完整真实本机通路，18测试；literal actor脚本验stage、身份、请求/真实最终结果与当前strict Tape，不是真实商业模型调用。12人四日自然Good胜，6人第一日Good胜；god账本逐票不进入任何player view，当前匿名表决request使用min1/max1、noFallback，选择challenge使用min0/max1；都是实际录制读取与Tape逐项验证。

8有限board×20seed×双语=320受限观察机器人自然终局、0reject/fallback，每局record+严格Tape；独立World真相基线8×63×2=1008自然终局，只校验必要聚合/终局，不能替代受限证据。最终分支报告汇总176次开杠/结果、36次警徽移交、10次骑士决斗（不同效果不能合并称开杠正反分支全覆盖）；正/负/取消边界由手写判例独立覆盖，不声称随机种子全部分支。

4实际God录制档（6/12、success/tie）作为前端fixtures；共享studio/video frame、翻牌前后alive和literal用户文本中英验证，不改旧档事实；10新单元和8新Chromium。截图/tmp/awa-p8-debater-{zh-CN,en}-browser.png已主代理实际查看，公开汇总、角色、存活和字幕一致。无MP4或真实模型T6声明。

## 最终门禁（仅verified日志）

冻结main基线b5f27ba8c271dfb416570b59fcefd96aae1bfb7e加本批完整差异，sourceHash `46e31cf4ae709cc070a017d8642ee033a8adde7a6d7692720553bf596fc694b4`，lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`；指纹覆盖core/game/app及共享包TS，不冒称覆盖AI/runtime/frontend全文件。本笔commit保存完整差异。指纹后未改功能源码，最终静态/测试/构建均按同一源码。

完整后端四组并集 **2648通过、0失败、237397断言、219文件**；分组分别634/678/668/668，最长409.12秒，全部exit0。完整命令、文件并集和时间在 `/tmp/awa-p8-debater-verified-backend-manifest.json` 与 `/tmp/awa-p8-debater-verified-backend-{1..4}.{log,status.json}`；汇总 `/tmp/awa-p8-debater-verified-summary.json`。包含新增36通路、320受限局，以及全部已有Seer默认、Dream/Beauty历史策略、Fox/Cupid等回归。额外1008 World基线按冻结源码单独重跑，766次开杠均成功，故随机反分支由受限机器人和手写oracle各自提供。

前端完整 **248通过、2411断言、36文件**；Chromium **104通过、0跳过/失败/flaky**、单worker、零重试，217.48秒，`/tmp/awa-debater-verifiedbrowser.json`；包括8新增Debater真实档用例。根check、lint、format:check、前后端build、git diff --check均exit0，日志 `/tmp/awa-debater-verified{check,lint,format,frontend,backendbuild,frontendbuild}.log`。既有500KB包提示保留，无放宽门槛或延长测试超时。

初次普通sandbox运行实际通路被localhost EPERM阻止，不能计为产品通过；随后按已授权本机离线通路运行。final候选四组2645及Chromium104是在最后Day入口守卫前，不复用为最终门禁；修复并补3测试后重跑上述verified完整门禁。所有旧失败/候选日志保留诊断，不混入最终通过统计。

没有新branch/worktree/push/部署、秘密/用户configs读取或系统设置；目录23verified/3implemented/38planned。角色功能完成不等于P8首组事件道具、P9/P10或用户最终验收关闭。下一步有限匿名墙事件/纸条实现。
