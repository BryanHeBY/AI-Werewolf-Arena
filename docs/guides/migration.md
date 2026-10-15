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

这两种端口在每次调用时绑定当前世界，构造时不读取组件，也不在默认注册表缓存世界。返回的编号数组是独立数据；状态读取仍是实时查询。旧扩展中的 `world.getComponent(...)` 需要改用对应值查询。需要写入的机制应由实际资源所有者提供具体提交端口，不能恢复通用 `World` 参数。
