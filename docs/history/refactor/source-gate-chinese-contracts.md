# 源码检查工具中文职责说明

基线为实际 `e601e69a0c0904785f5e95e33a1bb56153a43bfc`。仅三个既有工具源的注释：`check_import_boundaries.mjs`、`import_boundaries.cjs` 与 `check_i18n_literals.mjs`。前两者补有效中文职责头；i18n 工具的英文头和两处英文说明译中文。

## 真实职责与范围

- 旧导入 CLI 从原 cwd／argv 取得根，默认 `src`；按原目录项读取 `.ts` 并识别 import、export、require、动态 import、类型导入和 import equals 的字面模块名。它不执行所扫模块，也不新增根路径 realpath 或其它扩展名发现策略。
- 纯路径判定器保存原层级表与 `find` 次序。相对／绝对路径仅规范化、去原后缀；包名不匹配、目标文件不解析，返回 null 不能当作所有角色／包结构已经合法。
- i18n 入口只扫描固定公开源码，逐段拒绝链接根并跳过链接项。登记翻译 owner 的 exported const `zhCN` 对象只有直接值豁免，键名和相邻表达式仍检查。例外按文件／文本／次数匹配，过多、过少或消失均沿原失败政策。

注释分清两种原工具职责，不改变门禁政策，不增加目录／翻译豁免，不翻译错误码或输出。原 JSDoc 的 `@param`、`@type` 类型指令及 shebang 保持。

## 完整纯注释检查

十二项精确说明编辑逆回三个完整实际 Git before。真实 `5a50c3` 退出0：完整 JavaScript AST **1,664节点**、全部 **2,041个非注释语法叶**和六份 ESNext／CJS 原始输出保持；实际495个已跟踪文档路径，职责头和中文首头均零诊断。

只运行本批有界源码对照，没有执行三个原门禁、测试、类型编译或对局。说明的准确性另由独立读取实现审查；不主张全部源码中文化或 P9 完成。源码字节改变只影响新构建指纹，历史证据与旧报告原字节保持。

[冻结范围](generated/source-gate-chinese-contracts-scope-final.json) · [完整对照](generated/source-gate-chinese-contracts-proof.json)
