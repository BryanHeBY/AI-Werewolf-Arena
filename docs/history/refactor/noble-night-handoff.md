# 贵族夜间交接

## 所有权

`NobleNightUnit` 持有流水线原有的 acquired/transferred 状态，按原顺序开夜、发布通知、取得 checkpoint、发布开夜事实和调用引擎提供的 required recorder。World/events 每次访问仍委托给原流水线；构造不读取它们。机制不控制阶段或记录 I/O。

正常路径在原 `nobleHandedOff = ownsNoble` 位置移交，早于剩余 handoff 和返回字段求值。此后流水线不再 abort。若后面的返回字段 getter 抛错，原有已移交前缀仍保留，不能为方便清理而改成流水线重新持有。

PhaseManager 从该次执行的接收端，在原三个位置传入自己的 World/day：中断 abort、expiry 后正常 close，以及 finally abort。接收端没有 closed 标志；正常 close 后直到实际 bodyResolved 之前，authority 仍允许原 finally abort。bodyResolved 后的 no-op 也继续由原 authority 判断。

## 中断与内部数据

最早的 current=false 返回发生在配置所有权读取之前，只建立不捕获 World/day/config 的 abort 接收端。两个 try 内中断返回使用该 execution 的同一接收端，流水线 finally 与阶段管理器原本的第二次 abort 均保留。流水线抛错时，PhaseManager 的 await 仍在后续 settlement try 之外，没有新增兜底清理。

接收端作为不可枚举 Symbol 放在原结果对象上。对象本身、数据引用、Object.keys、JSON、普通 spread 和 Object.assign 保持；Reflect.ownKeys 有意新增一个内部 Symbol。复制结果不会转移隐藏所有权，缺失时明确报错，不静默跳过清理。该端口不进入 game-contract、请求、MCP、checkpoint 或 Tape，也不使用全局 receiver 缓存。

原 body expiry、damage、请求权限、资源、通知知识和录制字段均未改；本批只完成具体开夜交接，完整贵族机制迁移仍有后续矩阵要求。

## 验证

十个有限单元测试覆盖 getter/回调顺序、开夜和通知/required record 失败、同一接收端、最早及 try 内中断、普通序列化边界、正常 close 后的两种 authority 状态，共 60 次断言。另一个实际原生 N1 场景执行完整 Demon potion delivery 后注入返回字段错误，验证移交后的错误和已发布前缀，四次断言。

原阶段管理器 N2 好人和狼仆从两个场景、12 次断言通过；有限四测试项目类型检查通过。首次测试中的错误导入和通知名只修测试；原生 N1 的首次省略 potion delivery 导致缺来源红，改为执行默认原生阶段，生产代码未绕开校验。全部原红日志保留。全静态检查的两个新增测试层级头缺词已补准确 Unit 描述，局部责任头检查通过；全量同源验收后置。
