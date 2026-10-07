# P3 I02 终端事件交叉审查

日期：2026-10-08。范围：基础/七角色/警长/遗言chat、judge、live双语说明，查询注册器和runner展示语言传递。

| 代理 | 首轮发现 | 修正及最终复查 |
| --- | --- | --- |
| `review_scope_rules` R/T | nullable狼刀target被nonnull断言掩盖，翻译参数导致异常 | 目标使用String(null)保原显示，不改校验/生产；11presentation测试315断言、diff检查通过，0阻断 |
| `review_arch_tests` A/T | 逐调用locale、typed handler与资源边界正确 | 追加空目标交叉复查；24tests352断言及类型检查通过，0阻断 |
| `review_i18n_delivery` L/D | 默认字典应共用目录、定制原文及私有开关旧语义须说明 | 默认查共享资料，legacy Contributor由同一来源生成；API缺省zh/unknown与原文边界、privateFlag实际旧策略文档明确，复查0阻断 |

## 验证

- 后端release275测试0失败，类型/依赖/边界/实际SDK/ACP/MCP/对局/回放/烟测通过。
- 24定向测试352断言：全部既有终端分支、英国内置文本无汉字、原始事件对象/kind不变、privateFlag双语言同谓词。
- 空/非空守护、药与查验、狼刀（含公开类型空目标）、夜聊/结束、遗言/枪/白痴/自爆、警長候选/退水/票型/徽章/方向、两类终局都覆盖。
- 实际ConsolePresenter wrapper检查英文前缀、中文玩家原话及占位字样不翻译；64角色名称与unknown/custom查询验证。
- 机器replayStage与AI/玩家受众未改，终端按既有运行者观测策略。中文列表标点和空名单显示略规范化，规则/资源/票权不变。
- 没有外部模型调用，未开放英文runner。I03/I04及剩余日志/阶段总验收继续推进，未把本批当P3完成。

三路最终复查剩余阻断：0。
