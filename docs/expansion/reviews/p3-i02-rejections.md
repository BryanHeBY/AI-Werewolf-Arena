# P3 I02 结构化拒绝交叉审查

日期：2026-10-08。范围：稳定RuleError/RuleViolation、规则网关与SDK/ACP游戏/审计错误解释、局部Zod诊断、控制面异常反馈。

| 代理 | 首轮发现 | 修正及最终复查 |
| --- | --- | --- |
| `review_scope_rules` R/T | 校验条件、顺序及消费没有变化；自定string不能因同形代码被改译 | 内置明确返回RuleViolation对象，所有非空自定string保原文，空string保持允许；23定向测试3555断言通过。修正交叉复查14测试529断言，0阻断 |
| `review_arch_tests` A/T | 通用toolFailure调用参数化turn_id_mismatch会抛；旧error-only callback不应被required message破坏 | 通用error解释无占位，动态turn/tool独立模板，unknown不与fallback模板碰撞；ACP回调message可选，registry按任务补齐。独立14测试529断言，0阻断 |
| `review_i18n_delivery` L/D | error从中文理由变code、registry返回类型变化及旧记录政策需要明确 | i18n文档补API迁移、旧原文/Tape hash/public兼容和P4未统一接收边界；builder/回调和同形原文最终复查0阻断 |

## 验证

- 后端release254测试0失败，类型/依赖/边界/整局/回放/烟测通过。
- 14测试529断言覆盖实际SDK两步HTTP纠正过期turn和缺药、四个并发中英游戏/审计MCP、局部schema错误后合法行动仍可提交。
- 十二个gateway拒绝判例各运行两语言，及守卫连续目标；检查稳定code、消息和私有资源/存活/票权不变。
- 自定字符串、同形code字符串及空string保既有语义；旧error-only ACP回调仍能运行。
- 控制面认证、session、route检查保留；坏JSON不回传私有片段/内部异常。
- 内部gateway reason仅code；显式昵称/人格/历史文本不改，失败packet增加message，消费者用code判断。
- 没有调用外部模型；P4统一业务接受及规则修正、其余P3审计/终端/记录/展示仍继续推进，英文runner尚未开放。

三路最终复查剩余阻断：0。
