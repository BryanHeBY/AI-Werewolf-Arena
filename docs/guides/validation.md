# 验证与证据范围

## 固定输入优先

先声明实际Git、唯一source范围、互斥owner、旧全文／新absence、controls与依赖阶段。检查记录命令、cwd、输入SHA、原stdout、真实退出和executor；空输出或进程启动不证明通过。首次工具错误、配置错误和产品错误分别保留。

纯注释证据按该次实际范围登记：整组的非注释 AST／NodeArray／叶、JSDoc 类型／指令与双模块输出，和小修的 token／非注释程序及实际输出证明分别陈述；不能把窄证明说成全树或双模块，也不因注释重复业务／类型绿。维护说明逐步使用中文，重要数据结构须说明事实／资源归属与可变性，重要逻辑须说明许可、付款／提交、取消／结束和异常的实际边界；不堆占位头，不改许可证、工具指令、JSDoc 类型／tag、机器 ID、错误码或用户原文。物理路径用完整program正逆、原目标binding／初始化顺序、活跃元路径和集中类型。行为政策先真实characterization，另写有业务区分力的独立字面预期；不能把新结果冒称原等价。

## 当前根命令

```bash
bun --no-env-file run check
bun --no-env-file run lint
bun --no-env-file run format:check
bun --no-env-file run test
```

这些是日常维护聚合入口。根脚本仍会调用各 workspace 子脚本，准确范围以当前 package.json／实际命令收据为准。最终 C47 将所需覆盖展开为 42 个原子命令；不再重跑这些聚合命令来重复累计绿色。命令存在不代表验收已经完成，覆盖范围以实际收据为准。

C43 实际归档后，`check` 先运行原 strict 结构入口，再运行一次 `check:history`，随后保持 fixture／tooling／packages／backend／frontend 原顺序。只检查历史时可独立用 `bun --no-env-file run check:history`；完整 `check` 已包含它，同一次完整验收不再额外重复 aggregate 或 guard 来累加绿色。

持久 owner 是 `tooling/refactor/history-integrity.py`。它要求 `--repo`、Root 已明确指定的实际 C43 捕获提交 `14e7951787f4464573407a7bcc270303a3975856` 和 `docs/history/origin-paths.json`；根脚本必须写入这一个完整提交 SHA，不使用 HEAD、猜测值或旧观察的总数。该工具的中文 docstring 同时显示为命令行帮助；这只是维护工具帮助，不改游戏协议。

守卫从原 Git 独立核完整成员、blob、字节与 Git executable 位，拒绝两棵旧根残留、新增未捕获文件、归档成员增删、内容／模式变化和符号链接绕路。`docs/history/expansion/README.md` 与 `docs/history/refactor/README.md` 是保留的当前导航页，继续正常格式检查；不把历史守卫当链接检查、当前算法证明或最终 C47。两个历史根冻结后不再追加新证据。

## 当前登记与后继证据

当前进度统一维护在[交付状态](../architecture/delivery-status.md)；职责证据从[覆盖摘要](../architecture/mechanism-coverage-summary.md)、[行索引](../architecture/row-index.md)进入[完整矩阵](../architecture/migration-matrix.json)，适用声明见[机制支持边界](../contracts/mechanism-support-boundaries.md)。91×10 共 910 个位置，843 个适用位置与 67 个业务性 N/A 是职责分类，不是用例或通过数量。没有真实同源验收时不补空壳或推测完成数；旧台账和原 pending 保留为历史来源，不继续写入旧 `docs/refactor`。

新验收证据按职责切片保存为 `docs/history/acceptance/<切片名>.tar.gz`，不写两棵既有历史根。小 JSON／MD 先按当前正常规则完成格式化，再固定原字节、SHA 和 scope／收据后封包。封存包作为不透明原字节保存，不解包重排来消格式错误，也不因未知扩展名而推断已核验。这个路径不新增 Prettier 豁免；当前源码、测试、JSON／MD 和导航仍参加原检查。

历史守卫不审核 acceptance 包；包的 SHA、成员清单与 scope／真实执行收据由该次非作者审查和提交材料另行绑定。下游临时 stager／reviewer 应从新的 acceptance 包及 current 登记读取材料，不保留旧目录回退或兼容壳；历史 origin 路径仅用来源索引定位，不成为新的写入入口。

分层定向时从unit／integration／scenarios／architecture选择真实主目标；runner发现不能因改路径、排除文件或alias而丢测试。真实SDK假HTTP、stdio MCP／ACP、CLI、filesystem和浏览器是不同层，不能由mock单元代替。

## 最后合流

最终固定同一候选输入，按完整计划完成：结构零债／命名／职责中文与内容审查、全生产／测试／脚本／包／tooling类型、fixture原字节与binding、全部发现和所需离线单元／整局／失败／本机通信、双语浏览器、中英 PNG 及英文 MP4及严格兼容矩阵。不得把该列表当每个微提交都重复全套的指令。

首红按具体原因修，限定失败／真实变化根再查；保持旧绿原采样，不伪称末source同输入重绿。统计不同declaration、fixture invocation、expect执行和filtered分别列，不累加重复为不同用例。

## 本轮最终验收登记

固定受测源码是 `60fdbfbc57122eeb1d4e9204b66d4daec1eb0157`，公开快照 manifest 为 `08cb4b2ba9640566b28b9610ea22c1602d40eee811c47be282128ca8618b591e`。最终材料发布到[refactor-final-acceptance](../history/acceptance/refactor-final-acceptance.md)；后继 C48 文档／矩阵的元数据提交单列，不能用新 HEAD 倒称全部检查受测。

最终执行登记：受测源码 `60fdbfbc57122eeb1d4e9204b66d4daec1eb0157` 的 42 个命令 ID 均有实际成功终态，共 43 次尝试；Chromium 首次环境失败、短 TMPDIR 的显式重试及场景唯一条件 skip 均保留，不合并重复用例计数。原始统计、来源首末检查、媒体回读和三方面独审见最终验收四件套。

最终 42 项保持原发现范围：14 个类型项目；严格架构／历史与 fixture、lint／format；tooling 与五包、后端四互斥测试目录及前端三目录；两次 build 与 smoke；最后完整 Chromium e2e 和三媒体。37 项同输入 attempt-1 成功后，tooling 独占运行；其后串行浏览器及三媒体，不将旧轮绿色拼入本轮。后端完整 scenarios 的 14400 秒是新资源预算，不代表旧超时已通过。

媒体范围是中文／英文 frame 0 PNG 各一张及英文 H264 MP4 一份，均来自同一真实两玩家、两事件 fixture；不是完整六人／十二人整局或三个视频。180 帧／30fps 预计 6 秒，最终仍核实际 composition、媒体元数据及真实画面。frame 0 字幕透明属于原淡入；计划从本轮实际生成的英文视频中解码第 15／105 帧，核查两次完整字幕及放逐后的席位变化。播放和视觉通过必须有实际记录，不能从文件存在推断。

## 独立预期与最终登记

预期来自规则来源、手写座位／库存／trace／同Error，不调用生产结算生成oracle；verifier也不能由同一生产规则函数背书。Root或非作者核真输入／语义／部分失败与中文真实性，不能只签hash。

最后矩阵逐真实职责登记owner／commit／证据与业务性N/A；历史pending和结构linter清债都不自动决定机制完成。没有完整同源证据时保明确边界，不标P9完成。
