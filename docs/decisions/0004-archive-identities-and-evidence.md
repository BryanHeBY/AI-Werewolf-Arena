# ADR 0004：档案兼容、构建身份与真实证据

## 选择

公开reader与内部严格复现分开；四类新写入档案显式声明身份，旧裸格式按各reader支持政策处理。严格source／lock／RNG／ruleset不因语义版本相同或目录纯迁移而豁免。

## 理由

路径、注释、词典、未执行schema与package resolver都是实际构建输入。只hash某些“业务函数”会漏掉影响加载、语言和接受面的变化；回写旧hash会把不同构建冒成同一来源。

## 后果

历史归档、原fixture和首失败输出保字节与origin；currentPath／新input／后继source阶段另登记。原绿采样不因晚类型／comment桥被说成末源重跑；不同test声明／fixture调用／expect执行分开计数。独立审查核真实算法／prefix，不只签哈希。

历史脚本物理归档后原字串不重写；要复跑取原Git。origin索引是定位数据，不是执行包装器。当前I/O读取冻结baseline改落点，基线内的origin字段仍原样。

来源：[显式身份](../history/refactor/explicit-archive-identities.md)、[清单／玩家身份](../history/refactor/manifest-player-archive-identities.md)、[双构建方法](../history/refactor/differential.md)。最终同源全套及兼容矩阵仍单独验收。
