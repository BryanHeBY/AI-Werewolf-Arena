# 下一笔建议：猎魔夜间来源折叠与事实发布

只读盘点，基线 HEAD 为 `f8822eb7989e6265a12d21f1a942340a3ae9ef8c`。未编辑产品、未运行门禁／测试／证明。NightPipeline 当前另有恶夜骑士运行查询改动，属于 NativeFinal 的工作；下述方案不修改其算法，也不混入师徒批次。

## 选择

建议完整提取 PhaseManager 两个猎魔专用检查点，共 **67 行**：

- `phase_manager.ts:485–518`：原生毒来源覆盖、狼刀的守／救碰撞复算、狩猎／反噬原因追加。
- `phase_manager.ts:578–610`：取消与毒免疫的空受众事实，以及 `demon_hunter_sources_frozen` 可选诊断。

这两段分别位于夜仆到期／真实原生命筛选之前、秘密之身最终折叠之后；必须保留两个调用点，不能合并成一次较早的处理。

新具名 owner 可用 `roles/demon_hunter/night-damage-contribution.ts`，两个同步函数 `appendDemonNightDamageSources` 与 `publishDemonNightDamageSources`。前者原地修改同一 `proposedSources` 和 `guardOverrides`；后者只发布原事实与可选诊断。不建立 registry、生命周期类、第二份状态或全夜通用框架。

读取契约只给原保护对象查询、刀来源查询及 `healMarkPresent(target: () => EntityId)`；最后一个由 PM 在原表达式顺序读取同一 StatusMarks。折叠 owner 无需接收任意可写 World。发布 owner 只获得原事件写入引用；不借此获得生命、库存或阶段写权。

## 实际输入与唯一所有者

- 唯一生产调用方：PhaseManager 的上述两个位置。
- 输入 `demon` 是现有 `native_potion_controller.ts:330` 的 `freezeDeliveredDemonNightSources` 返回值；其 token、sealed/frozen、毒／救原来源与付款继续归该控制器及 authority。
- `night.demonKnifeProtection` 与 `demonWolfSourceCurrent` 目前由 `night_pipeline.ts:312–366` 捕获。它们是原目标／guard 句柄的运行查询，不是库存或 JSON 许可。
- 死亡原生命筛选、婚约刀检查、其它致死来源、秘密之身、夜仆正常关闭、实际死亡／胜负和错误 finally 继续由原所有者在原位置执行。
- 本批不移 `applyBeforeNightSourceFreeze`、必需 fault 录制、源 freeze、本夜开始／关闭、红月延期死亡或 native 狩猎选择；不重新生成 proof/token。

## 单笔精确范围

建议五个源码路径：PhaseManager、新 owner、`demon_hunter/ports.ts`、NightPipeline 的一个纯类型路由、一个新增定向 unit。

现 `NightPipelineResult.demonKnifeProtection` 的五字段 readonly 形状没有具名所有者。原文移成新 owner 的 `DemonKnifeProtection` 并从该族端口 type-export；NightPipeline 只用此类型替换内联声明，值捕获体完全不动。`DeliveredDemonNightSources` 使用已有类型，不复制字段，也不 value-import 原生控制器。

NightPipeline 的纯类型绑定与恶夜骑士批次在同一文件：**先等其冻结，或由 Root 协调精确这一字段的 type-only 增量**；本盘点没有抢写该文件。若当轮不协调该类型声明，应先排队，不制造两份刀保护数据声明。

## 必须保持的风险点

1. 原守护覆盖数组仍在 PM 原位置创建并传入，毒覆盖按原次序写来源；后续失败不撤销已经改写的前缀。
2. `night.demonKnifeProtection` 原两次读取不能提前缓存。`knife.guardCurrent?.() ?? knife.guard` 保持方法 receiver；守护记录追加早于救药查找及 StatusMarks getter。
3. 救药覆盖优先于原 heal／当前 HealMark；只有 `knife.wolf && guard === heal` 后才查询刀来源。
4. 刀来源查询须接收惰性目标，例如原 `night.demonWolfSourceCurrent?.(target())`，以保 callee 查找／receiver 先于 `knife.targetId`；不要先读 target 再传普通数字。
5. 世界查询保持晚 getter。狩猎 damage 仍按原 `??=` 后 append；不去重成通用攻击／保护模型，不把反噬交给 guard／heal 规则。
6. 取消事实 → 每个免疫事实 → 可选诊断的顺序、Date.now 位置、空受众、键序、原来源字典引用及当时死亡名单副本保持。**可选诊断不能升级成必需操作，也不能吞掉事件发布错误。**
7. 无新增 await、当前性检查、RNG、来源拒绝策略、资源付费或 schema 校验；原异常仍走经理既有清理。

## 最小验证建议

新增两至三条字面风险用例：守护 getter／救覆盖查找失败的已写前缀；刀方法缺失不读惰性目标及原 receiver；第二个免疫事实发布失败时保留第一个事实且不启动诊断。

既有测试只选择实际对应边界：

- `scenarios/features/demon-hunter/native-pipeline-and-failure-handoffs.test.ts` 的 `ordinary Guard plus Heal collision remains lethal`。
- 同文件 `native immunity retains independent generic poison after_ordinary_damage`。
- 如 publication 仍有隐私剩余风险，仅取 `native-fact-recording.test.ts` 的中文一例；不用整个矩阵重跑。

有限类型按真实五路径一次；原完整两段与 PM 其它程序／绑定作精确接口逆，不把整个旧主体填回新 owner。独立审查分别看付款／来源规则、late getter／失败前缀、加载图／公共类型与事实隐私。

## 本次看到的 I04 与注释缺口

基础技能仍有真实横向业务边：Seer 校验直接查询师徒阻断；Witch 校验直接查询师徒及魔术师映射；普通狼校验直接处理婚约权威，普通狼 mock 查询迷雾候选。这些并非单纯 import 别名，下一笔应有规则组合与具体 owner，不能换万能 ports 掩盖职责。

普通 Seer/Witch stage 已通过原 nativeNightFailure/nativeNightTargets 查询执行很多特殊边界，本次不重复迁移它们。当前师徒和恶夜骑士任务也不在这笔范围。

`native_potion_controller.ts` 的来源封存说明仍有英文，如 “Complete source set comes from the actual controller…”；PM 的守／救碰撞、原生与未知独立毒来源、覆盖数组写入前缀缺少就地中文解释。实施时只补本批触及位置的准确说明，不发起全仓翻译。
