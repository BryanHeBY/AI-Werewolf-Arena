# C47 单文件格式稳定性后继

`e93a825f` 的全量格式检查仅报告 `reproduction-trace-causality.test.ts`。已安装 Prettier 对第一次输出再次格式化时，收紧两处 `trace.build().decisions.map` 链式换行；第二次输出再格式化保持稳定。

本笔只采用这两处布局。完整 AST、说明注释及 ESNext／CommonJS 输出结构保持；输出原文有布局差异，不称字节相同。单文件正式格式检查通过，独立审查确认正逆文本、原断言与调用顺序。

[精确收据](c47-format-idempotence.receipts.json)、[失败原文、完整源与独立审查](c47-format-idempotence.tar.gz)。旧构建保留 26 项通过、1 项格式失败及 1 项由 Root 中断的场景；新构建重新固定全部 42 项输入，不拼接旧绿。
