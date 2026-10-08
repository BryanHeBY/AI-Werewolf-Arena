# 运行提示、CLI与人格示例（P3）

## 语言输入与程序边界

后端命令共用`runtime/cli/display.ts`。每次调用持有独立CliDisplayContext；`--display-locale zh-CN|en`只选择终端说明，不写环境、配置或领域记录。run/config:check成功解析配置后，未指定展示语言则跟随game.displayLocale/locale；动作回放读到记录后跟随其locale。尚未读到配置/记录且未显式选择时缺省中文。

run_game还支持`--locale zh-CN|en`覆盖本次对局语言。它复制runtime.game再解析，原始配置/profile不修改；已配置的displayLocale或CLI显式展示语言仍独立。语言不合法时拒绝，不能用显示选择跳过游戏配置校验。程序化main仍reject原始错误，顶层runCli只持有终端报告/exitCode，不替runner拥有清理或聚合策略。

接入入口：run_game、config:check、config:migrate、simulate、replay:actions、run:mock、smoke，以及export:replay。迁移解析也在async边界内，参数错误不会越过安全catch。失败stderr是JSON：`code`、可选受限配置`path`、ErrorDiagnostic与指定语言`message`。固定code由封闭列表保留，包括录制格式/坏Tape错误；任意异常正文、namespace形状字符串或getter不会变成输出值。未知故障按安全诊断解释。

前端replay:dev使用`--display-locale`选择自身CLI失败说明；浏览器语言仍由文件hint/页面选择决定，Vite等外部工具输出不机器翻译。replay:render的`--locale`同时选择渲染与命令说明；默认读取到文件后跟随meta.locale，之前缺省中文。其失败JSON只保已知本地code和共享说明，不打印外部异常原文。程序化renderReplay仍保原错/资源聚合。

```bash
bun run --cwd backend config:check --configs-dir ../configs --display-locale en
bun run --cwd backend run:twelve --configs-dir ../configs --locale en --display-locale zh-CN
bun run --cwd backend config:migrate --configs-dir ../configs --display-locale en
bun run --cwd backend replay:actions --record ../record/session_<id>/reproduction.json --display-locale en
bun run --cwd frontend replay:dev -- --input ../record/session_<id> --display-locale en
```

英文执行已在实际SDK/ACP整局、机器结果对照与英文Tape复现门槛通过后开放。模拟命令也接受--locale选择World语言；--display-locale仍独立。

## 系统说明与原文

runtime开始/轮次/心跳/期限/终局、LLM提示/响应/轨迹/重试/回退、ACP消息/思考/工具生命周期均从共享game-text渲染。操作名、actor/phase/stage、工具名、状态、turn_id等机器标识保留；增加人类说明，终端行格式有明确变化。LLM prompt日志正确区分tool，陌生历史role/trace与ACP状态安全显示原ID，不因观察输出缺译令对局回退。

玩家名字、发言、模型消息/思考、工具原始参数与结果继续展示原文；ACP现有分段/空白整理及长度策略未改。展示文字不写回事件或提示历史。描述性role/tag不作为业务主键。

内置BaselineBot的普通发言、遗言与狼聊改为按World.locale生成；这是系统拥有的默认文字，自定义Scripted动作不翻译。目标选择、竞选、end_chat、药/查验/枪等决策不变。RoleProfile.baselineAction新增可选第五locale参数，旧四参数贡献仍有效。

## 配置与迁移告警

ResolvedGameSetup.warnings由旧组合字符串改为结构对象：

```json
{
  "code": "locale_prompt_fallback",
  "path": "players.3.personalityPrompt",
  "requestedLocale": "zh-CN",
  "fallbackLocale": "en"
}
```

config:check保留warnings机器数据，并增加warningMessages当前语言说明；人格原文不输出，实际回退选择保持。该程序化返回形状是显式API变化，旧字符串contains调用需改用code/字段查询。

迁移warnings原本就是稳定ID数组，保持原格式，另加warningMessages。五项MigrationWarningCode均有双语模板；report JSON及文字在任何备份/发布前构建，文字错误不能导致改盘后假失败。原竞争目标保护、回滚及多错误保留策略不变。

## 双语欢乐局示例

`configs.example/games/twelve_player_fun.json`提供标准十二人板子、12个固定名字和12种不同人格/策略偏好，使用既有`acp_default`占位profile；接入Codex/Claude/模型的command/env继续由用户本地provider配置负责，不内置认证或强制模型版本。

每个座位含zh-CN/en两版personalityPrompt，均明确欢乐局、争取胜利、公开发言有辨识度、工具/信息权限优先。包括绿茶、霸总、古风、概率nerd、mean姐、解说员、团建经理、小怂包、卷王、玄学段子手、反骨辩手与冷面摸鱼人；策略按座位区分。拿狼后的悍跳/苟住/反冲/借势等是个人偏好，不是新引擎规则。名字在两语言中仍是同一原始昵称。缺译为零，不依赖回退伪装完整英文人格。

本批验证实际CLI失败/配置成功/迁移preview和apply、陌生观察role、默认机器人动作对照及双语示例完整解析；英文runner/完整SDK与ACP对局、Tape英文重放已通过P3验收；后续角色/接入矩阵继续随P4–P10扩展。

## P4 M21：SDK / ACP 日志开关

两个传输沿用同一运行配置，开关只控制终端观察，不改变提示构建、动作接收、私有记录和资源回收。

| 开关 | SDK | ACP |
| --- | --- | --- |
| `printLlmIo` | 实际请求消息与原始模型响应 | 首次初始化系统提示、实际每轮提示与合并后的模型 message |
| `printThinking` | assistant 文字、工具调用及结果轨迹 | 合并后的 thought / message 与工具状态变化 |
| `trace` | 请求、排队、接受、恢复及安全失败诊断 | 同样的生命周期标记与安全失败诊断 |

两种详细开关同时关闭时，不显示提示、模型 message / thought 或工具轨迹；单独开启 IO 不显示 ACP thought 或工具状态。SDK 的 assistant 输出与 ACP message 同时属于 IO 和轨迹，因此任一相关开关开启即可显示。ACP IO 从流式观察器输出一次，逐 token 合并及工具状态去重保持；没有额外复制整份 response。`createAcpConsoleLogger` 三参数 API 仍沿用既有轨迹输出默认值，runner 明确传入本局两个 flags。

显示标签按独立 `displayLocale` 渲染，原提示、模型文本与参数保留原文。开启 `trace` 仍会显示已接受动作的 args，这是既有 SDK 语义；它不是无内容日志。配置认证/env不作为日志输入，失败仅输出安全诊断。日志属于本地运行观察，私有轮次保存也不受详细日志 flags 控制；不要把这些输出当作公开复盘。

实际本机 SDK HTTP 与 ACP/MCP 覆盖两个展示语言、全部四种详细开关组合，并检查动作及私有提示/动作摘要仍保存。日志同步回调在开始、系统/行动提示、接受、恢复和失败处触发 close 的回归，要求无迟到动作、私有晚写和剩余 session/turn。未调用外部模型或本地用户认证。
