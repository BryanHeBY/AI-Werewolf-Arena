# P4 A02 Runner 并发失败与最终保存交叉审查

日期：2026-10-08。接续SDK/ACP资源和混合provider子批，交付runner统一错误策略。[资源与收尾契约](../runtime-resources.md)。

## 三路修正

- **A（架构/资源）**：发现只在请求启动前检查stopping，关闭释放合法迟到动作时仍记进Tape及阶段验证。selectedProvider在await结果后、录制前补封口。独立四组合回归4测试66断言通过：空/合法迟到 × 正常/写盘失败，原异常不替换、关闭一次、无pending与严格重放。代码最终0阻断。
- **R（规则/观测）**：独立14测试151断言与十二人并行放逐纠错probe。首个错误先录制再关闭，取消返回null后本地retry被停止入口拒绝，真实模型afterCloseCalls=0、无vote_summary、CP真实phase=voting/complete=false、决定无pending、close一次、严格replay一致。没有跳阶段/伪造冻结，业务请求字段和受众未改。代码最终0阻断。
- **L（语言/记录安全）**：发现旧recordedErrorName校验/返回各读error.name，变化getter能写入未校验文本。修正受控单次名字快照、拒外来getter及Proxy/prototype、捕获异常回退Error，保六种标准machine name。getter变化/throw/proxy反例、原类型与可允许data override通过；原错误文本/堆栈/认证/URL不进入错误证据。控制状态仍只在runner，既有scope/name schema和locale/display边界不变。最终代码、安全与文档复查0剩余阻断；原变化getter probe读取0次且无canary。

实现与修正由主代理完成，子代理只读。异常策略明确位于runner：缓存一次close、在途决定排空、保阶段第一错误，额外决定与cleanup/disk分别汇总；没有通用清理框架。

## 主代理门槛

- 后端最终release：**395测试、0失败**；type、deps/import boundary、i18n source scan、全部测试和smoke。`/tmp/awa-p4-a02-runner-release-final.log`。
- 收尾定向19测试198断言；安全与收尾/重放19测试209断言。四组合实际十二人阶段保存/严格replay原错与迟到成功拒绝，标准错误名与敌对getter/proxy覆盖。
- 34个实际本地双语纯SDK/ACP/混合完整对局、每局严格Tape、角色/persona/资源与固定seed模拟继续通过；实际ACP/MCP/嵌套进程与SDK HTTP回收门槛一起运行。
- `git diff --check`通过。无外部模型/真实认证读取。前端/视频协议未修改，沿用P3验证。

Tape仍为包含牌面/privateState/完整请求的私有复现资料；这里的安全证明只针对错误证据和认证配置不被写入，不泛称没有私有游戏事实。首个失败CP保持真实PhaseError，其他错误用已有controller/cleanup范围保存；失败Tape与public replay旧schema/严格兼容政策未放宽。

本批完成资源、混合、provider预算与runner收尾链路；P4还继续M21日志开关专项、G01–G04与随后角色波次，不把整个P4或64角色/22机制提前标完成。
