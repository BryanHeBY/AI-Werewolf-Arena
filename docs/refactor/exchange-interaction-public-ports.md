# 交换交互公开端口

## 实际范围

基线为 `065d1d6a315bdedd6c4c58e80e682084974de6b6`。本批仅新增三个具名公开叶，接通两个真实消费者的三条原私有路线；五源顺序与 SHA 以 `generated/exchange-interaction-public-ports-scope-final.json` 为准，无删除项。

| 公共入口 | 原唯一实现与具名绑定 | 实际消费者 |
| --- | --- | --- |
| `wolf_sorcerer/exchange-ports.ts` | `night_frame.ts` 的 `isWolfSorcererBoard`、`resolveWolfSorcererNightTarget` | 魔术师 frame |
| `trickster/exchange-ports.ts` | `exile_mapping.ts` 的 `matchingExchangePairs` | 魔术师 frame |
| `magician/exchange-ports.ts` | `night_frame.ts` 的 `cancelMagicianExchangeIfMatching` | 诡术师夜阶段 |

三入口只有原函数的直接具名重导出，没有转发函数、角色分派、状态表或新写权限。原私有实现与其 API 保留。现有聚合 ports 会额外接入夜清理表；本批使用单一实现边的轻入口，保持旧可达原模块的初始化次序，不提前创建聚合终结表。

## 规则与失败前缀

魔术师仍在原点识别狼术师板子并读取 `W(raw)`，随后读取 `M`；不提前缓存 World、政策、回执或目标。中间死亡占有者不妨碍原规则到达活的最终占有者。无序对查询仍先规范化第一对，再规范化第二对。

取消仍在原体、当前夜、已提交与同配对条件通过后只清 pair，不退已用号码或历史。诡术师仍先提交自己的历史与事实，随后查询／取消魔术师；对方返回 true 才清本方映射。晚查询或取消异常保留此前写入与发表前缀。库存、付款、事件、await、receiver 与参数读取正文均未改。

两消费者各保持完整旧程序，仅三条 import 路线与三条有效逻辑注释变化；三个新头说明输入、输出、唯一实现、生命周期及许可边界。诡术师入口的“负责”用语在首次检查前校准，旧 ready 文本保在 `source-ready.json`，所有首次检查实际采样 `first-source.json`；没有检查后源码变化。

## 完整迁移证据

`before.json` 保存两个真实 Git 原文、三个新路径原不存在与八个完整稳定控制；`edits.json` 保存六条精确编辑。两完整程序全文正逆相等，路线逆后完整 typed AST（含叶文本与 NodeArray）一致；累计 5668 节点比较、2976 AST 叶比较不是独立源节点计数。

两程序的 ES 与 CJS 共四个完整逆输出相等；另四个实际输出经精确路线及 CJS 编译器生成的 namespace 标识符映射后相等。CJS 的 `exchange_ports_1/2` 与旧 `night_frame_1/2`、`exile_mapping_1` 名称差异明确记录。实际 JS 全文四个均不同，不能称实际输出原字节相同。四个入口导出加四个消费者导入，共八个具名端点均解析到原物理函数声明。

固定 Git 的两消费者相对值依赖闭包加本五源 overlay：43→46 模块、87→90 边，只新增三个直接实现入口。折叠三个入口后原有序边与 DFS 首次访问序一致，原其他可达源码字节保持。此为有限静态初始化图：包外终点未展开，函数内 dynamic import／require 不列初始化边，没有冷执行、任意 CJS monkeypatch 或模块反射等价结论；并行 Inspection／HuntDream／runtime-config 工作区增量未纳此固定图。

## 首次有限收据

全部执行使用 `bun --no-env-file`，没有重复绿色检查。

- 三个原精准用例：死中间映射 `efcdf5`（1／3）、无序对历史 `26de9b`（1／5）、双方取消 `e33096`（1／7）；共三不同 case、15 断言，原标题、fixture、动作和 oracle 未改。
- 五根类型 `7a2951`／session 57557 → `9dcdc8`，真实 exit 0。
- 五源职责头 `52a7f9`，684 文档、0 诊断；完整迁移证明 `a3d98a`／session 32271 → `36ab3a`，真实 exit 0。
- 五路径过滤的 Git diff-check `445495`，exit 0；实际只检查两个 tracked consumer，三个未跟踪新叶另经完整 export 程序／端点／输出证据核对，不称 Git diff 已检查新叶。

没有产品／类型／测试／主证明首次红。附带只读元数据查看 `97fbd1` 曾误将数组 edits 当对象而失败，随后 `ef1b17` 按实际 wire 读取成功；没有因此修改产品或重跑检查。未运行全门禁、整局、模型或旧绿色 suite。

## 接受面与交付限制

新公开模块路径与出口是本批真实 API 增量；named reexport 的模块 namespace／property descriptor 形状不承诺任意外来反射或重绑定等价。共同状态、写者、原体撤权及运行资源仍由原 frame／状态槽／阶段持有，端口名称与类型不授予新许可。本批只收口三条跨族交互边界，不宣称整族 C17、所有权限或全目标完成。

所有五源冻结；scope/evidence 排除 Root／peer review，避免循环摘要。提交由 Root 完成。
