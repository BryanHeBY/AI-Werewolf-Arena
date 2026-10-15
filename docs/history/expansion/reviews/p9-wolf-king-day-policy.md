# 原生狼王白天死因策略与独立枪链账本

功能基线 `ce2985d`。新增原生狼王 `awa_day_deaths_v1`，沿用 AWA 死亡连锁和末狼判胜；仅采纳来源规则的昼夜条款，不声称实现完整 LAL 规则。角色数量仍为 23 verified、21 implemented、20 planned，44/64。

## 功能与兼容边界

- 狼王 schema/default/apply/serialize、私有 DTO、中英规则及公共说明支持第三个具名政策；猎人仍只接受原有两个政策，复制枪和赠枪保持自己的能力政策。
- 四份新公开魔术师配置覆盖 N1/N2 × original/exchanged。开枪资格与枪口映射独立；新政策要求非空且全部合格死因，并要求 Day/Voting 来源。首日先上警、当前执行已进入 Day 均不能把纯夜死变成白天死亡。
- DeathResolution 唯一持有资格 originMap，通过只读 `deathOriginPhase` 交给 hook；仅新政策原生狼王请求增加 `death_origin_phase`。追加来源仅在真实伤害同步提交时写入；落空、梦境保护和撤权不写入。
- P6 已冻结的 `nightOrigin` 梦境作用范围、legacy `death_phase`、request.phase、World actions.phase、魔术师 nightExchange 计算均保留。混合 Day+Night 死者仍受原夜梦境作用，其子枪可同时具备 Day 资格和 Night 梦境效果；默认夜死猎人追加枪的旧 death_phase 仍可为 Day。
- 狼王前后 await 和延迟提交都复核政策、死因、来源和梦境范围；末狼仍先完成现有 AWA 枪链再判胜。

## 独立记录证据

新增有限板的原始行动因果审计模块，独立重算换位、原刀票、药、枪链、上警／退水／警长与警徽、放逐票和 PK；不复用生产开枪资格判定，也不把请求自带 visible_events 当因果真源。严格 parser 核验真实死因、资格来源、执行阶段、旧死亡阶段、能力身份、重复请求及失败／未发布前缀。合法普通投票非法回复归弃票、空退水保留候选、空警徽选择撕徽，仍按原引擎柔性规则处理。

玩家视角会将猎人公开枪事件匿名为 `player_shot`；账本接受真实投影，不改身份遮蔽。真实默认 Night Hunter→King 的 pending Trace 通过，伪造 legacy Night 或 origin Day 仍被拒绝。

## 测试与失败记录

初始单位测试 7 pass／18 fail，新增政策尚未支持；实现后两条失败属于夹具错误（狼不能获得商人赠枪、机械狼测试缺少 mode），修正夹具后 25 pass；随后补齐末狼和混合梦境判例，共 28 项。

初次核心回归 287 pass／3 fail 暴露把新资格来源用于旧梦境／legacy 字段的兼容性错误。修复保留 P6 原判例，未改原 `death_causes`／`dreamer` 测试。最终核心 291 pass／4636 断言／16 文件，含 320 局 World（N1/N2 × 映射 × 中英 × 新旧资格，各 20 seed），以及原生、复制、赠枪和权限回归。

独立审查先后复现：伪造 phase/ability、请求内伪造父枪／刀／放逐因果、尚存活猎人冒充死者、普通软失败被审计误拒、自爆与刀复合假枪，以及合法匿名 player_shot 前缀被误拒。全部修正后由原报告者复验：前八项独立回归 8 pass／954 断言，最后匿名 DTO 正向及两项篡改 1 pass／157 断言。请求 phase 三项先红日志与因果反例日志保留，未将夹具错误归为产品缺陷。

最终实际通路文件 45 pass／0 fail／8908 断言；包含 24 局 N1 原枪口／换位 × 夜死／放逐 × SDK／ACP／mixed × 中英自然终局，另有 4 局 SDK／ACP 中英空枪，总计 28 局本地实际完整对局。N2 的证据为 bootstrap 和固定种子 World，未宣称 N2 全 HTTP 交叉。严格 Tape、合法失败前缀和篡改拒绝均使用真实录制。未调用真实模型。

前端单元 498 pass／5014 断言／63 文件；新 Chromium 回放 8 pass，单 worker、零 retry，见 `/tmp/awa-wolf-day-browser/result.json`。双端构建及 check/lint/format:check/diff 门禁通过；最后匿名 DTO 修正只影响记录审计与测试，未改变已验证的帧投影和浏览器夹具。

日志：`/tmp/awa-wolf-day-accepted-core.log`、`/tmp/awa-wolf-day-accepted-transports.log`、`/tmp/awa-wolf-day-origin-prefix.log`、`/tmp/awa-wolf-day-legacy-dto-green.log`、`/tmp/awa-wolf-day-final-transports.log`、`/tmp/awa-wolf-day-final-check.log`、`/tmp/awa-wolf-day-final-lint.log`、`/tmp/awa-wolf-day-final-format.log`。早期显式 prettier 对 checkpoint.txt 报无 parser，此后只格式化支持文件并以 root format:check 收口，不把该失败命令记为通过。

review_scholar_rules（R/A）、review_configuration_closure（A/D）、review_scholar_delivery（T/L/D）只读交叉复查。已报告可复现问题全部闭合。此为功能提交门禁，P9c 全支持范围的同源阶段验收另行执行；P9d–P9f、P10 与总体验收保持开放。仅 main 本地提交，不推送。
