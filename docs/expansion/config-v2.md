# P1 冻结的配置契约

## 板子格式

正常入口只读取 `boards/<id>.json`，ID 必须与文件名一致。当前格式 `version: 2`，规则集 `{ "id": "awa_classic", "version": "1.0.0" }`。基础七角色已关闭规则差异，在[P4声明验收范围](reviews/p4-activation.md)内登记 verified；当前53计划角色仍不授予运行许可。

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

P5狼王/白狼王/骑士/守墓人已按独立卡与通路验收注册；当前11项可运行，53计划项仍拒绝。新自爆选择/API边界见[白狼王契约](white-wolf-king.md)。

骑士的三种离散发言窗口/default及[]关闭见[接入契约](knight.md)。公开six/twelve_player_knight板子与games可加载，普通/觉醒分别登记，额外参数与未注册守墓人仍拒绝。

P5守墓人无原生主动工具/新增参数，roles.gravekeeper只接受{}；被动时点、camp-only反馈/隐私、夜间取消与API迁移见[守墓人契约](gravekeeper.md)。公开six/twelve_player_gravekeeper只含已验普通狼，不提前启用P6石像鬼。
