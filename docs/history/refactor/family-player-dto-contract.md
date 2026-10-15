# 两个角色家族的玩家 DTO 所有权

## 范围与输入来源

本批 O2 修改七个生产路径，新增一个只做编译检查的单元。原六个所有者以实际 Git `2117e4979a0256f95c990d25f209e347fdef9a83` 为基线；共享 `player-observation.ts` 等夜能力契约提交 `b1534c26bd2b30450f58f3c9e37a64f9cb72dcc6` 后，只改四条 inline type 来源。该文件此前 metadata 两条类型来源不属于本批。

五个声明进入已公开的事实契约：

| 现行所有者 | 迁入的纯声明 |
| --- | --- |
| `game-contract/facts/noble-secret-body` | `NoblePlayerState`、`SecretBodyPlayerState`、`NobleBodyNightNotice` |
| `game-contract/facts/mist-raven` | `PlayerAlchemistState`、`PlayerRavenState` |

此外，退出 Noble 投影叶原有的 `NobleKnowledge`、`SecretBodyKnowledge` 两个 type 重导；二者原本已经由公共事实契约拥有。本批是五个声明迁移加两个旧转发退出，不是新增七份数据结构。没有新增 subpath、依赖、锁条目、运行政策常量或状态存储。

## 类型形状与真实消费者

Noble 两个视图仍为原外层 `Readonly`，通知保留原两个只读分支；嵌套契约、status 的原可写性不加强。`awaitingNightReport` 按公开阶段及已知公开放逐状态计算，不比较真实与已知库存来推断尚未通知的变化。知识或 DTO 字段不授予窗口许可、资源写权或付款证明。

Mist 两个 DTO 保留可写字段、历史与可空目标。政策类型来自既有 `NonNullable<BoardConfig["mistRaven"]>["policy"]`，编译核准其与原 `typeof MIST_RAVEN_POLICY` 精确一致。后端运行常量和状态 reader 保留原位置，不让公共类型反向加载机制。

实际 AST 盘点 1752 个 JS／TS 文件，四条 Observation inline type、authority 的两个知识类型及通知类型、facts 的通知类型直接消费公共 owner。生产代码不再从旧投影叶消费这七个类型；旧叶保留四处真实 runtime import，其中 authority 保留原知识复制和投影函数，其余为观察投影、提示指令及既有 Mist 投影单元。没有 namespace、star、default 或动态旧类型转发留下。

## 运行保持与验证

原六个生产程序中，除明确迁出声明与 import/export 外的完整程序共 14756 个强遍历节点一致；运行 import 绑定的值、顺序和 receiver 均保持。完整 ESNext／CommonJS 输出十二份原始字节相同。最后三个文件只细化角色名称与待夜报注释，由完整非注释节点增量桥接，没有重跑这六个运行证明。

Observation 四条类型来源精确逆回真实 `b1534c26`，整个原源码字节一致；其完整 ESNext／CommonJS 两份输出首次单独检查相同。因此七个既有生产模块共十四份运行输出保持。复制、Proxy 拒绝、getter 读取、reader 接受集合、通知发布、受众冻结、付款和失败前缀不迁移或改写。

五个完整迁出声明逐子树比对；只有 Mist 的两处政策类型端点作上述精确替换。原 runtime 常量、Noble/Mist 状态所有者和 BoardConfig 三个控制文件与实际 Git 字节一致；包声明、包根出口及锁文件与 `b1534c26` 相同。

八个受影响根有限类型检查一次实际退出 0（session 87474，完成 chunk 906d1a）。新单元核对五个完整形状、一个政策字面类型和十个双向赋值；七个旧出口负例实际进入 tuple，另有三个 readonly 写入反例和嵌套／Mist 可写正例。该单元只编译，没有执行其函数或旧 suite。

真实职责检查八个 TS 输入、430 个已跟踪文档路径、诊断 0，八份中文头 presence 均通过。新说明准确区分知识投影、运行库存、冻结和授权；纯事实 reader 原算法、限额及拒绝顺序保持。

## 交付与限制

[持久证据](generated/family-player-dto-evidence.json) 保存八源 SHA、实际 Git before、两个基线层、完整程序／绑定／声明证明、编译回执和职责检查；[冻结范围](generated/family-player-dto-scope-final.json) 供独立审查。独立审查由 Root 汇合后写入，不以作者证明代替交叉审查。

运行投影仍由原机制拥有，本批不声称 O2 的运行所有者迁移或全部观察重构已完成。源路径、中文注释与公开类型 API 的变化会改变当前来源指纹；不改历史身份，不承诺严格 Tape 跨构建兼容。并行角色槽、记录器和 metadata 修改不属于本批，也未声明其完整依赖图恒定。没有运行全量门禁、整局、模型或既有绿色测试。
