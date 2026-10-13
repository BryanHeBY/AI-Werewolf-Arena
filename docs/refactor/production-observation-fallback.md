# C33a／F01：生产回退只消费玩家观察

## 实际职责与输入

实施前政策已在 `ee7ace8a` 冻结，见 [回退政策](fallback-observation-policy.md)。SDK、ACP 默认 provider 与运行装配均退出旧 Baseline 注入。可信适配器通过原 `PlayerPromptPolicy.buildObservation` 脱离并冻结快照，再交给 `ObservedPlayerStrategy.decide(observation)`；策略仅持语言与观察，不获得 World、真实阵营或私有角色容器。

新默认策略复用既有竞争型工具 handler，固定 `next() = 0` 选首候选，不推进游戏 RNG。65 工具对应 64 个行动 handler，`report_bug` 明确返回 null；发言、狼聊和席位奇偶方向沿用旧形式。null 是终止不行动，undefined 才尝试下一工具。引擎仍负责最终资格、目标、库存与付款校验。

这是一笔明确的策略变化：六席相同可见观察下，旧 Baseline 因另一角色隐藏 camp 改变而选择 3／2 号，新策略均选择 2 号。旧轨迹、seed、golden 与规则不重写。

## 生命周期和显式特权测试

原严格回退门禁在投影与决策之前执行，禁回退时不调用策略。期限、取消、关闭、别名传播和记录的 owner 保持；适配器直接返回策略 Promise，不增加等待或预算。

旧 `fallbackProvider` 测试注入明确改为 `privilegedFallbackProvider`，仍按原路径收到请求／context。35 既有测试仅同步接口名称和中文说明，输入、断言和动作保持。生产 factory 不注入特权入口；旧 Baseline 和角色 callback 暂限显式 mock／规则测试，后续 C36／C44 继续退出。

## 验收与交叉审查

精确范围为 43 源码／测试路径。新默认路径与严格门禁、冻结 DTO、特权接口用例 7 通过，19 assertions；原回退／期限用例 19 通过，59 assertions。最终有限严格类型检查 session 66544 实际退出 0；旧接口和 World 访问 3 个类型负例的 session 44967 实际退出 0。

35 旧测试完整程序仅允许接口名称逆迁；43 中文职责头无问题。两路独立审查分别核对真实 Git 来源、生产装配、64 handler／诊断弃权、34 非构造成员和严格生命周期控制，最后 43 SHA 全同，均无阻断。完整证据见 [固定摘要](generated/production-observation-fallback-evidence.json)。

首轮新测试的错误 fixture／严格拒绝预期及第二次无效 stage 类型诊断保留在执行日志，修复仅发生于新测试。注释增量说明权限、null／undefined、随机性与预算边界。

## 尚未完成的范围

此批关闭默认生产回退的 World 决策漏洞，不宣称完成 C33／C34 全观察投影、C36 角色贡献或 C44 全旧出口。未重复模型、全量游戏、发现或浏览器；P9 同源固定输入全量验收继续待执行。
