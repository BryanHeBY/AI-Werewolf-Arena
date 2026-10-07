# P3 I02 审计任务交叉审查

日期：2026-10-08。范围：SDK/ACP共享审计提示、检查/总结任务语言、实际ACP/MCP与SDK通路、审计诊断投影。

| 代理 | 首轮发现 | 修正及最终复查 |
| --- | --- | --- |
| `review_scope_rules` R/T | 提示语义、初始化、证据及工具授权未扩大 | 检查任务重试语言固定、总结语言独立；追加投影/作者归属及完整pipeline复查，11测试185断言通过，0阻断 |
| `review_arch_tests` A/T | 建议补完整generator→pipeline两语言组合，而不仅分别装配Runner/Renderer | 两种相反检查/展示语言完整并发管道，所有任务有效Agent/MCP PID退出；未知诊断/fallback合成探针及16测试341断言、类型检查通过，0阻断 |
| `review_i18n_delivery` L/D | provider原异常reason/input/output会直接进入agent_logic，合成秘密标记实证可达 | transport scope改白名单事实/稳定reason投影，不传原异常和任意input/output；zh/en getContext拒漏且保领域参数/原话，原记录不动。最终复查0阻断 |

## 验证

- 后端release264测试0失败，类型/依赖/边界/既有对局/回放/烟测通过。
- 16定向测试341断言，包括四条实际ACP→session→MCP审计通路和六项实际SDK HTTP（游戏、审计检查/总结分别中英）。
- 两个完整generator→pipeline并发组合：en检查/zh-CN总结与相反组合；每局三检查任务和一总结任务，核对实际注入语言、授权context及全部有效子进程PID退出。
- 合成传输异常秘密标记在中英getContext中不可达；领域guard_repeat/参数、玩家原话和诊断runtime_error保留，输入记录未改。
- ACP初始化不调用工具，实际任务才有有效ID；过期审计ID仍拒绝，原始模型返回文本不改译。
- 没有外部模型/认证调用。固定Markdown标题、确定性renderer/fallback和启发式仍下一批；英文runner未开放。

三路最终复查剩余阻断：0。
