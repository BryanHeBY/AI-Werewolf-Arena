# P9c 阶段全量收口

P9c 最终同源阶段门禁通过；角色目录仍 44/64，P9d–P9f、P10 与 T6 范围保持开放。本轮不推送。

## 初次完整后端与修正

基线 `58d7fae`。证据目录 `/tmp/awa-p9c-accepted`，1385 项输入 SHA256 `e0f92486f400fb9a58cef4796a1eccf897c9632ddf65182c48f957053855dec8`。执行前和重试前一致，源码／测试未在运行中修改。后端初始计划为 364 个唯一文件：120＋119＋118 分片及 7 个串行时序文件；独立审查确认无遗漏／重复。

初始三个分片结果为 1647/0、1848/0、1621/1（pass/fail），357 文件，合计 5116 pass／1 fail。唯一失败是机械狼组合测试的 OrderPrince bootstrap 错误码期望：实际新有限板检查报 order_prince_preset_invalid，旧逐角色枚举表遗漏该项。R 和 A 独立核对 `75ce319`、公共契约及解析顺序，确认应只补 bootstrap 测试期望，不改生产；公共 parse 与 configDiagnostic 仍保持通用组合错误。原失败整文件串行重试仍 39 pass／1 fail，排除仅靠并发推断原因。

初始临时驱动解析 Bun 尾部重复失败名称时，误把最后文件 victory_record 也加入重试，额外运行 17 项通过；该结果不计作新增覆盖或问题修复证据。真实 mechanical_configuration 重试随后失败，driver exit 1，未继续串行时序、前端、构建或浏览器。因此本轮不是阶段验收通过。后续 driver 在 summary 列表前结束失败文件采集，保留此错误及原日志。

配置期望修正后受影响整文件与公共规则契约合计 65 项零失败，见 `/tmp/awa-p9c-prince-expectation-green.log`。一次 formatter 因从 backend 使用 root 相对路径报未找到文件，随后从 root 正常格式化；不将该失败命令记为通过。

## 验收输入清单补齐

独立 A 审查发现初始 fingerprint 漏掉实际被门禁读取的 root bunfig.toml 与 docs/expansion/i18n-source-exceptions.json；初次运行中它们未修改且等于 HEAD，但仍不能宣称初始清单涵盖全部输入。最终 driver 补入这两个文件及影响枚举／格式检查的 .gitignore，重新执行完整阶段门禁，不把初次通过分片冒充新指纹的全量。

最终证据在 `/tmp/awa-p9c-final-accepted`，基线 HEAD `1035cd9`。1388 项输入清单 SHA256 前后均为 `132720fe1a96d535252ff9696819980a12cdf2889f12dd0e446768f6c118ac45`；本次零失败，无重试。源码、测试、公开配置及实际构建／门禁输入完整纳入，文档叙述不参与执行指纹。未来炼金／狼鸦候选仅在 `/tmp` 准备，没有混入本次已支持功能的验收。

| 门禁                   | 实际结果                                     |
| ---------------------- | -------------------------------------------- |
| 后端三个互斥文件分片   | 1647/0、1848/0、1622/0；357 文件             |
| 后端时序文件串行       | 42/0、231 断言、7 文件                       |
| 后端完整有效覆盖       | 5159 pass、0 fail、503019 断言、364 唯一文件 |
| 前端单元               | 498 pass、0 fail、5014 断言、63 文件         |
| Chromium 全量          | 240 pass、0 fail；单 worker、零 retry        |
| root check/lint/format | 全部 exit 0                                  |
| diff、smoke、双端构建  | 全部 exit 0                                  |

review_configuration_closure 负责文件覆盖与清单复核，review_scholar_rules 负责规则及错误优先级，review_scholar_delivery 负责最终范围与交付证据；原功能的 R/A/T/L/D 问题已在各笔记录中闭合。主任务保留日志、修正实现／夹具，不由审查代理改仓库。上述结果证明 P9c 已支持范围的技术回归，不扩大角色组合、不冒称真实模型 T6 或 P10 发布验收。
