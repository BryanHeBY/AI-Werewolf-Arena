# 剩余独立归档核验器的完整归属

基线为前批十路径真实提交后的 `eed72f1f7c44303ed3bc3033b2398da57bd28710`。本批将 recording 剩余 **16 个纯核验叶（8 完整 verifier＋8 helper，共 9,838 行）**整体归 verification/reproduction。36 源路径＝16 原叶删除＋16 新叶＋4 实际消费者；20 个现行程序均取同一真实 Git before。

## 完整家族与真实消费

| 原 recording 叶 | 新 verification/reproduction 所有者 |
| --- | --- |
| animal_dream_record.ts / animal_dream_feed_record.ts | animal-dream/validate.ts / feed-evidence.ts |
| fragrant_pair_seer_record.ts / fragrant_pair_seer_feed_record.ts | fragrant-pair-seer/validate.ts / feed-evidence.ts |
| mist_raven_record.ts / mist_raven_requests.ts | mist-raven/validate.ts / requests.ts |
| mist_raven_feed_record.ts / mist_raven_sheriff_record.ts | mist-raven/feed-evidence.ts / sheriff-evidence.ts |
| ghost_bride_record.ts | ghost-bride/validate.ts |
| noble_secret_body_record.ts | noble-secret-body/validate.ts |
| demon_hunter_record.ts / demon_hunter_stocks.ts | demon-hunter/validate.ts / native-stocks.ts |
| red_moon_record.ts | red-moon/validate.ts |
| radiant_eclipse_record.ts / radiant_eclipse_requests.ts / radiant_eclipse_night_requests.ts | radiant-eclipse/validate.ts / requests.ts / night-request-prefix.ts |

四实际消费者是 assembly、Mist/Raven board 场景、Mist/Raven 增量结算伪造场景、RedMoon unit，共11个原模块 import。其它 board 场景从原装配消费，不制造新的直接调用或修改 fixture。所有函数名、输入／断言／原标题、机器字段、错误码、政策、第一拒绝和迭代次序保留；只物理路线与精确说明变化。

家族互依赖保持：动物／寻香各自完整 feed；Mist 的 requests、feed、sheriff 及共享 `check`／`equal`；同一个 sheriff 证据被 Mist、寻香、贵族、光蚀使用。assembly 在原点取得 Noble audit，同一引用交给 Demon；Demon 原顺序先核 RedMoon，再在原位置核 native stocks。没有 BaseVerifier、generic vote 或第二份生产规则。

Radiant 的 validate→requests→night-prefix 及后两叶→validate 的原值环整体保留，validate 底部 import 保原相对位置；不借迁移修循环或重排顶层执行。记录类型仍 type-only 指向唯一 recording/reproduction；三个 shared checkpoint 格式、Trace、录制 checkpoint、Session／FileStore 和 World 权威留原位。

## 有效中文与实际写权

最终26项精确 comment 编辑，原代码／类型不变：两个独立 feed、Radiant request/prefix 和 Mist 场景英文头／说明译中文；动物完整职责、婚约局部账本、警长逐轮票、Noble checkpoint identity audit、RedMoon 事件位置与 readonly 非冻结、猎魔人／赤月当前名称、Radiant 副本／停止前缀、寻香三游标和 Mist 操作输出独立核验就地说明。

不把纯归档账本说成运行权限或付款。两个 feed 仅本族私有事实核本人和原 audience，`vote_summary` 去 tally，其它可见性仍按原逐类判断；不可见项不占该玩家的 seq。Demon 是 void 核验，不返回 Noble／RedMoon 形式的 audit DTO。Noble `at` 按原 checkpoint 对象取历史副本，nights 保原可写 Map；不加深冻结或 schema。Radiant 未完成前置只结束归档前缀，不开后继真实窗口。

## 一次有界检查与末注释桥

- 完整20程序逐项逆 **65 处路线和当时25项注释**后，与实际 Git before 原文相同；**79,246 typed 节点**、全部非注释字面叶与 **40 份 ESNext／CJS 原始整程序输出**同。不是删业务体或恢复旧算法后声称新算法相同。
- **221 个 import binding**的模式／名称／位置与路线保持：**212 个内部实际声明端点**；**9 个外部**仅核原 module/name 身份及当前解析入口，不称其为内部物理声明证明。184 个位于移后 owner 或 reroute，37 个原消费者绑定原样；184 不是 specifier 次数。
- 原16叶全有 actual Git SHA 和 expectedAbsent；九明确控制（3 schema、parser、Trace、checkpoint、真实 aggregate／file store、assembly unit）保完整字节。
- 有限20 roots `53100 → f5b887` 首实际 exit0。空日志不推成功。之后仅中文头／说明精度；没有重 types 或旧测试。
- 首20职责头 `c43c57` 是真实1诊断，因 Radiant requests 的 invariant 词项缺失；补准确失败边界后单根仍红 `f3c2a2`（“只”未匹配“仅”），精确同义修后 `210c4f` 单根0。原19绿不重；采样均500个实际 Git 文档路径、中文头0缺失。
- 程序证明首工具逆路线早于含 import 的新首头，`69c503` 报 comment_count；单工具改序后 `bb06e0` 暴露未覆盖的原 `bun:test` 内建 binding。补实际内建名称空间后 `25438 → 4fce55` 终 exit0，原失败保留，不改产品。
- peer 指出4处说明精度（动物术语、Demon void 输出、两 feed 范围）后，仅修 comments；原20／40报告和 sourceSHA保在采样时点。两次独立两源桥分别 `4e5108`、`2a6421` 实际0，共4源、8输出与全部非注释叶同，桥至最终26项编辑和20源 SHA；没有重已绿首桥、type／head／运行。
- 当前1691个真实 TS 源的 named／namespace／reexport／importType／dynamic import／require 字面盘点 `ecd372` 实际0：31个canonical引用、11个外部consumer import，0旧路径。任意 computed 路径不作穷尽承诺。

本批**测试运行数为0**；不重已验证装配 getter／parser、Tape／整局、原完整场景、全 gate 或模型。证据仅此局部迁移，有限类型传递闭包可能读取其它当前源，不代表并行 Inventory／Seer 或整个工作区门禁通过。

## 接口迁移与冻结

16个旧私有物理模块路径删除无桥；原函数名与完整算法保。新 URL、模块加载键、栈位置和源码来源指纹改变，不声称任意冷初始化／CJS反射布局全等价或跨构建动作重放豁免。历史 proof／fingerprint 保留；三个 shared checkpoint schema 和真实录制算法没有改变。

36源已冻结，由 Root 和独立 peer 审后按功能提交；作者不 Git、不改 progress／矩阵。不据此宣称全部 P7/P8 或全仓归档架构验收完成。[精确冻结范围](generated/remaining-reproduction-verifier-owners-scope-final.json) · [紧凑证据](generated/remaining-reproduction-verifier-owners-evidence.json)。
