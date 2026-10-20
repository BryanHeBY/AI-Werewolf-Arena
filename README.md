# AI Werewolf Arena

多智能体狼人杀对局引擎与本地工作台。通过网页配置板子、Agent 和游戏，管理独立对局进程、查看 ANSI 日志并打开复盘。支持 LLM、Pi 和 ACP 玩家混合对局，按玩家权限投影信息，并提供中文与英文提示和展示。离线视频制作保留独立入口。

## 快速开始

使用根 `package.json` 声明的 Bun 版本安装依赖。仅在首次创建本地配置时复制模板；已有 `configs/` 时按需合并条目。

```bash
bun install
bun run workbench
# 打开 http://127.0.0.1:4310；已有配置原地保留，首次可在页面补充缺失模板。

# 也可继续使用独立 CLI。先在工作台补充缺失模板并配置认证：
# 在 configs/runtime/backends.json 中配置自己的认证。

# 脱敏检查，不调用模型
bun run config:check -- --configs-dir ./configs --game-config-name twelve_player_standard

# 使用本地配置启动真实 Agent 对局
bun run run:six
bun run run:twelve

# 启动离线复盘工作台，加载 record/<session>/replay.json
bun run dev:frontend
```

默认模板使用 OpenRouter 的 DeepSeek V4 Flash。Pi 多模型、ACP 隔离、本地配置迁移和完整命令见下方指南；运行真实 Agent 会使用所配置的网络服务或本地进程。

## 文档入口

| 需要了解的内容                       | 入口                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 文档分类与维护约定                   | [项目文档](docs/README.md)                                                                     |
| 本地运行、配置迁移与检查             | [运行指南](docs/guides/run-locally.md)                                                         |
| 网页配置、运行管理与终端日志         | [工作台指南](docs/guides/workbench.md)                                                         |
| 配置字段、玩家名字、人设与混合 Agent | [配置契约](docs/contracts/configuration.md)                                                    |
| Pi 模型、认证与内存会话              | [Pi 接入指南](docs/guides/pi-agent.md)                                                         |
| ACP 文件与环境隔离                   | [隔离启动器](configs.example/acp/README.md)                                                    |
| 角色规则与可配置变体                 | [规则卡](docs/rules/README.md)                                                                 |
| 板子与游戏示例                       | [公开入口](docs/examples/README.md)、[角色支持矩阵](docs/contracts/gameplay-support-matrix.md) |
| 模块职责、状态与资源所有权           | [架构说明](docs/architecture/README.md)                                                        |
| 回放、玩家私有输出与视频             | [离线复盘指南](docs/guides/offline-replay.md)、[前端说明](apps/replay/README.md)               |
| 视频作者目录、配音、配乐与成片制作   | [制作指南](docs/guides/video-production.md)、[离线语音与字幕](docs/guides/offline-speech.md)   |
| 测试与功能交付                       | [验证方法](docs/guides/validation.md)、[新增机制](docs/guides/add-mechanism.md)                |
| 凭据、个人路径与归档发布             | [仓库隐私维护](docs/guides/repository-hygiene.md)                                              |

## 工作区组织

- `apps/workbench/`：本地 HTTP 服务、配置向导、对局进程管理、终端与回放入口。
- `apps/game/`：独立对局、配置检查、模拟与复现 CLI，拥有进程参数和退出行为。
- `apps/replay/`：独立复盘网页、Vite 配置与文件加载入口。
- `apps/video/`：离线视频／语音制作命令、浏览器预览和作者项目。
- `packages/game-runtime/`：对局引擎、角色机制、Agent 调度、配置用例、录制与运行生命周期。
- `packages/game-media/`：复盘组件、共享帧渲染、主题、字体和展示素材；工作台和两个媒体应用共同消费。
- `packages/project-paths/`：统一项目默认数据根、入口路径和声明文件路径。
- 其它 `packages/`：共享游戏契约、角色资料、中文／英文文案、展示和复盘格式。
- `configs.example/`：可提交的 backend、Agent、board 与 game 模板。
- `docs/`：现行规则、契约、架构、示例、指南与设计决策。
- `tooling/`：架构与冻结夹具检查。

本地 `configs/`、认证、模型输出和 `record/` 不纳入版本控制。God 回放、逐玩家私有档案和严格复现 Tape 的用途不同；God 全知信息不因工作台筛选席位而成为玩家视角。运行中可查看只读 ANSI 终端，结构化在线观战和多租户服务属于后续范围。

## 独立前后端入口与路径

```bash
# 统一工作台：生产客户端 + 本地 API
bun run workbench -- --host 127.0.0.1 --port 4310
# 单独运行游戏后端
bun run run -- --game-config-name twelve_player_standard
# 单独运行复盘前端；可在页面导入归档
bun run dev:frontend
# 从仓库根加载指定对局（显式路径相对当前调用目录）
bun run replay:dev -- --input ./record/<session>/replay.json
# 前端构建与预览
bun run build:frontend
bun run --cwd apps/replay preview
# 独立应用命令也可直接使用；此时相对参数以 apps/game 为基准
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_standard
```

缺省 `configs/record/output/.workbench` 始终属于仓库根；显式 CLI 相对路径按命令入口的当前目录，配置文件内的文件引用按声明文件目录。Vite 与子进程在各自应用目录运行，接收已经解析的绝对路径。运行参数不会因为工具切换目录而改变含义。迁移保留原 `configs/record/output` 内容，旧 `backend/frontend` 下的忽略产物不自动清除。

工作台、LLM／Pi、独立对局与复盘入口使用跨平台 Bun／Node API；Windows 不需要 Bash 来启动这些命令。ACP 的 `bwrap` 文件隔离是 Linux 专属能力，Windows 接入 ACP 需自行提供受支持的适配器与隔离方式。浏览器测试另需 Node.js 和匹配版本的 Playwright Chromium。

## 开发与验证

日常开发在 `main` 上进行，按完整功能提交。先执行受影响模块的定向检查；共享契约、资源时序或跨机制改动再补相关完整局与严格复现。集中门禁见[验证指南](docs/guides/validation.md)。

```bash
bun run check          # 类型、架构和冻结夹具
bun run lint           # 依赖边界、双语与前端规范
bun run format:check   # 格式
bun run test           # 离线测试，包含本机合成 HTTP／MCP 通路
```

角色和板子的实际可用范围由配置校验、规则组合与运行实现共同决定。来源资料登记、示例入口或一次验收不代表支持任意混搭；具体边界见[机制支持契约](docs/contracts/mechanism-support-boundaries.md)。
