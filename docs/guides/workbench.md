# 本地工作台

工作台把配置、对局运行、ANSI 日志和已有复盘放在同一个本机页面，继续使用 `configs/` 与 `record/` 文件。

当前初版仍待完成已有配置列表与新建／查看／编辑的分离、从已保存游戏快速启动，以及游戏配置／板子／对局记录删除。目标行为和验收条件见[初版优先待办](../architecture/workbench.md#初版优先待办配置管理快速启动与删除)；下述内容说明当前可用入口。

外观复用视频与网页已有的哥特／简约主题、授权字体、语义色板和哥特素材。首次默认采用视频的哥特主题及夜间色调；已有网页主题偏好继续保留。侧栏可切换主题与明暗，回放页共享同一外观控制器，终端采用相同主题的夜间色板。

## 启动

```bash
bun install
bun run workbench
# 打开 http://127.0.0.1:4310
```

根命令先构建客户端，再启动本地服务。已有 `configs/`、`record/`、`output/` 都保留。首次没有配置时，在页面点击“补充缺失的示例配置”；该操作只复制不存在的 JSON，不覆盖已有文件。随后配置自己的服务平台认证。

```bash
bun run workbench -- --configs-dir ./my-configs --record-root-dir ./my-records --port 4311
```

默认端口 `4310` 被占用时，入口会显示明确提示并退出。可以打开已经启动的工作台，或使用 `bun run workbench -- --port 0` 让系统选择空闲端口，按终端打印的地址访问。也可以通过 `--port 4311` 固定其他端口。CLI 提示语言可由 `--display-locale en` 切换；Vite 开发代理仍指向 API 的 `4310` 端口。

监听主机通过 `--host` 配置，缺省为 `127.0.0.1`；支持 IPv4、IPv6 和可解析的主机名。例如：

```bash
bun run workbench -- --host 0.0.0.0 --port 0
# 局域网客户端使用这台机器的实际 IP 和终端打印的端口访问。
```

`0.0.0.0`／`::` 是监听通配地址。工作台包含配置编辑、认证读取和对局启动能力，当前没有用户登录体系；网络绑定应限于受信任网络。请求 Host 白名单与同源写入检查继续生效。

目录参数相对于根命令的当前工作目录；默认指向仓库的 `configs/` 和 `record/`。工作台启动登记放在忽略的 `.workbench/runs/`，可通过 `--state-dir` 改变这个私有状态根，不作为游戏录制或公开发布材料。开发时同时使用 API 与 Vite，浏览器打开 Vite 的 5174 端口。

公共入口遵循[统一路径解析要求](../architecture/workbench.md#wb-path-01统一路径解析)：显式相对参数按调用目录，缺省数据目录按项目根，配置内相对文件引用按配置所在目录；内部切换工具运行目录不改变这些含义。

## 配置一局

1. 在“板子”中按人数、角色搜索；相同角色组成的规则版本放在同一张卡片。
2. 选择板子后阅读角色组成，以自然语言选择女巫自救、警长、骑士决斗、自爆窗口等规则。其它机制参数可在 JSON 中编辑；实际支持由 backend 校验器决定。
3. 在“Agent”中选择平台，输入模型、认证与思考等级。可以复用已有连接；新建时分别追加 backends 与 agents 条目。
4. 在“游戏配置”中选择默认 Agent，可给角色或座位覆盖 Agent、名字与自定义指令。游戏机制仍归板子，不因 prompt 改变规则。
5. 检查并保存，再开始对局。未保存的草稿不能直接启动。

表单与源码编辑同一份原始 JSON，未显示的原生字段保持原值。名字缺省时仍只显示编号。附加指令沿用 Agent → 本局 → 角色 → 座位的 append／replace／clear 规则。

认证默认显示保留标记；未改标记保存时恢复同版本原值。校验与运行通过既有解析器在临时对象中读取环境，保存时 `${ENV_NAME}` 保持原占位符。明确显示密钥仅用于本机编辑；目录、运行列表和模型目录不返回认证。Codex 订阅按钮在服务端读取固定的 `~/.codex/auth.json`，不向浏览器返回令牌。

新增连接与 Agent 是两份独立文件。如果后续保存失败，已经创建的连接保留，可通过 JSON 编辑继续修正或复用。外部编辑导致摘要冲突时，保存拒绝且当前草稿保留；重新读取后合并。该协议不锁住任意外部编辑器。

### Pi 内置平台与认证

Pi 的内置 OpenAI、Anthropic、智谱和 Kimi 平台自带 API 类型、默认地址与模型目录；界面的灰色地址是缺省提示，不会自动写成覆盖配置。仅在使用代理、自建网关或确实要改变连接地址时填写 `baseUrl`，此时才写入原生 `models.providers`。模型与思考等级保存在 Agent options；同类连接可复用，不能把不同平台或认证模式误认为同一个连接。

API Key 与订阅 OAuth 分别选择：Codex 订阅显式从本机 Codex 认证导入，API Key 可直接填写或保留环境占位符。原生字段及多平台目录语义以 [Pi models.json 官方说明](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md)为准；AWA 保持 Pi 原生配置对象，在内存中使用会话，不启用默认文件读写工具。

## 运行与回放

每局使用独立 CLI 进程。终端页是只读 ANSI 输出，没有交互式 shell。刷新页面会补读本局日志。进程退出、对局是否打完、核心录制是否发布分别显示。“核心录制完整”表示 manifest、replay 及启用时的 reproduction 已发布；可选玩家档案／摘要与严格复现验证各有独立结果。

“停止并保存”通过本局私有控制端口取消行动，关闭 Agent 后保存已有记录。关闭工作台服务不会主动停止已经启动的游戏。外部终端启动的新 CLI 也会在相同 record 根登记、保存日志并被工作台发现；历史无登记的记录显示为历史录制，不伪造活性或完整性证明。

停止授权当前使用 Linux `/proc` 的进程启动身份及启动系统 ID；无法确认实例身份时保持 lost／interrupted 状态，不仅凭 PID 提供停止操作。

已有 replay 文件的对局可打开现有复盘界面，格式问题由播放器显示。God 回放仍为全知数据；切换席位不授予私有档案或改变事件可见性。私有玩家档案仍通过原播放器的显式导入操作读取。

## 独立入口与平台

```bash
# 仓库根：独立后端对局
bun run run -- --game-config-name twelve_player_standard
# 仓库根：独立复盘页面
bun run dev:frontend
bun run replay:dev -- --input ./record/<session>/replay.json
# 独立应用目录命令；路径以 apps/game 为调用目录
bun run --cwd apps/game config:check --configs-dir ../../configs --game-config-name twelve_player_standard
```

本地工作台、Pi／LLM 对局和复盘使用跨平台 Bun API。浏览器测试另用 Node.js 启动官方 Playwright CLI，避免 Bun 执行器差异。Linux 的 `bwrap` ACP 隔离脚本不适用于 Windows；不因工作台能在 Windows 启动就宣称该脚本具有 Windows 隔离能力。

## 开发与验证

```bash
bun run dev:workbench          # API，默认 4310
bun run dev:workbench-client   # Vite，默认 5174，代理到 4310
bun run check:workbench
bun run test:workbench         # 独立临时配置和合成 localhost 模型
bun run build:workbench
bun run --cwd apps/workbench test:e2e
```

浏览器测试需要与锁文件版本匹配的 Chromium，可先运行 `bun --cwd apps/workbench ./node_modules/@playwright/test/cli.js install chromium`；也可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向本机可执行文件。测试不调用真实模型、订阅认证或个人配置。
