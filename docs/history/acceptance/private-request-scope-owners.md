# 请求原句柄的私有世界归属

以 `6c48dffc` 为前态。`InitialIdentityScope.world` 与 `WildChildBinding.world` 退出，世界归属移入本族所有者私有 WeakMap。原句柄和资源引用不变，也没有公开反向查询世界的方法；原请求、生命、状态、付款、关窗和转换仍沿原权限算法执行。

真实窗口测试增加两项边界：原句柄没有 World 回门，复制字段并额外补入另一个 World 仍不能成为原句柄，也不污染原请求。九份相关测试实际 **143 通过、0 失败、1484 断言**；完整后端测试类型项目退出 0。非作者静态审查无具体 finding，未重跑检查。

[收据](private-request-scope-owners.receipts.json)、[独立审查](private-request-scope-owners.peer-review.json)和[原始封包](private-request-scope-owners.tar.gz)保存三份实际输入及输出。[迁移指南](../../guides/migration.md)说明字段退休。类型检查发生在后续目标提示改造之前，不覆盖后续代码；本笔也不声明其他句柄或完整运行扩展已收口。
