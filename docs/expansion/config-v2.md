# P1 冻结的配置契约

## 板子格式

正常入口只读取 `boards/<id>.json`，ID 必须与文件名一致。当前格式 `version: 2`，规则集 `{ "id": "awa_classic", "version": "1.0.0" }`。基础七角色已关闭规则差异，在[P4声明验收范围](reviews/p4-activation.md)内登记 verified；当前47计划角色仍不授予运行许可。

必需结构：`board.size`、`board.roleSetups`、`rules.winConditions`、完整 `rules.hooks`、`mechanisms.sheriff`、`mechanisms.selfDestruct.enabledWindows`、`mechanisms.tieBreaker`。角色参数放 `roles.<id>`，由注册 profile 的 schema 严格验证；当前女巫支持 `selfHeal`。

- 玩家数和单项角色数为 1–128 的整数，总角色数必须等于人数；重复角色条目拒绝，使用单项 count 表示重复数量。
- 只有已注册 profile 可运行。64 项资料目录不授予运行许可。
- 起局必须有狼人和好人；屠边还必须同时含神职和平民；胜负条件不可重复。
- 警长票重为有限正数，转移后沿用；关闭警长时不允许显式初始警长或非默认警徽参数。
- 放逐平票：`min_id`/`no_elimination`；狼刀平票：`min_id`/`no_kill`；警长平票：`min_id`/`min_seat`/`no_elimination`。未来值先实现再放行，不能接受后按另一策略执行。
- P4已支持 `on_pre_election`、`on_daybreak`、`on_per_speech_gap`、`on_pre_vote` 四个自爆窗口；对应 hook 必须启用，空列表明确关闭。准确时点、首日提前自爆、消费点提交和历史迁移见[窗口契约](self-destruct-windows.md)。
- 未知字段、未注册角色、无对应角色的参数、重复窗口及越界座位均拒绝。

## 对局与玩家绑定

对局 `board` 可引用任意合法已存在 ID。现有 `roleAgents`、`playerAgents` 保留，且结合完整板子校验；同一座位同时出现新 `players` 和旧 `playerAgents` 时拒绝。

```json
{
  "board": "twelve_player_standard",
  "agent": "acp_default",
  "players": {
    "1": { "name": "苏茶茶", "personalityPrompt": "温柔追问，语气有戏。" },
    "2": { "name": "Lin", "agent": "acp_default", "personalityPrompt": null }
  },
  "locale": "zh-CN",
  "displayLocale": "zh-CN"
}
```

运行 flags 用独立类型，玩家/语言/随机资料不进入 Required flags。

- 名字与模型分开，原字符串保留，不静默去空白或翻译；最长120字符，禁止全空白。
- 新座位配置没有显式 agent 时保留原角色/默认 Agent 选择；有显式 agent 时选择该 Agent。
- 座位显式人格整体覆盖选中 profile 的人格；省略则继承，`null` 明确清空。旧绑定的整体选择与覆盖行为不改变，不隐式拼接角色人格。
- 人格可以是非空字符串或 `zh-CN`/`en` 字典。原字符串不自动翻译；缺选中语言时依次回退中文、英文，配置报告给出安全的 fallback 警告，不打印人格内容。
- `spawnArgs` 必须同时指定 ACP agent；不允许从不明确的角色/默认模型继承后猜传输。
- locale 只接受 `zh-CN`/`en`；displayLocale 缺省跟随对局；seed 为非空字符串。
- P2 T01已开启seed：发牌与逐夜狼人顺序使用按局命名随机流，manifest保存seed、算法/版本与分流方式。相同seed需要相同动作才能复现；真实模型文本不受seed固定。P3完成后执行/展示支持zh-CN/en，检查报告列出实际支持；语言与显示选择独立。
- P4 A02 已开启混合 SDK/ACP：按座位/角色选择的已解析 profile 分派，检查报告 `mixedTransports: true`。示例见 `configs.example/games/six_player_mixed.json`；认证和 ACP 命令仍需配置为本地可用值。
- SDK 与 ACP provider 均支持可选正整数 `maxConcurrentRequests`；同 provider 配置 ID 的玩家共用限额，排队/初始化/重试计入整轮截止时间。不同 provider 独立，别名/同密钥/跨进程不等于全局限额；ACP 计数约束本后端发起的回合，不宣称控制任意适配器内部的额外 HTTP 并发。
- 名字已进入身份、共享提示和公开复盘的可选 name 字段；前端姓名展示及旧档兼容已由P3验证。

## 显式迁移

从项目根目录运行：

```bash
# 预览，不写文件
bun run --cwd backend config:migrate --configs-dir ../configs
# 转换并为每份旧板子保存 .v1.bak，不读写 providers、agents 或 games
bun run --cwd backend config:migrate --configs-dir ../configs --apply
# 对原根目录/集合文件显式选板和基准，新目标文件不得覆盖另一个现存板子
bun run --cwd backend config:migrate --configs-dir ../configs --source ../configs/game-config.json --board custom_twelve --base twelve_player_standard
```

`--source` 的路径按命令 cwd（backend）解析；写入前预览，再追加 `--apply`。旧默认值、onPerSpeechGap 及实际优先胜负条件显式物化；旧单值胜负被覆盖、无角色参数被移除或空自爆列表触发旧回退时给警告。未知旧字段仍拒绝，不能靠迁移偷偷丢弃。

工具先校验全部转换，再创建备份；已有备份与当前旧文件完全相同时可安全重试，内容不同时明确拒绝且不改文件。板子通过临时文件原子发布，新目标独占创建，不能删除其他进程创建的冲突目标；批量失败尽力回滚并保留原错误/回滚错误。示例配置由 Git 保存旧版本，本地备份保留；不得整目录复制 example 覆盖密钥或人格。

## 脱敏配置检查

```bash
bun run --cwd backend config:check --configs-dir ../configs --game-config-name twelve_player_fun
```

只输出板子、规则/参数/字段来源、玩家名字、Agent名称/类型/模型、是否有私有人格、限制与执行支持状态。不输出 profile/provider 对象、env、命令参数、URL、认证和人格文本；JSON错误也不回显原输入片段。失败以 `code` 和已确认安全的 `path` 输出，例如 `roles.witch.selfHela`；任意异常只给稳定错误码。没有文件或遇到旧格式明确失败，不搜索其他路径或静默用内置板子替代。

P5狼王/白狼王/骑士/守墓人已按独立卡与通路验收注册；当前23项verified与4项implemented可在各自有限组合运行，37项planned仍拒绝。新自爆选择/API边界见[白狼王契约](white-wolf-king.md)。

骑士的三种离散发言窗口/default及[]关闭见[接入契约](knight.md)。公开six/twelve_player_knight板子与games可加载，普通/觉醒分别登记，额外参数与未注册角色仍拒绝。

P5守墓人无原生主动工具/新增参数，roles.gravekeeper只接受{}；被动时点、camp-only反馈/隐私、夜间取消与API迁移见[守墓人契约](gravekeeper.md)。公开six/twelve_player_gravekeeper保持普通狼；石像鬼守墓组合另见P6石像鬼样例。

P6摄梦人已按[卡与契约](dreamer.md)启用，roles.dreamer支持具名protectionPolicy，默认awa_night_damage_v1，来源版本netease_2026_night_immunity_v1；详见[策略契约](contracts/historical-night-role-policies.md)。公开6/12均为已验普通必选/夜间免伤版本；长期候选觉醒与免毒关闭/白天牵连等未声明参数不授予许可。

P6狼美人按[卡与契约](wolf-beauty.md)启用，roles.wolf_beauty支持具名deathLinkPolicy，默认awa_exile_poison_v1，历史heroes_s7_2017_exile_hunter_v1；详见[策略契约](contracts/historical-night-role-policies.md)。公开6/12含已实现Knight。魅惑可null消费跳过、相邻夜不能同目标，末狼特殊屠边保配置胜利条件次序；双目标/自爆/无条件牵连不开放，觉醒版仍planned。

P6熊按[卡与契约](bear.md)启用，roles.bear仅{}且原生count最多1；公共解析与直接bootstrap均约束。采用入夜取样、完整夜死后匿名公告版本，不能用参数改天亮活邻居重新计算或揭ID。原熊6/12示例是AWA组合，隐狼联合组合另见下段，均不冒认来源白神。

P6隐狼按[卡与契约](hidden-wolf.md)启用，roles.hidden_wolf支持campInspection有限具名策略且原生count最多1。采用单向互认、不夜聊、真实死亡后唯一活Wolf接刀，掩码与熊检测按曾接刀事实；不开放mist/永久平民/自爆/复制。这两板为熊隐狼AWA组合，不含石像鬼；觉醒隐狼已按P7独立契约交付，普通隐狼参数不自动授予觉醒技能。

P6石像鬼按[规则和契约](gargoyle.md)启用，roles.gargoyle支持inspectionPolicy有限AWA策略、默认awa_unique_required_v1、原生count最多1；无相认/夜聊/自爆，先具体角色查验后按原生流程及真实唯一活Wolf接刀。公开six/twelve_player_gargoyle含守墓人，十二人采用来源3普通狼＋石像鬼／预女猎墓／4民。未知mist/固定刀位/self-check等参数拒绝。

P7通灵师按[规则与契约](psychic.md)启用，roles.psychic支持inspectionPolicy有限AWA策略、默认awa_repeat_optional_v1、maxCount1。原生role_check显式policy=psychic，女巫后可跨夜重复或跳过；旧Garg缺policy维持刀前禁重/必须。身份policy不开放为任意配置开关；目标/行动配置与身份policy分离，新增未知字段仍拒绝。公开六/十二用已实现角色改编，机械狼与镜隐迷踪按各自P7契约和支持板子验证，不由通灵师注册自动授权。

## 复核补齐的现有角色配置

预言家actionPolicy所有入口统一默认awa_required_when_legal_v1，只有显式awa_optional_v1才可跳过。hunter/wolf_king的deathActionPolicy默认awa_qualified_sources_v1，可选awa_knife_or_exile_v1；只改变原生死亡枪，复制/赠予/转移枪不从持有者配置继承。gargoyle/psychic/mirror_girl的inspectionPolicy只有awa_unique_required_v1、awa_repeat_optional_v1、awa_unique_optional_v1，默认分别为这三者；时序/阵营/伪装/接刀保持身份policy机制。各空对象与省略值一致，未知版本/无对应角色均拒绝，反向序列化、实例/validator/执行/双语提示与实际严格Tape闭环。详见[有限契约与矩阵](contracts/role-policy-configuration.md)。这些AWA策略不冒称主流完整平台规则。

## 公开死亡信息与遗言

`mechanisms.disclosure.deathRevealPolicy`为`awa_hidden_v1`（兼容默认）或`netease_2017_open_v1`；`mechanisms.lastWords.policy`为`awa_initial_wave_v1`（兼容默认）或`netease_2017_day_and_first_night_v1`。省略机制对象或填空对象均归一化为默认，未知字段/版本拒绝；反向转换和strict Tape保留有效配置。明牌只公开实际死亡者当前身份牌，不公开技能、资源或阵营；遗言按逐人死亡时间及夜源链分类，默认首波限制保留。详见[契约](contracts/public-death-policies.md)。

`configs.example/boards/netease_2017_open_clause_6_v1.json`使用2017页六人角色构成与屠城目标，示范局部翻牌/遗言条款；其它流程仍为AWA，不是完整平台镜像。不会覆盖本地configs。

## P9a 盗贼有限来源配置

`roles.thief.policy`唯一接受`lui_meme_thief_two_extra_villagers_v1`（省略等价默认）。至多一Thief、City、仅七基础角色组合，原配置至少两Wolf/两非ThiefGood；其它角色或event pack组合显式拒绝。roleSetups仍N张，初始化另加两普通Villager，一次随机发N留2，不保证Thief或God上场。fixed/Tape必须完整N+2且原多重集一致，两Wolf底牌必选slot0/1，其它可null保留Thief。无fallback/任意底牌/保证神职参数。公开例子`configs.example/boards/lui_meme_thief_{6,12}_v1.json`；实际schema、实例、native库存、首夜动作与Tape边界见[来源卡](rules/lui-meme-thief-v1.md)/[验收](reviews/p9-thief.md)。
