# 玩家 checkpoint 外部格式归属

真实基线为 `849d26441e2d4ee84579d7cf2d6304425e675daf`。本批三个源：原 `recording/reproduction.ts`、新增 `recording/checkpoint/player-format.ts` 和新增定向单元。完整玩家格式及 `RecordedPlayerState` 的唯一声明归新 owner；原 `reproduction` 保持续具名 type re-export，公共字段、可写性、optional 和原签名不变，不宣称这个公共入口退休。

## 完整职责与接受面

新 `createRecordedPlayerSchema` 拥有原 affiliations transform、14 个组合字段、Lovers refine 和末 Wall owner refine。调用方在原声明点传入原 `positive` 与 `jsonObject` 两个 schema 引用；正整数边界和 `z.record(z.string(), z.json())` 的构造仍留原位置，没有复制通用 validator 或提前解析状态。

WallNote、DebatePenalty、Lovers 三个组件保持 optional，Badge 的 handoffPolicy 另为可选字段。配对编号、mixed 与阵营一致性、墙实例编号归属以及原错误标签均保持；格式只核数据，真实关系、生命、权限和因果仍由独立 verifier 负责。privateState 仍接受原 generic JSON 记录，不按当前 Role 删除旧槽、受赠／复制 metadata 或正常扩展字段。

普通 capture 和 Trace.checkpoint 的整容器克隆保持，合法 getter、undefined、alias／循环等宽捕获策略没有改成 live schema。JSON 准入仍在 Trace.build 的原 Tape parse 时点，envelope／版本→schema→16 个 verifier 顺序不变。本批只收齐完整玩家外部格式，不等于 55 个角色的严格 runtime schema、全部 codec 或 P9 验收完成。

## 定向验证与真实阶段

- 新三个案例首次 `0664af`：3 pass、0 fail、21 assertions。覆盖完整 optional／未知私态、retained 槽与 metadata；真实 capture／Trace 追加后才拒绝 undefined；Lovers 和 Wall 两项原 refine 标签与路径。
- 原唯一精准标题 `explicit undefined optional fields normalize into a serializable CP/Tape without weakening strict JSON parsing` 首次 `33f456`：1 pass、0 fail、4 assertions。两次执行共四个不同案例、25 个断言，没有重复绿案例。
- 首有限三根 `9f2bea / session32402 → 7acc69` exit2，仅新单元两项类型问题：matcher 字面政策推断为 string，以及 readonly boardConfig 传入原 mutable metadata 类型。保存完整原单元后，只加 `expect<unknown>` 和同引用 BoardConfig 类型断言；两完整 ES/CJS 输出同，输入／预期不变。仅失败单元根 `ca0e6a / session55882 → 6d577b` exit0，两个生产根未重跑。
- 职责头 `75fd9c` 一次三源、658 个实际 Git 文档路径，诊断及中文缺失均 0。头检查和运行收据对应 unit 类型修正前 SHA；首头／注释未变，不把旧收据改称末源码复跑。

## 原体与接线证据

真实 Git 原整源和七处精确编辑保存在 before／edits；完整原源正逆单独证明，新 owner 的实际完整 transform／composite／refine 和接口另直接比较。原整源 9,623 个非 JSDoc 语法节点／6,472 个语法叶；迁入 transform 为 86／54，完整 composite 为 724／498，接口仍 14 个成员。两完整逆输出、两份实际迁入 body 输出和两份 unit 纯类型桥输出同；实际新 reproduction 输出不同，没有用恢复旧整个 body 代替新 owner 正文证明。

首证明 `6117b9` exit0 完成正文和输出断言，但计数器在 walk 之前读取数字，统计错误为 0。完整首脚本／报告／输出保留；仅工具计数修正 `03f41d` exit0 得到上述真实数值，产品源不改，没有重跑测试、类型或头检查。

保留 70 个原具名导入绑定，四个迁入的公共数据／reader 绑定保持模式、名字和模块入口；这不冒称递归解析了所有 package re-export 的最终声明。接口四个 inline type 路由按新物理位置调整，实际原 core 模块及 SHA 一致。七个当前源码根 1,915 文件的 AST 字面全形式库存发现唯一类型声明、新单元直接消费和原公共 type endpoint；非字面动态键不作全证明。

新格式只有 Zod、公共 game-contract 和 replay-contract 值依赖，没有 backend World／Trace／权威值导入。private-state-codec、player-snapshots、reproduction-trace、verifier assembly 四控制保持真实 Git 字节。并行 B13 的工作区传递依赖不作为完整固定 Git 构建，本批不修改其源码。

新增模块、builder API、type 声明位置和初始化路径是实际变化；不承诺任意 Zod mock、CJS namespace 重绑定、调用栈或全 cold 图反射等价。未运行全门禁、模型或其它已绿族矩阵。

证据：[scope](generated/player-checkpoint-format-owner-scope-final.json)、[正文证明](generated/player-checkpoint-format-owner-proof.json)、[绑定库存](generated/player-checkpoint-format-owner-bindings.json)、[真实收据](generated/player-checkpoint-format-owner-receipts.json)、[evidence](generated/player-checkpoint-format-owner-evidence.json)。
