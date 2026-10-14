# 工具修复与配置规范化中文契约

基线为 `7654533073e46150ee7181e6de6bf49d5e3e211d`。范围仅 `game/mechanisms/llm/{contracts,helpers}.ts`、`common/{llm_repair,tool_specs}.ts`、`config/{contracts,normalizer_registry}.ts` 六个现有源，首 35 处精确注释编辑与末 1 处说明精度修正。六份实际 Git 完整前文与四个真实消费控制保存于 `generated/repair-config-chinese-contracts-before.json`，编辑逐项保存于 `-edits.json`；标识符、声明、导入次序、错误、schema、模型／产品／i18n 文案、指令与许可证不改。

## 有效说明

修复契约说明原可写参数与稀疏处理器表、目标候选和 World 的引用边界；readonly 不是冻结或许可。真实 ActionReception 先解析输入、修复候选，再做 schema 与具体作用域／领域预检，修复结果不等于接受或付款。`Number` 的有限转换保空串／布尔／对象等原宽度与异常；发言只在 nullish 时补空串，`String` 可执行调用方转换。投票先读弃权值，命中后不读取目标。

工具规格保原五项公开顺序与可写数组／内层对象，规格仅描述结构和提示，库存、票权、请求当前性与提交由具体机制持有。目标提示的角色标签及能力标识只选择提示规则，不当作真实阵营或使用许可。

配置规范化保女巫 → 警长 → 自爆顺序；原数组与处理器引用不复制或冻结，前一步返回值成为后一步输入，调用保方法 receiver。抛错停止后续项而不回滚此前副作用；接口不承诺纯函数或完整配置校验。默认 registry 在首次获取时创建缓存，获取本身不运行规范化；没有声称所有导入叶无顶层初始化。

## 验证与冻结

`-source-ready.json` 记录验证前冻结阶段；它的 `checksRun:false` 保留当时事实，正式检查由 `-receipts.json` 承接。唯一完整程序证明 `a94417` 实际退出 0：六份原文与当前全文精确正逆相等，630 个 typed AST 节点、114 个 NodeArray、818 个非注释叶；JSDoc tags／受保护指令保持（本源均为 0），十二份移除注释的 ES2022 ESNext／CJS 整输出逐字相同，四个消费控制仍同 Git 字节。唯一职责头检查 `efb02d` 实际退出 0：六根、709 个当前 Git 文档路径、零诊断。两个原脚本、报告、stdout、命令与真实退出收据持久保存，没有首失败或绿色复跑。

证明核对纯注释来源、完整语法和 emit，不执行生产模块、类型、业务、模型或全门禁；职责头形状不替代独立人工语义审查。本批源码 SHA 确实改变，后续源码身份按真实源码生成，不改历史档案身份或增豁免，也不宣称全部中文、55 机制或 P9 已完成。六源保持冻结，Git／进度由 Root 负责。

## 非作者单注释精度闭合

首检查后非作者指出：`Partial` 表可显式登记 `undefined` 覆盖此前函数，Map 实际保最后处理器值；没有有效 handler 时 registry 仍返回原参数副本。只将契约中的“取最后函数”精准改为上述实际规则，不改代码或接受面。首 formal scope／evidence／作者审／handoff、完整首 MD 与 contracts 前文原字节保存在 `-precision-before.json`；首 `-source-ready.json`、35 编辑、主 proof、头检查及收据全部保持。

唯一末桥 `6aded7` 实际退出 0：完整单注释正逆、146 typed 节点、20 NodeArray、179 非注释叶、两份整 emit 相同；首头及其它五源原字节相同，不重原绿色头或主证明。准备脚本时曾误判换行转义，Python 编辑器断言 `8abf23` 在写入前失败；原代码已经正确，脚本和产品未变，错误原文／输入保在 `-precision-receipt.json`，不冒生产或证明失败。本源最终 SHA 与末 ready／scope／evidence承接该单说明，实际共 36 处注释记录。
