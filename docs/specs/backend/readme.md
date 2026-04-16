# backend specs

树形分层：
1. `foundation/`：长期核心规范（架构稳定层）。
2. `evolution/`：短期迭代规范（当前实施层）。

规则：
1. 新增短期任务优先放入 `evolution/*` 叶节点。
2. 当迭代沉淀为稳定约束后，可上移到 `foundation/*`。
