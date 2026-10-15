# 魔术师、狼巫与捣蛋鬼夜间交接

## 原有耦合规则

三个 pipeline 失败清理分支原本共享同一个 magicianHandedOff。受支持的狼巫与捣蛋鬼板子包含魔术师，不能将它改成三个独立移交状态。MagicianNightUnit 现在唯一持有该状态；另两个具体 unit 使用其冻结的只读布尔查询视图，不存第二份标记。原较晚位置只读取一次 config.magician 并移交，三个配置分支继续按捣蛋鬼、狼巫、魔术师的原顺序执行。

构造和绑定视图不读取 World、阶段、组件、配置、时钟或 RNG。魔术师 priority-80、狼巫与捣蛋鬼 priority-100 的开夜继续归原 stage，保留 currentDay 在 World 之前的读取顺序。具体 frame 继续拥有资源、已付选择、映射及取消记录。

## 终结与白天映射

manager 经公开 ports 在原位置传入当前 World/day，保留 finish/close、内部 abort、外部 abort 的顺序和错误传播。原外部 finally 没有捣蛋鬼 abort，本批没有添加。

捣蛋鬼 finish 仍只写 finished，不写 closed；当日放逐映射继续有效。其原 abort 只关闭尚未 finished 的夜晚，重复 finish 及下夜替换继续由原 frame 决定。没有 acquired/closed 的额外门禁，也没有通用清理框架、第二 frame store、归档运行回调或新 revision。

## 有限证据与剩余边界

十个新 ownership 用例通过，31 次断言。明确 bootstrap-first 导入顺序下，三个原 frame 控制用例通过，25 次断言；一个真实必选行动失败前缀用例通过，77 次断言。该用例首次因 sandbox localhost listen EPERM 失败，自动审核批准后仅重试相同本机合成单用例，不调用模型。

最终有限类型与作用域职责头/依赖检查实际退出 0，11 个头通过，53 条历史依赖债务单独保留。独立审查核对完整 pipeline/manager 运行程序、14 个原 stage/frame/state/profile/maps 字节、14 处生命周期调用及公开函数身份。18 次原/新冷导入一致：主要入口成功，两处直接 profile 入口在原与现均遇到同一既存 TDZ；没有将它们称为成功或修复。

本批是一个原本耦合的清理交接职责，不代表三族完整 state/lease/effect/observation/codec 或整个 C23/P4 已验收。初失败与实际通过收据分开保存；完整阶段门禁继续集中运行。
