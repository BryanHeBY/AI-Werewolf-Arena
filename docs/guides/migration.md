# 源码、API与历史知识迁移

## 物理移动

先确定真实owner和唯一from→to，再固定actual Git全文、absence、controls和活跃非module路径。解析原物理target后重写全部字面module形式，保aliases／namespace／type-only／lazy require／export顺序；不能只全局替字符串。

保持enum／class／WeakMap／default registry单实例，不在新旧目录各留代码。旧deep API有意退休就明确风险；包key兼容若仍必要，只指唯一物理叶，不新增转发执行器／wrapper。

`time-wolf-consort`是组织slug；`time_wolf_consort`、board／policy／event／error／message keys与原RNG种子继续稳定。fixture currentPath可以搬，originPath／suiteId／原JSON字节不改。子进程template、AST读文件、package exports/typesVersions和Trace finite profile单独适配；历史负例／旧构建profile不能当漏路由删除。

## 角色名称与公开入口

角色显示名称由 `@ai-werewolf-arena/game-text` 的 `roleName(id, locale)` 提供；中文默认、六十四项双语名称、未知 ID 原样回退和非法语言错误保持。运行 Role 与规划资料身份仍由 game-contract 定义，catalog 的资料登记不授予运行支持。

旧 `@ai-werewolf-arena/game-catalog` 的 `roleName`、`RoleDefinition.names` 和 `ROLE_DEFINITIONS[n].names` 有意退出。需要显示名称时，改为调用 game-text；catalog 继续提供原顺序的 ID、实现状态、阶段、规则卡和机制简介，不保存名称镜像，也不反向依赖 text。

显式自定义 profile、用户昵称与原文仍按原运行目录及文字注册政策处理，不能把用户文字改成消息 key。未知仓外对旧字段的读取或修改不承诺兼容。该移动及 lock 变化会改变严格来源指纹，不改写旧归档或放宽跨构建重放。

## 两批文档落地

第一原子批提炼current架构／契约／指南／决策／规则索引与current导航，标清其source布局已落条件。第二原子批把旧expansion／refactor原文件原字节移至`history/{expansion,refactor}`，同时切换真实I/O、current链接与源文档指向。两批之前不标C43完整关闭。

history的origin索引只定位资料，不执行老script或替产品读取做代理。旧文中的路径按originPath解释，若找资料用`history/origin-paths.json`查询currentPath；不能批改原source/SHA／script／raw来制造“旧证明仍在当前树可复跑”。重跑历史程序应取原Git与原布局，而非执行迁后目录中的原脚本冒同源。

现行checker读冻结baseline时必须把历史origin字段与实际I/O currentPath分开：manifest里baseline.inventoryPath仍原origin，文件读点改真实history落点；不能为搬文件重写所有fixture身份。

## 退出条件

current链接实际可达，所有真实读点无旧根依赖，history每项原blob／mode／字节保持，origin→current无重复／遗漏，无第二份活跃知识目录。最终来源身份、发现、独立验收与完整矩阵仍由Root固定同源发布，不由本文目录结构自动完成。

## 可见性和判胜扩展查询

自定义 `AgentEventVisibilityRule` 的首参由 `World` 改为 `AgentVisibilityQueries`。通过 `role(id)`、`camp(id)`、`isAlive(id)`、`aliveIds()` 和 `locale()` 查询当前值；不再从回调参数取得组件或实体写方法。历史受众和家族规则仍先于自定义回调，自定义规则仍收到原事件副本；事件投影继续使用已解析的事实。

`WinConditionSpec.evaluate` 的首参改为 `VictoryQueries`，检查点参数不变。可通过编号／角色／阵营查询、`eliminationCounts()` 和既有关系判胜查询构造条件；`decision(target, reason, additional?)` 按真实 Victory 成员构造候选。候选仍须由阶段经理验证并封盘，查询不能提交死亡或终局。

下层 `WinConditionEvaluator`、`ConditionRegistry.evaluate/evaluateMany` 和 `WinConditionRegistry.evaluate` 同样改收查询对象。可信调用端在原世界实参位置绑定 `bindVictoryQueries(world)`。每个实际规格另获独立查询表，前一规格改写自己的方法不会污染后续规格；构造查询表不提前读取组件。原覆盖优先级、检查点、条件顺序、接收者和候选原引用保持。

这两种端口在每次调用时绑定当前世界，构造时不读取组件，也不在默认注册表缓存世界。返回的编号数组是独立数据；状态读取仍是实时查询。旧扩展中的 `world.getComponent(...)` 需要改用对应值查询。需要写入的机制应由实际资源所有者提供具体提交端口，不能恢复通用 `World` 参数。

## 初始身份与野孩子的原句柄

`InitialIdentityScope.world` 和 `WildChildBinding.world` 退出。世界归属由各实际所有者的私有 WeakMap 保存，不随请求 scope、绑定对象或其副本返回；没有公开反查世界的替代方法。原句柄、资源引用与请求绑定继续由原 owner 复核，复制字段或额外补入 `world` 字段不构成授权。需要读取当前数据时使用具体查询端口，需要提交时调用相应窗口或资源所有者。

## 目标提示扩展

`TargetHintContext.world` 和 `roleCatalog` 退出。调用端先用 `bindTargetHintContext(runtimeInput)` 绑定当次可信输入，再交给 `TargetHintRegistry.buildActionableIdsHint`。扩展通过 `queries` 取得候选编号、语言和具体目标判断；行动者能力及查验历史只由查询闭包捕获，不返回原组件或能力对象。

绑定不提前读取世界或上下文字段，数据字段保持晚读；默认提示仍沿原工具、角色和政策顺序筛选。查询得到的候选不授予提交权限，实际网关、请求与资源所有者继续复验。需要自定义目标规则时组合具体查询，不能重新传入可写 World。

## 请求准入与工具校验

`ToolRule` 的公开上下文退出 `world`、`roleCatalog`、原 `RoleComponent` 和各角色请求 scope 字段。自定义规则通过 `queries.isAlive(id)`、`aliveIds()`、`currentCampValue(id)`、`hasRole(id)`、`roleValue(id)` 读取当前值；工具候选、行动者编号和原窗口字段继续传入。查询结果不授予执行或消耗库存的权限。

十类原请求证明由可信准入装配按原顺序捕获，具体规则按静态 owner 身份选取自己的证明。原参数政策和完整角色校验留在各自业务模块；通用接收器不再分支选择角色 scope。私有绑定只连接原程序与原证明，不保存世界、许可或运行结果，也不替代领域复验。

需要直接验证内建规则的可信测试或宿主，改用 `invokeValidationRule(rule, host, receiver?)`，保持原表的调用接收者。自定义规则直接接受公开窄上下文，不能用同名工具、角色编号或复制 scope 字段取得原资源。旧扩展直接读取可写组件或请求证明的代码有意退出。

`ActionPreflightPort` 通过 `locale` 暴露语言，退出公开 `world`；夜间动作入口取得绑定到当局的 `BoundToolGateway`，调用者不再额外传入世界。接收、校验与真正提交仍由各自原 owner 负责。

## 死亡钩子与选枪结果

死亡、放逐和已提交死亡波的公开钩子首参使用 `HookRuntime`：当前角色、阵营和存活值由 `queries` 查询，具体提交权只由已装配的本族命令提供。世界、事件容器与延迟准备源留在原资源所有者内部。未知自定义钩子不能通过同名函数或复制编号继承内建绑定。

公开 `DeathHookChooser` 返回 `DeathHookChoice`，只包含选择种类、目标编号、死亡动作编号及可选的映射落空标记。旧 `targetScope`、原生命组件和 `mappingCurrent` 不再返回给扩展；选择本身也不是消耗库存或提交死亡的回执。内建资源程序仍使用私有原选择结果，保留原目标身份、映射校验、付款顺序和失败前缀，不在公开数据上重建授权。

## 夜间阶段扩展

`NightStageHandler.execute` 的公开 `NightStageContext` 退出 `world`、原组件、整夜 `state`、事件数组、Catalog、请求构造器和内部能力查询器。使用请求方法、绑定的 `actions`、编号查询及显式装配的具体 `ports`；`actionProvider` 实际只提供 `getAction`。需要额外写操作时，由相应资源所有者提供具体命令，不能重新加入通用存储接口。

计划持有 `NightStageDefinition` 的原引用。完整内建算法留在各机制模块，组合根同时核对真实 handler 和定义时的原 execute；执行方法被替换或同名定义来自外部时，只传公开上下文。内建直接 `.execute(rawContext)` 的旧调用方式退出；可信测试通过 `executeNightStage(handler)(runtime)` 走与流水线相同的分派。该边界不以角色编号或阶段名称授予权限。

`NightStageRegistry.getPlan/getStages` 的世界参数改为 `NightStageRosterQueries`，只查询收集阶段所需的编号、种类及布尔值。原收集、预约、去重和排序仍由注册器负责。机械狼与觉醒隐狼的捕获句柄退出公开 `world`，由各自私有字段核对当局归属；已付效果仍按原生命、学习和来源约束复验。

## 角色贡献的读写权限

自定义参与资格、队友知识、狼队权限、熊感知、自爆资格、查验标签、胜利归属、基线和渲染回调改收 `RoleQueries`，退出原 Role、Camp 组件和 World 参数。通过当前值方法查询；`stateData()` 在实际调用时生成可写的脱离副本，容纳能力元数据及历史层级，拒绝访问器、Proxy、循环和超限数据。修改副本不会消耗或更新原库存。

初始化回调保留自己原角色容器与待安装 `initialCamp` 的写权限，但其上下文退出 `world`；`currentCamp()` 返回实际当前阵营枚举。胜利归属使用独立的 `RoleValueContext`，没有 `initialCamp` 写权限。真实阵营、已知队友、展示标签和 Victory 成员继续分别维护。

内建完整程序由内部静态函数身份登记，保留原引用、具名属性推断的函数名、接收者和延迟读取；未知替换函数只收到公开窄输入。需要直接执行内建贡献的可信测试使用同一内部调用入口。外部旧扩展中读取原组件或七参数基线的写法需要按新契约迁移。

## 根出口、事实路径与夹具

原深路径与旧聚合门面按本轮公开 API 清单退出，不留第二份执行器。导入共享契约、展示及词典时使用包的具名公开出口。时间狼妃事实出口由 `facts/time-consort` 迁为 `facts/time-wolf-consort`；机器 ID、消息 key、RNG fork 和既有事件原文保持。原版本的未知仓外 deep consumer 不承诺兼容。

夹具通过现行 manifest 与 loader 定位 currentPath，原 originPath、suiteId、归档 JSON 字节及来源身份保持。旧资料从 `history/origin-paths.json` 查落点；要复跑历史证明须使用原 Git、依赖与原布局，不执行迁后旧脚本冒充同源。

## Tape3、已知候选与故障因果

公开回放 reader 与严格动作复现是不同兼容层。当前严格 Tape3 可以保存实际已复制且交付以 `false` 关闭时的正常候选；旧 Tape2 保持原格式，不为跨构建或未知 partial 补造信息。候选本身不证明资源付款、拒绝原因或任意外部副作用。已知候选约束 Cupid／Hybrid 的末决定，缺席时才使用已声明的 opaque 政策。

Noble 指定的原生命替换通过有限离线故障计划，在原请求窗口触发实际资源所有者，再必须记录故障事实。正常执行不默认注入故障；测试观察函数不再承担未记录的世界写入。完整支持和拒绝范围见[机制支持边界](../contracts/mechanism-support-boundaries.md)，具体录制顺序见[录制契约](../contracts/recording-and-reproduction.md)。

## 名称扫描与中文维护

中文消息词典与角色名称词典是两种明确数据位置。扫描器仅准入登记消息对象的直接值，以及唯一名称表的直接 `names["zh-CN"]` 字符串；相邻业务、其他字段、嵌套或局部同名表仍受检查。名称迁移不通过增加 64 条兼容例外来消除诊断。

新建或实质修改代码时同步使用中文说明职责、输入输出、资源归属、重要数据结构和控制流程。原引用／副本、写入范围、关闭顺序、错误前缀及不变量应就地可读；不逐行复述代码或堆砌占位注释。纯注释、物理迁移和行为修正各保留对应证据，不把一种证明换成另一种。

## 最终来源与文档发布

本轮受测源码为 `60fdbfbc57122eeb1d4e9204b66d4daec1eb0157`；同一公开产品输入的 42 个原子命令均取得成功终态，共 43 次真实尝试；保留 Chromium 首次因临时 socket 路径过长而失败的报告及只调整 TMPDIR 的显式重试。完整场景为 3345 通过、1 项明确条件跳过、0 失败；浏览器第二次相同 362 个用例全部通过。14 个类型项目、两项构建、其余各层测试和静态门禁分别保留原始结果，中英文图片及英文视频已实际生成并回读。最终验收证据与后续职责矩阵元数据分提交发布，后者不冒称重新运行了全套产品门禁。旧 sourceHash／lock／RNG 身份不改写；接受范围、已退 API、有限不适用及实际结果见[交付状态](../architecture/delivery-status.md)和[最终验收](../history/acceptance/refactor-final-acceptance.md)。
