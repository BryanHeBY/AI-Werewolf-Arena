# P9d 觉醒之夜：受限观察模拟

前置 `acefd74`。新模拟 handler 接入，仅从本人的 request candidate DTO、已知队友和独立 RNG 选择夜仆／身体目标或明确 null；不持有 World，不读实际库存／契约或其它玩家身份。competitive 自守须仍在候选，禁连排除自己后不能绕过；贵族 competitive 仅排除已知队友，active 仍允许合法狼队友目标。

分支统计区分 chosen/select/pass、真正 blocked/cause、契约 closed/status，不把选择目标当身体消费。其它角色的 handler 顺序和 RNG 调用保持，只有新工具进入新增处理器。

## 实际验证

- 四政策 × 混合／保守策略 × 中英：**16测试、160局、0失败、1864断言**，`/tmp/awa-noble-observed-matrix-first.log`。每政策12混合及8保守 seed，两语机器结果等价；全部自然终局、零 reject／fallback、逐局真实记录／独立账本／严格 Tape。保守策略两新能力均明确 pass。
- 增加非空分支断言后，四政策混合英文 **4测试、48局、0失败、564断言**，`/tmp/awa-noble-observed-branches-final.log`：每组实际出现两种 select、身体抵伤与契约关闭。该追加集与160局有重叠，不相加为唯一种子数，也不声称重跑所有新增断言。
- R独立 DTO 边界 **14/0/30**，`/tmp/awa-noble-r-observed-dto.log`：四style缺失／空候选、排除／重纳自身、全部已知队友过滤、random pass/select及 ownState 嵌套 getter 零读取。原输入迁入维护，**14/0/30**，`/tmp/awa-noble-observed-dto-final.log`；故意局部 DTO 的类型边界经 unknown，不宽化生产接口。
- 源码／测试类型、deps／boundaries／i18n、格式和diff检查分别通过。第一次模拟暴露的合法自爆跳夜 CP 误拒已单独修复为 `acefd74`，见[记录审查](p9-noble-secret-body-recording.md)，没有删除该 seed 或改掉自爆策略；初次失败及捕获日志保留。

模拟产生临时记录并按既有测试清理规则删除；上述执行日志与独立 DTO／字面跳夜回归是保留证据，不冒称所有临时档案仍存在。约1000 seed定时矩阵及发布长局属于P10，不由本批替代。

## 交付边界

两角色仍 planned、正式 **48/64**。本批无真实模型或认证读取，无push。完整窗口／撤权和配置差异、真实 God／玩家前端 fixtures、frame／seek、Remotion／Chromium及冻结同源全支持门禁继续；其后独立最终审查全部通过才登记50/64，剩余P9／P10保持完整目标。
