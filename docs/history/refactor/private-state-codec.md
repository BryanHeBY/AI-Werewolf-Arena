# checkpoint 私有状态数据编码归属

基线为真实 Git `195e17e022805f0b85f63f5508d385a5a29b768c`。本批三源：玩家装配、完整私有状态编码 owner、两个有限风险单元。没有删除旧模块或兼容转发；这是全 55 codec 收口的第一步，尚不代表所有机制状态／编码职责完成。

## 实际职责与顺序

`private-state-codec.ts` 的 `encodeCheckpointPrivateState` 拥有完整原选择表达式：动物最初审计及三主体快照 → 寻香权威 → 已选婚约／孤女审计 → 孤女两次查询 → 普通整容器 `structuredClone`。动物其余参与者仍走原 `snapshotPlainData`；命中前一来源即短路。内层资源引用与原普通克隆语义均保留，不增加 registry、Role 筛选、版本、schema 或权限检查。

`player-snapshots.ts` 在原 `privateState` 字段位置一次调用，只传原已求出的 `world/id/complete/animal/original/role/audit` 引用。Demon 整份 players 优先返回仍在外层；Identity、Role、Badge、Vote、婚约／孤女 audit、Wall 等前置读取，以及后续 DebatePenalty、Lovers、Victory、Marks 的装配与失败前缀仍由原 owner 负责。

孤女存在判断与值处仍分别调用，不缓存为一次。普通分支仍先查全局 `structuredClone` callee，再读 `role.privateState`；getter／clone 抛错原样传播，尚未读取后续玩家字段。普通克隆保留原可接受扩展字段、合法 getter 值及容器内 alias；这里不提前执行稍后的归档 `z.json()` 校验，也不以玩家裁剪 projection 替换原容器。循环／undefined 等宽克隆结果不因此成为合法 JSON 档案。

## 必要验证与真实阶段

- 新两个字面风险案例首次 `2 pass / 0 fail / 11 assertions`：共享 alias、循环、undefined、合法 getter 的完整克隆；callee 查找先于私有 getter，以及 getter 抛出同一错误时未进入 clone。
- 原 `checkpoint-contributions` 前三案例首次 `3 pass / 0 fail / 13 assertions`；第 4 Animal audit 案例只保完整 Git/current 字节控制，未重跑。合计两次执行、五个不同案例、24 个断言。
- 三个实际源码根有限类型：`ee32fd / session 96628 → 634114`，真实 exit 0。空输出不作为退出证据；不宣称完整树类型或所有场景通过。
- 原 `checkComments` 精确三根首次 `4146a1`，648 个实际 Git Markdown 路径，职责头与中文头诊断均 0。

证明首次 `674bcc` 为工具红：删除 import 的空 `after` 被用于逆向计数。首脚本、精确 edits 和日志保留；只将删除操作的逆向锚点收窄为相邻原 import，生产正文不改。最终 `a1c069` 真 exit 0：真实 Git 装配全文五处精确正逆，完整 732 typed 节点／843 非注释 tokens 与两种完整迁移逆 JS 同；实际新 return 对原 initializer 的完整 106 typed 节点／114 tokens 与两种表达式比较输出同。不是恢复整个旧装配 body 来证明新 owner。

三个实际 value callee 的物理声明仍是 `snapshotPlainData`、`fragrantCheckpointPrivateState`、`projectLonelyGirl` 原 owner，实际路径与声明哈希在 proof 中逐项绑定。World／Role、动物与审计输入类型只作类型引用；没有把运行 World、许可或回执写入归档。

首测试／职责头采样后，仅两条中文精度修正：`席位` → `玩家 ID`；短路说明改为“前一来源命中即短路”。完整旧 owner 文本与精确两条记录保留；最终首成功 proof 内核全 typed／非注释 tokens 与 owner 两个完整 emit 同。原测试、类型、职责头绿收据和各自采样 SHA 保留，没有重跑。

## 范围与限制

本批新增运行模块、导出函数及调用边界，实际 JS 导入／调用位置、函数栈与模块初始化路径会改变；不承诺任意 module namespace 重赋／反射环境或全图初始化逐字一致。原整装配输出只在精确迁移逆后相同，新表达式另外直接核对；新单元没有旧程序可宣称逐字同。

proof 执行版 limits 的“四类 type-only”指 prepareAnimalCheckpoint、animalOriginalAuditPlayer、weddingAuditPlayer、projectLonelyGirlAuditPlayer 四个推断来源；World／Role 另有中立类型导入，均擦除。首 proof/head/runtime 的历史文本及计数没有重写。注释和运行路径进入新 sourceHash，历史档案身份不变，也不提供跨构建复现豁免。

未运行全门禁、模型、整局或其余已绿检查。普通 cloned payload 的后续 JSON 接受／拒绝、其它 55 族资源写权和失效仍须各真实 owner 与独立 verifier 证据收口。

## 证据

[冻结 scope](generated/private-state-codec-scope-final.json)、[完整表达式与装配证明](generated/private-state-codec-proof.json)、[真实收据](generated/private-state-codec-receipts.json)、[交付 evidence](generated/private-state-codec-evidence.json)。
