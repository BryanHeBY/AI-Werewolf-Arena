# P3：运行说明与CLI交叉审查

日期：2026-10-08。范围：逐调用CLI显示语言、运行/观察文字、warning数据与报告、默认bot文本、双语人格示例及前端离线CLI失败说明。

## 三路发现与关闭

| 代理                     | 独立重点                                                             | 结果                                                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `review_arch_tests`    | 局部display context/配置副本、CLI原错/exit、迁移事务与循环、入口范围 | 迁移默认warning缺key会导致apply改盘后报失败；补两语模板，single/batch报告预构建，再保持原出版/回滚。真实英文preview/apply复查成功。export/smoke最初漏统一，现都接入；前端离线命令也有独立安全说明。0剩余阻断                            |
| R `review_scope_rules`   | fallback策略、技能/受众、人格偏好与语言、报告/文档                   | 未改变目标/技能/end_chat/竞选/资源；bot只改系统拥有的默认语言。12席人格有共同规则/信息边界，策略不是新增能力。预检与原文/元字段范围准确，0剩余阻断                                                                                      |
| L `review_i18n_delivery` | 模板/legacy IDs/未知值、raw/locale隔离、前端error反例                | 补schema_not_supported/record_invalid等固定Tape ID，不恢复namespace正则；陌生prompt role不查缺key导致fallback。前端loader ref getter能带入canary；现own descriptor/封闭5消息/严格HTTP status，原probe getter0次/canary不可达。0剩余阻断 |

## 验证

- 后端完整release：313通过/0失败；类型、边界lint、测试及smoke通过。`/tmp/awa-p3-runtime-release-final.log`。
- 前端：48单测/0失败，类型与构建通过；新前端CLI反例/命令运行只走失败预检，不打开浏览器/服务。未重复I04已有画面/E2E门槛。
- runtime_display + 原配置安全：13测试274断言；真实多命令中英失败、配置成功/source hint与显式display、structured warning/private值不输出、正常migration preview/apply及single/batch展示错误均无写盘、原竞争/回滚测试。
- 既有console测试迁移了说明格式，UTF-16分段/消息边界/重复状态去重不变；陌生role、tool role、raw/model内容及machine IDs独立对照。
- Baseline中英文文字人工oracle，实际目标/方向/竞选/狼刀等价；默认遗言/狼聊在游戏语言下生成。
- 十二席公共fun例两语均完整解析，12名字/12不同风格、无missing-language fallback；没有执行模型或读取真实认证。
- Getter/namespace字符串/坏模板/越界或非数HTTP status/额外params拒绝，合法loader说明保留。
- `git diff --check`通过。

文档[runtime-display.md](../runtime-display.md)明确flags、warnings API变化、raw与默认bot差异、CLI/程序化职责和vendor输出例外。P3整体英文运行gate保持；配置能显示英文不能代替真实SDK/ACP整局、Tape英文重放或64角色验收。P4–P10完整目标不缩小。
