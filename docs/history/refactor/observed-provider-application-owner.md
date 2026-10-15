# 玩家观察适配器归应用层

## 物理迁移 M1

基线：`53d40005e67cfbd33fb36f81c80de3f373f90759`。完整 `ObservedPlayersActionProvider` 从 AI providers 归 `app/observed-players-action-provider.ts`，24 个具名导入直接连接真实应用所有者，旧文件删除，无转发桥。

M1 保留原构造三参数、整个类、提示策略初始化及 `getAction`，只调整四个内部物理导入路径。没有引入新公开根出口，原本就通过直接叶路径消费。完整类程序一致；24 个消费者仅逆各自具名导入后完整程序一致，原回调、矩阵、断言及构造实参均保留。

实际原 Git 的 25 个来源保存于 before。M1 捕获时，两个共享测试已经有独立 O3 投影导入和中文职责头，所以其 working-before 是明确后一层来源；其完整 before/after 被保留，不能冒称原 Git 只有 M1 差异。其余 M1 来源与实际 Git 保持同一输入。

M1 后同一适配器另笔完成提示依赖退出 M2，见[观察装配与提示分离](observed-provider-prompt-separation.md)。两层均按冻结字节独立提交。中文关键职责进一步在 M2 补齐。

[完整冻结迁移候选](generated/observed-provider-move-candidate.json)、[原 Git 来源](generated/observed-provider-before.json)、[完整程序证明](generated/observed-provider-proof.json)与[执行收据](generated/observed-provider-receipts.json)记录范围。M1 没有单独重跑测试或编译；实际检查属于最终 M2 汇合状态，不伪称中间构建单独全绿。物理依赖图、路径及严格来源身份真实改变；历史身份不改写。
