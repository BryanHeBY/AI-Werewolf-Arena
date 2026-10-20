# 模块与依赖的实际归属

## 目录表达已存在的职责

`apps/workbench` 拥有本机服务、原始配置编辑、进程管理与网页工作流；运行、录制和复盘仍调用原唯一所有者，详见[工作台架构](workbench.md)。共享工作台 JSON DTO 归 `packages/workbench-contract`，不得携带认证或控制令牌到公开列表。

| 位置                               | 拥有                                                   | 不拥有                                                |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| `apps/workbench/src/client`        | 原始配置草稿、页面导航、ANSI 终端和复盘接入            | 认证解析、服务端配置读取、运行控制令牌                |
| `apps/workbench/src/server`        | 本机 HTTP 用例、文件编辑协议、启动登记与运行发现       | 游戏规则、World、终档写入或第二套配置解析器           |
| `packages/game-runtime/src/app`    | 配置入口、装配、运行用例、会话生命周期                 | 角色规则或第二份状态                                  |
| `domain`                           | World／组件、原体引用、运行许可与明确提交数据          | UI、Agent、具体机制算法                               |
| `engine`                           | 阶段推进、动作接收、死亡波次、必要检查点和唯一终局提交 | 根据角色 ID 重写族内规则                              |
| `features/<feature>`               | 一个或多个角色的完整状态、请求、生命周期、效果与贡献   | 另建 World 或全角色分派器                             |
| `rulesets`                         | 有限组合、顺序、政策、闭包与真实装配                   | 另一份档案验证算法                                    |
| `agents`                           | 受限观察、提示、候选决策、回合协调                     | 真身份／完整God状态的隐式读取                         |
| `recording/session`                | 一局记录、刷盘、关闭和聚合                             | 领域付款、胜负重算                                    |
| `recording/reproduction`           | 严格格式、Trace、纯 checkpoint 格式／审计及来源身份    | 直接读取 World 的现场捕获装配、用公开回放替代精确执行 |
| `app/checkpoint`                   | 现场 World／机制查询的五个 checkpoint 捕获与装配 owner | 重新推导规则、拥有第二份状态、承担独立归档校验        |
| `recording/verification/<feature>` | 独立档案算术及因果校验                                 | 导入生产结算作oracle                                  |
| `adapters`                         | LLM、Pi、ACP、文件系统、终端的外部边界                 | 更改领域授权或恢复关闭的回合                          |
| `packages`                         | 明确的纯数据、语言、展示、目录与归档公共契约           | 反向导入应用实现；纯契约包不得读取 runtime owner      |
| `packages/game-media/src`          | 视频与语音契约、纯时间线编译、共用画面与字幕           | 读取本局作者文件、凭据或调用TTS                       |
| `apps/video/scripts`               | 本地文件读取、作者项目装配、素材准备与渲染命令         | 写死某局台词、选角或剧情，静态依赖具体对局            |
| `apps/video/examples`              | 基于教学夹具的可运行演示、通用音色试听                 | 正式对局剧本、生产运行算法                            |
| `apps/video/videos/<theme>`        | 本局完整剧本、固定选角、来源配置和制作记录             | 通用读取、合成、时间线或渲染实现                      |

这不是允许所有同层互导的名单。跨族只消费实际公开端口；私有 state／frame／authority 的形状相似不等于共同不变量。

Pi 的模型／认证内存状态和会话句柄由 `adapters/pi` 持有；逐玩家游标、调度租约和行动选择窗口由 `agents/pi` 持有。两者不提交领域动作。完整对话与压缩摘要由原生 Pi 会话独占；AWA 的逐轮录制只追加实际输入、思考、回应和工具回执。审计创建独立会话，不复用玩家历史。

`apps/game` 只拥有命令参数、进程信号和退出码，配置检查用例与 runner 实际实现归 `packages/game-runtime`；`apps/replay` 只拥有浏览器宿主、Vite 与输入入口。二者均不制造第二份引擎或投影。

## 单一运行模块与公开面

World、枚举、class、WeakMap、默认 Catalog 和 RequestDelivery 都必须只有一个物理所有者。移动源码后不能保留旧实现副本；兼容 package key 若保留，只能指同一物理叶，不能制造第二份状态。根出口只保约定名字、类型与原条款顺序，不能用 star 让额外内部声明成为公共 API。

普通夜能力整体在 `features/night-abilities`；死亡枪整体在 `features/death-actions`。严格 `domain/original-player-scope.ts` 与较宽 `domain/original-participant.ts` 保独立接受规则，不能只因名字相近合并。

Catalog／contracts／assembly／builtin 同在 `rulesets/roles`，保原 lazy require 和默认实例。其真实 Catalog→observation late binding 是已知存在的边，不因改目录便宣称中立或结构完美；若新结构检查指出具体问题，再单独修真实 owner，不搭转发壳。

## 依赖检查

检查器必须识别 engine／features／agents／recording/verification 的真实位置，保原禁止依赖，不能让旧 game 目录退休后检查空跑。旧 synthetic 输入和历史路径仍有明确测试作用。旧 deep import 退休、模块名／缓存／堆栈及 sourceHash 改变应明示；不承诺未知外部消费者无影响。

应用源码同样进入结构与 i18n 检查。工作台浏览器不能导入本应用 `src/server`、game-runtime 实现或 Node／Bun 运行时，类型导入、包公开出口和路径别名也遵守此边界；共享 DTO、词典和 game-media 的明确公开入口可用。服务端通过 game-runtime 的实际公开配置端口装配，不能把解析结果转存成另一套配置。

## 现场 checkpoint 的实际归属

现场 World 和机制状态的捕获由 `app/checkpoint` 拥有，实际入口如下：

| 完整 owner               | 当前落点                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `contributions.ts`       | [`packages/game-runtime/src/app/checkpoint/contributions.ts`](../../packages/game-runtime/src/app/checkpoint/contributions.ts)             |
| `authority-snapshots.ts` | [`packages/game-runtime/src/app/checkpoint/authority-snapshots.ts`](../../packages/game-runtime/src/app/checkpoint/authority-snapshots.ts) |
| `identity-setups.ts`     | [`packages/game-runtime/src/app/checkpoint/identity-setups.ts`](../../packages/game-runtime/src/app/checkpoint/identity-setups.ts)         |
| `player-snapshots.ts`    | [`packages/game-runtime/src/app/checkpoint/player-snapshots.ts`](../../packages/game-runtime/src/app/checkpoint/player-snapshots.ts)       |
| `private-state-codec.ts` | [`packages/game-runtime/src/app/checkpoint/private-state-codec.ts`](../../packages/game-runtime/src/app/checkpoint/private-state-codec.ts) |

纯 animal-format、player-format、animal-audit、noble-body-format、fragrant-pair-format 五叶仍在 `recording/reproduction/checkpoint`，独立 verifier 仍在录制校验层。现场读取与纯格式的职责已分开；纯格式模块不反向取得现场状态写权。

## Agent 输出、录制与双端展示

LLM、ACP、Pi 使用 `replay-contract/agent-output.ts` 的私有输出契约。文本、工具状态、请求、失败诊断和回退分别有明确类型；输出上下文携带传输与已知玩家／阶段信息。输出对象不包含运行句柄或行动许可，交给外部消费者前脱离原动作参数引用。

- `adapters/acp/acp-output.ts`、`adapters/pi/pi-output.ts` 转换原生增量并拥有各自缓冲；`agents/player/player-observer.ts` 将 SDK 编排事实转换为共同输出。
- `app/game-runner.ts` 装配唯一终端 sink，工厂向三种玩家实现注入同一出口；直接使用 provider 的旧 API 仍有默认终端适配。原 ACP 日志函数仅保留公开接线入口。
- `adapters/console/agent-console-presenter.ts` 独占终端格式、ANSI 和简洁工具日志。Agent 不直接打印模型原文。
- `game-presentation/agent-output.ts` 拥有双语分类、显示开关和语义色调，供终端和 Web 共用；它不处理 ANSI、DOM、会话或文件。
- 录制器沿共同契约编码现有玩家 `delta_messages`（工具状态使用新增可选元数据）；Web 显式导入私有玩家档案后，用相同分类还原。录制完成并不表示工具候选已在领域生效。

这是显式函数接线，没有全局事件总线。领域游戏事件继续走原投影与事件录制链；Agent 私有输出不变成公开游戏事件。私有文件查看状态不参与 Remotion 帧或游戏时间线计算。

## 离线配音制作

配音身份归 `packages/game-media/src/speech-identity.ts`，停顿与增量时钟归 `speech-clock.ts`，JSONL与画面绑定归 `speech-script.ts`，字词对齐与字幕断句归 `speech-timing.ts`。它们只消费数据，不读取凭据、素材或访问服务商。作者JSONL拥有口播，完整TS稿拥有视觉编排；正文来源与展示版式分开。

`scripts/prepare-video.ts` 分开项目加载、计划编译和素材准备，`scripts/video/authoring.ts` 的项目工厂只声明编排。`tts/chunk-cache.ts` 拥有独立合成段缓存，`tts/prepare.ts` 拥有整行装配缓存与清单发布。详细对齐放JSON附属文件，TS保留类型化索引和来源摘要。`scripts/video/publication.ts` 拥有候选版本目录的校验后发布，`render-production-video.ts` 拥有可恢复分段与连续音轨封装。预览、检查和渲染不隐式生成语音。

`scripts/video/production.ts` 拥有主题作者目录与本机产物的路径约定；`casting.ts` 只装配显式席位音色，不按身份重新随机。生成语音清单、对齐JSON和原生快照归忽略的 `output/videos/<theme>/`，不进入作者目录。`scripts/produce-video.ts` 串接可单独运行的本地阶段；审片HTTP、音源准备和成片验收是通用工具，不再保存在output的特定两局脚本中。目录及命令见[视频制作指南](../guides/video-production.md)。
