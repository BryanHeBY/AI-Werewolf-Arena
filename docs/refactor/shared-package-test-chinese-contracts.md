# 共享包测试中文维护说明

## 来源和范围

实际 Git 基线为 `7dd49c9942eed59897def06ec36b8af23ee83518`。本批按只读翻译 manifest 选取 maintenanceLines 非空的 39 个既有路径：game-contract 测试 37 源（含仅编译的能力类型负例）、game-text 和 replay-contract 各 1 源。完整原文、mode／blob／SHA 与开工现行字节一致，存于 `shared-package-test-chinese-contracts-before.json`。directive-only、8 个 sourceAssets／moduleRelocations 目标及另一批 FE81 均排除。

45 条精确记录为 39 个完整职责头与 6 条原内联说明，不是新增 45 个 case。原 test 标题、断言、输入／预期字符串、机器 ID、日志／模型文本、导出／签名／运行语句不变；整条 `@ts-expect-error` 与原英文原因保持，程序化 JSDoc 类型／tag、许可证和工具指令同样保留。

四份整源 controls 为 game-contract 的 `inert-event-data.ts`、`board-schema.ts`，以及 game-text／replay-contract 的 `src/index.ts`。它们与实际基线 Git 同字节，本批不写这些生产 owner。

## 实际测试含义

- 标识类测试的预期来自原固定 Git 捕获的字面枚举／顺序摘要，而非新 canonical 实现生成。可运行角色枚举与公开含计划角色的目录分开；readonly 类型不让原数组自动冻结，原角色 ID 识别仍有私有 canonical 来源。
- 板子 schema 测试只验证结构、边界和可选字段，保留不求和、不去重、不应用胜利目标的接受面。事件／请求／结果 DTO 及 MessageRef 的类型负例只说明声明约束，不代表本批执行了类型诊断，也不建立运行许可、请求租约或字段格式政策。
- 各族事实按实际完整分支说明字段、日期、空值、隐私披露及 ID 数值上限差异；不统一套用 roster／领域 current 条件。历史、剩余次数或受众描述不等于真实库存和授权，所述 target／来源／死亡记录不重新触发规则。
- 奇迹／黑市商人完整选择与部分 resolved 前缀分开：部分结果可保留未知 outcome 原引用，outcome 校验是独立后继阶段；它不声称严格归档有效。不同浅 reader 对额外字符串／symbol 字段的拒绝或忽略、原型与描述符读取次序按真实分支保留。
- 共享 copier 的复制、数组／深度上限与原错误码由独立字面输入核对；普通数据反射仍可能执行 Proxy trap 或传播原异常，不能写成任意 Proxy 零 trap。原 getter 未调用断言仅覆盖实际描述符样本。
- 仅编译的七类能力文件用原写入和深只读负例说明公开数据渠道，扩展变量原接受面不收紧。两个函数不被执行，未把这些数据声明当作 live owner／World／parser。
- game-text 以字面双语输出和完整键／占位符对照为预期，角色名与实际 catalog 的比较另标为元数据一致性；用户原文仍作参数，显式 locale 不写全局当前语言。replay 用共享包既有 God／player 样本经过实际公共 reader，再核对字面归一化标识；未知历史值与用户／模型原文保留，版本／序号／非数据描述符在原边界拒绝。

39 源完整正文及相应公共 reader／schema／格式器／归档读取路径均已阅读。这里记录实际消费和手写预期来源，不将一次纯注释证明称为行为、所有角色或任意外部 API 验收。

## 实际首次检查

Root 唯一首 proof 为 `6355bf / session 14782 → a199dc / exit 0`：39 完整程序、45 条精确正逆；22486 typed nodes、4809 NodeArrays、31239 非注释语法叶、0 程序化 JSDoc tags、59 条受保护注释保持，78 份 ES2022 ESNext／CommonJS whole raw 输出相同。统计使用真实脚本遍历口径，不是行为覆盖数。

Root 唯一职责头检查 `1610b6 / exit 0`：39 源、738 个当次索引文档路径，诊断和中文失败均为 0。两次 stdout／stderr 原样重定向并保存；作者未运行工具，未复绿色或执行 tests／types／生产／模型／全门禁。SourceReady 的 `checksRun=false` 是首次静态冻结事实，真实后继收据见 receipts。

## 冻结

源从 `ad9fe957` SourceReady 起保持，scope／evidence 依其原序绑定。源码 SHA／行号自然变化，不修改历史严格身份或 sourceHash 政策。完整程序和职责头检查不替代中文语义独审；review／author／handoff 排除在作者 artifacts 外避免循环。Root 负责最终非作者审查、stage／commit／progress。
