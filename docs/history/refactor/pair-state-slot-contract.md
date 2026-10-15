# C17 Pair 完整状态槽贡献交付

来源为实际 Git `d5a71042195a6570d975cd04f948ee944477e055`，仅 3 个生产源与 1 个新单元测试。四路径摘要见 [固定证据](generated/pair-state-slot-contract-evidence.json)；原 3 源逐字核对实际 Git。

## 实际职责

- `state.ts` 保留唯一原 factory/schema/纯状态变换，只补中文说明。
- `pair-state-slot.ts` 持有具体 Pair 契约：原 factory/schema 引用、唯一追加写命令、原 trusted JSON codec，以及原六别名／提交数据失效检查。没有第二 store 或通用状态层。
- `authority.ts` 的安装 schema、查验 commit、完整 current 检查和两处真实检查点输出消费此契约。生命、阵容、租约及完整／失败读取权限仍由原 authority 持有。

## 保序与归档

六别名原顺序 → Fragrant schema → Pair committed JSON 未变。写入保持 `assertWritable → write(state,next) → pairJson → recordUse → abilityJson → 原 lease commit`。两 snapshot decoder 使用惰性字段 supplier，保留 `JSON.parse` 方法查找先于原 `pairJson` 字段读取；不新增 schema 重检。已安装原生能力与 `pairSeer` 始终同一状态引用，归档仍是脱离 JSON DTO，字段、key 顺序和 schema2 不变。

公开旧 writer 的受信调用接受语义不改变，完整／失败检查点拒绝范围保持。原普通角色 payload 和自定义 private 扩展键未经过此严格 Pair schema。

## 有限验收

- 新 5 用例 + 原 slot 4：实际 `9 pass / 0 fail / 63 assertions`。覆盖真实 authority snapshot、native alias/reference、失败 checkpoint、descriptor/getter/schema拒绝、JSON callee顺序和 state 已写但 JSON setter 失败时 use 未付款的前缀。
- 单次严格有限 types：session `2966` 实际终态 `exit_code=0`，原 compiler options 不放宽。
- 3 个完整生产程序经过精确已注册调用逆映射后，ESNext/CJS 两种完整 AST 均与实际原 Git 相同；所有原 module 依赖边未变。
- 4 个实际中文职责头检查 0；owned scope `git diff --check` 0。格式化后只有中文头精度调整，无须重复 runtime/compiler。

实际来源、精确逆变换、摘要与作者终态收据，以及 Root／独立审查均列于固定证据。

## 验收边界

本批是 Pair 完整族的状态契约交付；其余 54 角色／普通 payload 的 schema/codec 目标仍保留，不能据此把总体 C17 标为完成。此 codec 用于原内部提交 JSON 快照，不授予外来归档行动权；独立 verifier、checkpoint writer、归档版本均未修改。未运行完整对局、全量门禁、模型或网络。
