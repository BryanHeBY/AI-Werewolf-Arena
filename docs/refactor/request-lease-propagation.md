# C18 请求绑定与别名传播所有权

基线为实际 Git `bd1066307343b1d5c10bc7704fefbc0b77e9a341`。本批 13 路径：11 个既有程序、2 个新程序，7 生产源与 6 测试源，无删除文件。源码冻结范围见同前缀 `scope-final.json`；其它 A35 工作区变化不列为不变控制。

## 完整职责

`core/domain/request-lease.ts` 实际收走四种完整 bind/query/alias 程序。四个机制各创建一个稳定实例，每实例唯一拥有原请求关联弱表；同一 request 可同时具有多种绑定，后续失败不覆盖此前记录。原 World、scope、生命、库存与关闭数据仍由具体机制唯一拥有，公共记录只持原引用。

| 机制 | bind 的原顺序 | query 差异 | 传播顺序与比较 |
| --- | --- | --- | --- |
| InitialIdentity | actor → phase → day → stage | 先同 World/活跃 scope；不补完整 domain current | 20；长度／some／直接索引 |
| WildChild | stage → phase → day → actor → current | context → stage → day → phase → current | 30；长度／every／Reflect.get |
| LonelyGirl | actor → phase → stage → day → current | phase 先于 context 身份 | 40；长度／every／直接索引 |
| Wall | authors.get callee → actor → token → instance | phase/day/stage 仍只在 query；不补 sameWallAuthor | 10；长度／some／直接索引 |

各 bind 条件全部通过后才读取 `WeakMap.set` callee，随后构造原 record 并读取 context／墙捕获字段；写表后登记稳定回调。Wall port 返回原 authors Map，公共 owner 执行 `.get(request.actorId)`，保持 get callee 先于 actor getter。source-query 成功后才枚举别名，比较后继承同一 record，再登记同一回调。异常原样传播，不回滚已经完成的其它绑定。

类型入口只开放四种固定协议；机制端只给 active/scope 字段和 current 的晚查询，没有完整 ActionRequest predicate 回调或中央 Role 分派。私有构造签名与查询接口不构成运行时权限屏障。公共 owner 唯一运行值依赖是原 `request_delivery` 登记函数，无 World/Role/GC 运行导入。

六个旧 inherit 导出退休：InitialIdentity、Thief、Shapeshifter、WildChild、LonelyGirl、Wall。五个实际旧测试的十次调用改为已有 `inheritRequestAlias` 公共传播入口，标题、fixture、动作和预期不改。两包装 API 的旧 stage gate 随退休出口退出；不承诺任意外来调用该旧 API 的反射语义。四 bind/scope 公共名称与实际 factory/dispatcher/gateway 接线保持，未修改 `request_delivery.ts`、工厂或分派器。

## 原政策保持

旧协议仅在字段比较中排除 `deadlineAtMs`，没有数值／过期／延长检查、delivery guard、completion 或请求永久撤权。失配只拒本次查询；字段恢复仍按原机制规则核验。领域关闭、生命和库存撤权仍由原机制判断，没有复制库存、镜像状态或新付款。

Native 的首次实际 characterization 已原字节保留：四 case `f9df9b/0`，4 pass、87 assertions。原 stage、原 context、已登记 alias 自己的 context 恢复后均返回原 scope 同引用；坏未登记 alias 不伤原，正常关闭后不恢复。Thief 代表 InitialIdentity，未执行 Shape；Wall 只对 actor1 探针，Provider 实际调用 6 次。四旧叶固定 bd106，传递模块为当时 A35 工作区；不泛称所有领域许可可恢复，未覆盖期限或结算。未重复该实验。

F02/期限/settlement 留后继独立行为批：已登记 alias 仅替自身 context 只终止该 alias；观察到 original/domain current 或共同过期才关闭共同 lease。wrong World／未登记坏 alias 只拒输入。实际 await/commit/finally 接线、每作者 Wall completion 与最早期限尚未实现，不能以本批宣称关闭 C18a 或所有请求目标。

## 必要验证与真实红灯

- 首新 3/0/41：`57e2c0/0`。人工读取顺序、同 ref 恢复和独立传播前缀为 oracle。
- 自查发现首实现 record capture 提前于 set callee、Wall actor 提前于 get callee；均在公共完整 bind body 修正。只给原第三 case 加此前未覆盖的 set-getter 输入，`3a6bbf/0` 为 1/0/8、2 filtered，不复首两个绿例。仍为 3 个不同新 case，最终源码共 44 个静态断言；两次执行 49 assertions，原第三 case 的 5 项重复不称独立新例。
- 五个旧精准：`1dce99/1`，3 pass/2 fail/13 assertions、213 filtered。Thief/Shape/Wall 通过；Wild/Lonely 在原 raw `g.config` 与绑定 boardConfig 身份检查处报 `*_setup_unavailable`，尚未创建请求，不修 fixture 或抹红。Wall 该输入期限是 100；12345 属于未改 dispatcher case，Wild 输入是 200。
- 只对两失败输入使用十一旧程序 bd106 before overlay：`29c68b/1`，0 pass/2 fail、80 filtered，同最早错误。11 个旧程序可用，实际加载 8 个，`readFile/fileExists` 一致且新 owner 不可用；其它依赖为当前工作区，不是整树固定 Git。首 loader `b20821/1` 因 onLoad 未返回对象中止，真实工具红保留，修 loader 后没有复旧绿例。
- 首 13 根类型 `1581c8/20586→245803/2` 仅新 fixture 缺未读 context 字段；局部 cast 后 failed1 `ac8c50/2` 再暴露额外 requiresAction 类型，保原运行输入后第二局部 cast，failed1 `d4e20f/3038→d9c2bc/0`。最后 cast 的两个完整 JS 与其真实已执行输入相同，不重复测试或 13 根类型。
- 首职责头 `31263a/0`：13 源／658 同 Git 文档，诊断 0、中文头 0。该采样保首 owner/unit/Wall SHA；后续时序与精确说明承接完整最终程序证明，不冒当前 SHA 重跑该绿检查。

## 完整程序与绑定证明

唯一成功 proof `5c1da6/74071→f78653/0`：11 个完整既有程序精确 47 处编辑正逆；12 个真实 bind/query/inherit 核心从公共 owner 完整逆展开，累计 29416 typed nodes／14989 AST 语法叶比较。late port 展开、Wall nullish get 表达、比较 helper 的 boolean/early-return 形态是明确有限规范化；没有用旧整个 body 代替新 owner 核对。

11 个保留程序的 22 个逆后 ES/CJS 完整输出字节相同。12 个核心的 24 个输出全部完整 emitted AST/叶相同，其中四个 query 的 8 个 raw 输出因原布局不同而不相同，另外 16 个 raw 相同；不称全部 raw 相同，也不把 AST 叶叫独立完整 lexical-token walker。最末 test 类型修复另有 2 个 raw 相同输出。

实际 TypeChecker 比较 325 个保留 import 的模块／模式／名称及物理声明端点（path/kind/name），9 个旧 import 退出、9 个公开 import 引入。端点身份不等于其它工作区程序全字节不变。七个当前源码根 1915 文件（TS/TSX/MTS/CTS/JS/JSX/MJS/CJS）AST 退休标识符 0；不执行非字面字符串或扫描历史 generated。仅六个真实 control 全 Git/current 字节保持，不扩张为完整依赖图。

七次失败 proof 工具过程原脚本／日志字节和实际回执合并保存在 `proof-tool-history.json`：Unicode offsets、constructor 节点、参数改名、打印布局、比较 block／括号形态；修的是比较器，未为证明修改业务源。新增模块、class、晚查询 adapter／函数栈和旧 export API 形状变化如实承认，不承诺任意 CJS namespace／原型 monkeypatch 整环境等价。

本批未运行全架构门禁、整 suite、整局、模型或私有配置；不把结构传播边界称为全部行为或请求生命周期验收。
