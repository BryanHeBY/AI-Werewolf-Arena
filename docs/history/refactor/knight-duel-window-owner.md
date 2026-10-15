# 骑士决斗窗口归本族所有

## 范围与归属

真实基线为 `7ebd217ccd4d43b7f27e826fe2dec4a21ffbcdcd`。原引擎 `knight_duel_window.ts` 的完整 123 行程序、参与者结构和 class 迁入 `game/mechanisms/roles/knight/duel-window.ts`；旧物理入口删除，无转发桥。范围为六个现行源和一个删除项，保存六份实际 Git 原文与四个稳定控制源。

本族 `ports.ts` 公开原窗口 class 与原 `getKnightState` 绑定。窗口直接读取本族 `./state`，不反向导入自己的 ports。规则组合以及三个原测试只调整 class 的导入路线；Day、Voting、PhaseManager、状态与提交算法不改。

请求参数使用已有 `ActionRequestConstructionPort`，从具体工厂类型转为仅要求同步 create 的结构端口。此处静态接受面明确扩大，运行 create 方法、receiver 和输入读取位置不变，不声称完整类型树相同。

## 保留的规则与失败顺序

- 原空结果在本次调用内共用；先核 current 和配置窗口，再扫描是否存在可决斗骑士，之后才捕获完整存活名单。
- 参与者保留 Alive／Role 引用、生命版本及原角色／阵营字段；骑士在请求前读取库存，Promise.all 保留原名单排列，候选按编号尝试。
- 等待后按原短路顺序复验演员、同一库存、目标生命；网关预检前后都执行 valid，不把预检成功当付款、死亡或阶段提交。
- 只有有效候选才报原 `knight_duel_commit_missing`。提交明确 rejected 时继续下一项；原 await 完成后，night／terminal 才令 endsDay 为 true。提交异常传播，已有写入不退款；不新增提交后的复验。
- 具体提交仍拥有库存消耗及事实／死亡提案，经理仍拥有实际死亡、阶段和判胜。接口的只读类型不构成运行权限屏障。

中文说明覆盖参与者引用、字段捕获、并发排列、两次复验、提交要求及失败前缀。三个既有测试全部名称、fixture、字面预期和执行体保持原文。

## 验证及限界

[原文](generated/knight-duel-window-owner-before.json) 与[精确编辑](generated/knight-duel-window-owner-edits.json)完整对照六个程序。首次有效[证明](generated/knight-duel-window-owner-proof.json)核 23 个编辑；当前完整程序仅逆路线、新增出口和声明类型后，12 个 ES/CJS 输出与原程序相同，中文说明仍保留。首 Node 执行因子进程 git 的 EPERM 未完成；同一脚本改用 Bun 后实际 `05474d/session31437 → 98833c` 退出0，产品未因该失败修改。

公开入口职责头首六根检查只有该源缺时点项；只重失败源，第一次补白天阶段仍红，最终准确补原检查时点后 `a022a4` 零诊断。最后一个编辑只改该头，现共 24 个精确编辑；[单源桥](generated/knight-duel-window-owner-head-bridge.json)将两个采样阶段接到最终 sourceSHA，完整非注释 token 和四个输出相同（`e1d11f`）。没有重跑其余五个头、运行用例或类型。

[收据](generated/knight-duel-window-owner-receipts.json)：六个有限根类型 `64dc98/session91242 → 6edfc3` 实际退出0，空日志本身不是退出证据。原骑士中英迟到原体／库存／目标矩阵两例38断言（`337046`），原白天组合构造顺序和实例一例12断言（`ab667f`），首次各一次，共三个不同用例50断言，均退出0。

六个当前源码根的字面旧入口引用为零，不覆盖计算路径、历史 generated、私有配置或仓外代码。新 ports 增加 class 值重导，模块加载路径与导出描述符是实际接口变化，不承诺任意旧物理入口／模块反射／冷初始化图相同。头中文字节及目录改变严格 sourceHash，历史指纹不改；有限类型的传递依赖按当次读取，不把并行 PM 改动当成本批冻结闭包。

本批只完成骑士选择窗口归属；未执行整局、模型、全测试或全门禁，也不表示 C17、C45 或最终 P9 全部完成。
