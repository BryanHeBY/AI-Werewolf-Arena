# P3：错误诊断交叉审查

日期：2026-10-08。范围：模型/ACP/记录/审计错误输出、结构化私有诊断、CLI异常输出和逐上下文展示语言；英文整局仍受阶段gate约束。

## 独立三路与修正

| 代理 | 重点 | 发现与复查 |
| --- | --- | --- |
| A `review_arch_tests` | 实际SDK错误、读取安全、metadata/资源/错误策略、CLI | 原生DOMException分类漏失，现通过内置品牌getter正确分类且遮蔽getter不执行；小数1.001秒精确换算1001ms。configDiagnostic直接getter可能令catch二次抛，现data descriptor/Proxy保护+closed code名单。旧ACP raw error文案测试迁移。全部关闭，最终0阻断 |
| R `review_scope_rules` | 429推断、原动作/资源/受众、旧档、审计scalar与归因 | 不推断日限额，不更改fallback/SDK retry/资源策略；旧原文不重写。filesystem说明曾过窄误称记录故障，现两语为通用文件系统操作失败。最终0阻断 |
| L `review_i18n_delivery` | 两语言与数据独立、exception字段、audit输出白名单/文档 | 记录warn误用game locale、检查warn误用inspect locale，现独立transient displayLocale。audit先assert再clone可被变化getter绕过；原探针复现，改shared data-descriptor decoder验证实际snapshot，复查getter0次/canary不可达。全部关闭，最终0阻断 |

私有reader也校验实际克隆对象/版本，避免未知对象值变化后逃过声明的结构；正常旧JSON精确metadata转换和raw/unknown保留不变。没有创建Agent基类、取消框架或新的业务清理策略。

## 门槛证据

- 最终后端release：304通过/0失败，类型、依赖边界、测试与smoke通过；`/tmp/awa-p3-diagnostic-release-closed.log`。
- 前端：45单测/0失败，类型与构建通过。此次不重复无变更的浏览器交互/视频门槛，I04既有证据仍在其审查记录。
- 新diagnostics + private契约/config安全/console：27测试242断言通过；`/tmp/awa-p3-diagnostic-targeted-final.log`。通用filesystem说明收尾仅重跑相关13诊断测试，全部通过。
- 真实本地安装SDK HTTP401：一次请求，既有非重试策略保持；合成apikey/response body/headers标记没有进入新私有错误或终端。
- 实际SDK RetryError构造的429，LLM/ACP×中英、逆向displayLocale、fallback动作/次数和ACP关闭次数核对。
- message/fieldPath getter、Proxy探测异常、原生DOMException、JSON hooks、环/深层、精确Retry-After/非法header、额外诊断字段、logic/player变化getter和实际返回快照反例。
- 实际run_game CLI坏providerJSON：退出1，无秘密标记或二次uncaught stack。旧错误原文和玩家prompt/thinking/speech不当作需改译的诊断。
- audit只接收严格scalar metadata，没有恢复任意transport input/output；原始输入保持不变。

验证未访问外部模型，也未读取真实认证/本地配置内容。具体协议和限制见[error-diagnostics.md](../error-diagnostics.md)。本批是异常边界交付；P3系统说明/CLI双语与整体英文运行门槛继续，P4–P10及64角色/22机制目标仍完整保留。
