# 动物梦境完整状态槽贡献

子狐、河豚、白猫的状态捕获、原槽唯一替换、JSON 编码／解码及失效检查实际归入 `animal_dream/state-slot.ts`。三份贡献表绑定原 factory、schema 和纯转换，authority 的真实安装、付款、死亡过滤、到期及快照均消费它们。没有额外状态仓库。

生命周期、生命版本、窗口租约、目标和永久停止仍由 authority／roster 维护。状态槽不会授予行动或死亡资格；解码仍先取得原 JSON.parse 函数，再读取原 json getter，不新增 schema 校验。替换保持 privateState → live state → json 的已提交前缀；写入失败不回滚。

原三 factory 与 schema 出口及 profile 引用不变。完整迁出函数、剩余 authority、完整 schema／工厂／转换程序分别通过作者与独立审查的真实 Git 逆证；Root 另核对所有权、规则时序和接口边界。[固定证据](generated/animal-state-slot-evidence.json)保留实际路径、摘要、首次失败和最终收据。

有界首轮 7 项中 6 项通过，一条新测试构造了混合 descriptor，修正后只重该条，1 项通过；没有重复此前通过的 6 项。新 matcher 的类型诊断仅加类型注解，字面输入不改。最终合并有限类型进程 27644 退出码 0，范围为本轮 244 个修改／新增 backend 根，包含本批四路径。

本批完成 Animal 三族完整 state contribution，其他角色与 C17 全仓状态矩阵继续执行。没有运行整局、计费模型或全量门禁。
