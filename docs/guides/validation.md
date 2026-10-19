# 验证方法

## 按改动运行检查

先运行改动所属模块的测试及类型检查。跨机制、共享契约或资源时序变化，再补受影响的交互、完整对局和严格复现场景。多个大阶段结束后运行完整门禁；不要求每个小改动重复所有对局。

```bash
bun run lint:architecture
bun run check:fixtures
bun run check:tooling
bun run test:tooling
bun run check:packages
bun run test:packages
bun run --cwd backend test:unit
bun run --cwd backend test:integration
bun run --cwd backend test:scenarios
bun --no-env-file test --preload ./backend/tests/setup.ts ./backend/tests/architecture
bun run --cwd frontend test
```

整体检查使用 `bun run check`、`bun run lint` 和 `bun run format:check`；完整测试入口为 `bun run test`。不要把根聚合任务及其子任务重复计作不同验收。

## 编辑器类型检查

后端按 Bun 的 `preserve`／`bundler` 模式解析和生成模块，显式加载 Node 与 Bun 类型。
后端及共享包的测试目录、后端脚本目录各有标准名称的 `tsconfig.json`，继承对应的
`tsconfig.tests.json`，让 VS Code 自动发现的项目与命令行检查使用相同的类型和文件范围。
不要仅在自定义名称的配置中添加测试类型，编辑器不会自动选择该配置。

调整配置后若 VS Code 仍显示旧诊断，运行 `TypeScript: Restart TS Server`。
仓库的 TypeScript 版本由各工作区依赖管理；可用 `TypeScript: Select TypeScript Version`
选择工作区版本。配置同时兼容 TypeScript 5.9 与 6，不通过 `ignoreDeprecations` 隐藏弃用项。

## GitHub CI 分层

日常本地仍优先运行受影响模块；完整回归交给 GitHub Actions，不必为每次功能提交重复等待全部场景。
所有 runner 都使用根 `package.json` 的精确 Bun 版本，通过 `bun install --frozen-lockfile` 安装。

快速门禁的 `quality`／`shared` 两组检出完整 Git 历史（`fetch-depth: 0`），用于核对冻结夹具及源码迁移的原始提交字节。其余组只需当前提交，保留浅克隆；不能通过跳过旧提交核验或修改冻结来源来适配浅克隆。

- `CI fast`：PR、main 推送和手动触发。四个独立 runner 分别执行类型／架构／夹具／lint／格式，工具及共享包测试和后端构建，后端单元／架构／集成测试，前端测试和生产构建。
- `Regression full`：main 推送、`v*` 标签、北京时间 03:23 的夜间任务及手动触发；PR 修改后端、共享包、前端、公开配置或 CI 时也执行。后端八片、浏览器四片，每个 runner 内保持串行，避免控制端口与测试状态争用。夜间、手动及标签入口复用 `CI fast`，补齐同一套快速检查；main／PR 已有独立快速任务，避免重复执行。
- 同一工作流在同一分支出现更新时取消旧任务；不同片的失败不取消其他片，保留完整诊断。浏览器沿用现有两次重试政策，报告保留首次失败和重试轨迹；后端不自动重试。

浏览器以独立 page 测试为分片单位（`--fully-parallel`），但每片固定 `--workers=1`，实际仍串行执行。这样较大的单文件不会独占一片或造成空片；若以后添加跨测试共享状态的串行组，必须重新检查分片覆盖和隔离。

快速检查也可在本地按组复现：

```bash
bun run ci:fast quality
bun run ci:fast shared
bun run ci:fast backend
bun run ci:fast frontend
```

后端使用 Bun 原生 `--shard` 和 `--timings`。`tooling/ci/backend-test-timings.json` 来自 2026-10-17 本地完整回归的 922 个文件，仅用于分配耗时，不决定测试发现范围；新增测试会自动进入分片。八片都读取同一份提交中的种子，各自复制到 `ci-artifacts/` 后通过 `--update-timings` 写回当前片测量值。不能分别恢复各片耗时缓存后再分配，否则不同输入可能造成漏跑或重跑。后续可从同一次完整运行的八份 artifact 合并 `files`，复核后更新种子；不要混用不同提交／Bun 版本的测量。耗时包含机器与负载差异，不作为性能验收承诺。

Actions 页面可分别手动运行两个工作流并选择分支。每个产物都包含实际提交、Bun 版本及 revision、源码／锁文件指纹；快速日志保留 7 天，完整回归的 JUnit、分片日志、耗时及浏览器 HTML／trace／截图保留 14 天。失败时额外上传该 runner 独占临时目录中尚存的离线记录；成功临时记录仍遵循原测试清理政策。临时目录使用短路径，依赖缓存只存下载内容，不恢复源码、运行记录或个人配置。

CI 不配置模型密钥、不调用真实付费模型；自动浏览器检查不能替代美术变更后的真实图片人工交叉审查。工作流只读仓库，不自动提交或推送任何变更。

## 全公开板阶段批次

```bash
# 默认每个公开board中英各一局；两worker独立装配World、RNG、locale和录制。
bun --no-env-file test ./backend/tests/scenarios/release/expansion-matrix.test.ts
# 大阶段或发布候选集中执行总计1000局，每局均严格重放；不调用模型。
AWA_EXPANSION_BATCH_COUNT=1000 bun --no-env-file test ./backend/tests/scenarios/release/expansion-matrix.test.ts
```

批次会打印`receipt.json`位置及源码身份、分支、自然终局、回退、逐局strict及实际日次／行动数统计。`longest`按行动数选出已解析归档见证，并保留其完整内容；全局最大日次取各行`maxDay`，不是`maxDays`配置上限。仅删除已经完整验证的独占子目录，失败原档与回执保留，不纳入通用afterEach清理器。需要较多空间时将`TMPDIR`显式指向操作者选定的独立测试目录；不能删别人的缓存来凑空间。精确角色交互仍以人工判例和真实协议路线为准。

验收副本须先初始化其独立Git目录，再应用未提交补丁，并在启动前比较实际源码与锁文件指纹；不能把父仓库内被`git apply`跳过补丁的副本计作当前构建。复制只包含公开源码、示例和明确依赖，保留本地认证与运行配置边界。

## 检查约束

- 架构门禁直接检查当前依赖、命名和职责注释，任何违规都失败，不读取旧提交或历史债务豁免。
- 夹具校验保留原始归档字节、稳定 suite 身份和真实导入约束。`tooling/refactor/fixtures/source-inventory.json` 是仍在使用的来源登记，清单中的旧路径只表示来源身份。
- 规则测试使用独立手写预期或明确冻结样本，不调用生产规则计算答案。
- 分别验证选择、准入、领域提交、付款、已付效果、告知与失败前缀；成功路径不能替代取消、迟到、别名失配或部分失败测试。
- 中文与英文核对消息 key、占位符、原始用户文本及玩家可见性；展示修改还需覆盖回退、时间、席位和逐帧投影。
- 测试和类型检查只使用公开配置与隔离的临时目录，不读取个人认证，不调用付费模型。真实 Agent 对局由操作者显式运行。

## 浏览器与媒体

```bash
bun run --cwd frontend test:e2e
bun run build:backend
bun run build:frontend
```

浏览器和渲染使用已安装的 Chromium；需要时通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定。隔离的 `TMPDIR` 使用短路径，避免 Chromium 的 Unix socket 超出路径长度限制。

媒体检查按实际输出语言运行，读取 PNG／MP4 的尺寸、帧率和时长，并人工查看图片及视频关键帧。文件存在或命令退出为零不等于画面正确；样本通过也不代表所有角色或组合都被验证。

真实付费模型另按[真实模型评测流程](release-evaluation.md)处理；未授权运行不得计作通过。

## 结果记录

长批次采用互斥的文件清单，保留各批日志、构建身份和退出码。外层调度中断时，只接受已确认完成清理的完整文件，其余文件从头续跑；最终核清原集合与续跑集合的并集、交集及skip，部分文件的已通过项不重计，原中断码仍如实保留。

在提交或 CI 中记录实际运行命令、失败、跳过原因和支持范围。重试保留首次失败原因，不叠加重复用例。旧记录的可读性与严格同构建复现分别按[归档兼容契约](../contracts/archive-compatibility.md)验证，不修改旧指纹求通过。
