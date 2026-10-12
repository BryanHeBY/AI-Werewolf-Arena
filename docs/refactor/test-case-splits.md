# 混合测试的逐用例归属

## 第一批五个原文件

五个混合文件拆为十个目标，29 个既有展开用例各进入一个目标：LLM turn budget 的 10 个 unit / 1 个 HTTP，审计执行器的 2 个 unit / 1 个 MCP，私有归档的 2 个 reader / 2 个 filesystem writer，复盘版本的 5 个 reader / 2 个 migration/export，随机性的 2 个向量/发牌 unit / 2 个交错完整模拟。

原 callback、describe 前缀、外层 forOf 矩阵、断言及参数保持。六份必要纯 helper 是原字面 request 或 fresh archive loader，复制声明正文，未复制共享可变状态、业务算法或 oracle。原文件之间没有必须保持一起的可变因果 fixture；存在该依赖的其他混合文件按完整流程保留，不按文件大小强拆。

## 导入与验证边界

移除每个目标不使用的 import，32 个保留的相对绑定仍指向原实际模块。加载集合确实减少，例如 SDK 不再由纯 unit 直接加载；不能称整个原文件导入集合/顺序相同。独立审查核对省去的 13 个模块和实际 484 源模块依赖图，未移除必须的 setup/registration、listener、spawn 或启动行为；必要 cleanup hook 仍由原 preload 持有。导出入口的 main guard 不在 import 时执行。没有 argv 或 location 字面例外。

九个原 reader/vector 局部测试、77 次断言通过，未执行完整随机模拟或 transport。第一次有限类型检查报告四处并行 C24 context 未接线，未报测试候选错误；C24 真实接线后，同一整合批次包含十个目标的有限类型检查通过。原红日志保留，没有把未接线字段改成 optional 或放入 fake query。

## 映射版本

`generated/test-path-mappings.json` v2 保留既有行，支持同一 `from` 的明确一对多用例分配。旧 ID 必须全仓唯一，不能因为目标数增加计为新覆盖。计数分别为原文件、目标文件、映射边和旧展开用例；历史 candidate SHA 仍表示相应切片的字节，不自动等于之后继续修改的现文件。

本批后映射共 388 个原文件、393 个目标、393 条映射、4614 个旧 ID。完整重构的测试发现、旧覆盖与最终同源验收仍按 P9 执行；逐用例迁移不改变冻结的 P0 状态或重新生成 golden。
