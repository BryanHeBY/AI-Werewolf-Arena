# 历史来源与证据入口

本目录保存扩充与重构的原文件、审查、真实红灯和验收来源。它回答“在什么输入／commit上发生过什么”，不发布当前规则或工作指令。

- [扩充历史](expansion/README.md)
- [重构历史](refactor/README.md)
- [原路径→现落点](origin-paths.json)：每项保originCommit／Git blob／mode；只有定位，不执行任何脚本。
- 当前规则回到[rules](../rules/README.md)，当前契约回到[contracts](../contracts/README.md)，维护方法回到[guides](../guides/README.md)。

## 本轮最终来源

[最终验收入口](acceptance/refactor-final-acceptance.md)定位本轮固定输入与实际执行材料；受测源码为 `60fdbfbc57122eeb1d4e9204b66d4daec1eb0157`。后继 C48 矩阵／指南只发布对这些材料的解释和导航，元数据提交不冒充受测源码，旧轮或局部后继绿色也不拼入同源全绿。

当前职责仍回到[覆盖摘要](../architecture/mechanism-coverage-summary.md)、[行索引](../architecture/row-index.md)、[完整矩阵](../architecture/migration-matrix.json)及[支持边界](../contracts/mechanism-support-boundaries.md)。acceptance 的包摘要、成员和执行收据由各次独立审查绑定；下述 origin 守卫只保护两棵原始历史根，不替代这项验收审查。

## 如何引用与复查

引用来源时同时给原path、commit、输入／结果范围。旧文中相对链接和嵌入的artifact path以originPath为基准，经origin表定位currentPath；原正文、sourceSHA、工具脚本、stderr和停止条件不因搬目录被重写。

要运行历史程序，应检出对应原Git及依赖／原layout；不是在当前工作树运行归档脚本再把输出当旧输入。历史green不证明当前源码，历史pending也不表示已经交付的owner需要重复开发。

物理搬迁批必须与当前I/O读点、活跃链接和来源文档指向一起落盘，且不留第二活跃知识目录。origin表必须来自维护者明确指定的新Git逐项捕获；历史总数不能沿用旧5282观察。物理归档与当前I/O是否已通过，以该次真实迁移、完整性守卫和链接收据为准，不由入口页自动确认。
