# P4 A02 混合装配与 provider 并发交叉审查

日期：2026-10-08。接续 SDK/ACP 资源子批，开启混合执行；runner 并发错误收尾仍在下一子批完成。[预算与配置契约](../runtime-resources.md)。

## 三路发现与修正

- **A（架构/资源）**：发现浅复制 Map 仍引用可变 profile/provider，原 provider.maxConcurrentRequests 变更能使共享 cap1 的两个 SDK 请求同时启动。改为完整独立快照、同 providerName 配置一致性校验；原 Map 增删、kind/name/limit 变化均不改本局分派。补部分初始化 EEXIST 与已建 SDK close 原错同时保留。独立工厂7测试32断言通过；正常 quota/factory8测试41断言复核。
- **R（规则/权限）**：发现初始化不配合 abort、回收超时后仍释放名额让第二个工厂启动。Pool 记录不可证明回收状态；provider 在放名额前封住等待队列，并拒绝以后模型调用，晚到回收不自动解封。6s反例验证 factories=1、creating=1、排队/后续请求拒绝，晚到仍回收且错误保留。另补正式 wire 人格 oracle：继承/seat override/null清除经两种交错在两传输均验证。初次 fixture 把 agent人格写成对象，按既有契约改回字符串，未扩大生产 schema。独立资源/工厂11测试59断言及4个实际双语混合局+Tape通过，最终0阻断。
- **L（语言/记录/兼容）**：核对 actor名字/人格/locale、纯传输兼容、ACP maxConcurrentRequests 严格正整数、状态仅计数。纠正传输类型证据：每actor llm/acp在Tape与配置报告，不在现有manifest玩家摘要。live docs更新 mixed=true，记录kind新增mixed、原配置快照、按provider ID限流、失败封口需新runtime及旧拒绝码历史兼容。最终代码、文档与兼容复查0阻断；english-execution中共同接受语义已改为A01完成。

错误与预算策略仍由各具体 owner/工厂明确持有，没有 Agent 基类或通用清理框架。实现与修正均由主代理完成，审查只读。

## 主代理验收

- **388 测试通过、0 失败、29034断言**；后端 type、deps/import boundary、i18n scan、全部测试与 smoke。`/tmp/awa-p4-a02-mixed-release.log`。
- 完整矩阵17测试：原18局与新增16个混合局合计34个实际本地对局，S01/S04六人与S02/S03十二人、两种交错、两语、共享 SDK/ACP cap2，全部自然终局且正常零拒绝/回退，每局严格 Tape 重放。实际 wire 验本人名字/人格及无他人marker；手工winner/alive/day/stage/actions oracle保持独立。
- quota/factory11测试59断言：过期不初始化、force结束才交接、回收未证实不启动新工厂、深快照预算与路由、正整数config/同provider一致性、部分初始化与多owner关闭错误。
- 实际不同ACP provider各cap1独立推进，阻塞一组时另一组完成动作；最终agent/MCP/nested PID ESRCH，原资源物理门槛一起回归。
- 受限观察两板各25seed回归；前端/视频格式与呈现未变，沿用P3门槛。
- `git diff --check`通过。早期组合执行的6s故障回归遇默认5s测试上限，已为该故障用例显式设置15s，不改产品预算；最终完整门槛正常结束。

公开模板 six_player_mixed 只用示例既有provider/agent引用，不含真实认证。并发限额属于本运行时的provider配置ID，不宣称跨别名/密钥/进程全局控制或控制任意CLI内部的HTTP扇出。当前批完成混合与provider绑定/限流，完整A02/P4/G01–G04/扩展角色未被提前标完成。
