# 恶夜骑士本夜原体绑定归属

真实基线 `cc7242548708543a674d2b898aef36e28f9e3dfc` 已包含导师运行记录迁移。本批九个源码路径包括六个既有生产源、本族运行所有者、新有限单元，以及一个明确迁移故障渠道的既有 Noble 场景；逐源见[冻结范围](generated/evil-knight-night-bindings-scope-final.json)，七份原源码与五个控制源见[真实 before](generated/evil-knight-night-bindings-before.json)。

## 实际所有者及接线

`evil_knight/night-bindings.ts` 唯一按 `NightStageState` 身份登记原 `Map<EntityId, 原 capture binding>`。原 Map 的创建、原角色／生命捕获和逐项 set 仍在 `night_frame.ts`；原体资格、枪政策及反射消费全部保留 `state.ts`，没有搬入 GC、复制 World／库存或增加 schema。

开夜阶段仍在三个原 `ctx.state` 点核重入、安装同一 Map、展开免疫数组。Map 安装先于 values 迭代／免疫赋值；后续失败保原已经安装的前缀，不撤销或退款。更换同形状态不继承旧 Map。

公共 `evil_knight/ports.ts` 只新增反射 binding 查询与夜枪保护捕获查询两个实际出口，内部重入／安装操作不向通用引擎导出。`native-night-effects.ts` 在原提交参数点查询 binding，保持 `commit callee → World → context.state／Map → source → kind` 与原 receiver。状态命令仍实际复核原体、来源和资源并付款。

`NightStageState` 和 `NightPipelineResult` 不再包含私有 Map 或 `captureEvilKnight` ReturnType。流水线在原返回 Map 字段的位置捕获同一 Map 的运行闭包，返回已有通用签名 `blocksPassiveNightShot(targetId)`。该点不读 World、目标或政策；闭包调用时按原 `Map.get → binding.isCurrent → state.shotPolicy` 短路及 receiver 查询，不重新捕获原体。

PM 在原箭头检查点晚读取这个结果查询。没有复用 `evilKnightNightShotImmune`：该函数会重新查询 World，且政策／当前性先后不同。原生命、夜源、DR 枪资格、请求／await、付款及胜负顺序不改。本批不修改 DR、Beauty 或导师四源。

## 明确退休的旧运行 API

这是存储与私有运行接口迁移，不是仅改类型。旧 `NightStageState.evilKnightBindings` 的直接赋值、getter／setter、原型、浅复制，以及旧 `NightPipelineResult.evilKnightBindings` 原 Map 暴露／替换注入退出。新通用结果不返回 Map；同名旧属性不建立本族资格。原 Map、binding、库存引用不被复制或冻结，查询结果是可信运行句柄，不是 JSON 或权限屏障。

因此不能宣称任意外部旧输入、属性反射、结果序列化或 Map getter 的行为完全等价。默认生产的捕获、来源、付款及当前性规则保持；新函数 callee、WeakMap、结果字段和模块来源确实不同。已有输出闭包持原输出点捕获的同一 Map，不能因后来替换夜状态而重抓另一 Map。

## Noble 故障样本的显式迁移

原 Noble 场景人为安装 `evilKnightBindings` getter，在返回对象构造时抛错。原完整场景保存在 before，且在修改前实际运行：[旧 API characterization](generated/evil-knight-night-bindings-old-noble-characterization.log)，一次通过、四次断言；它不是对新 API 的兼容承诺。

最初考虑只将 getter 改名 `inspectionAttacks`，经实际源码核对否决：伤害组合先读取该字段，这样会在 native_damage 发布前抛错，失去原失败前缀。

最终新输入渠道如下：

1. 原末阶段只捕获真实 `ctx.state`。
2. 测试自有 `events.push` 先以原 receiver／返回值正常保存真实 `noble_body_native_damage_committed`。
3. 观察这份实际事实后，才在捕获状态上安装 `inspectionAttacks` throw getter。
4. 伤害组合早读取已经结束，后续路径不再读取该字段；getter 在 `lifecycle.finishPipeline` 后、Noble handoff 前的原结果构造中执行一次。
5. `finally` 恢复原测试数组的 push 属性描述器／继承关系。

这明确改变探针字段、安装渠道和时点，绝非只改一个 key。原标题、同一 Error 实例、真实原生行动和四条原 oracle 完全保留：同错误、一次 getter 读取、authority 仍 open、末尾原 native_damage 事实。没有新增生产 hook 或更改 golden 来掩盖时点。

## 实际证明与检查

[完整程序证明](generated/evil-knight-night-bindings-proof.json)从实际当前源码逆具体已核接线：六个完整生产程序共 11,216 节点、全部非注释叶、12 份 ESNext／CommonJS 输出同原；新捕获查询的完整原算法独立展开为原 PM 查询，39 节点相同，不直接恢复整个旧 PM 主体。新 owner 的唯一 WeakMap、四个完整方法和全部语句核对，三个 import 全为 type-only，没有 World／资源调用或第二 Map。

五个明确控制源保持原完整字节：`state.ts`、导师记录 owner、伤害组合、Noble 生命周期及领域 night_effects。新 owner 实际 ESNext 没有值依赖，不产生新增运行返回链；不是全仓循环清零声明。Noble 四条完整 expect 链及真实 getAction 方法与原一致，测试输入变更单列。

[实际收据](generated/evil-knight-night-bindings-receipts.json)：

| 项目 | 结果 |
| --- | --- |
| 原 Noble API characterization | `3472fd`，一次通过／四断言 |
| 新三单元＋迁移后 Noble 场景 | `f90408`，四通过、零失败、40 次断言 |
| 有限九 root 类型 | session8652 → `8c942b`，实际退出0 |
| 最终完整程序／绑定及 oracle 对照 | `fe9233`，退出0 |
| 九源职责／中文头＋新 owner 值依赖 | `ba6535`，零诊断；当时474个跟踪文档 |

新单元覆盖同 Map／binding 引用、旧属性不注入、状态身份隔离、夜枪 getter／receiver／短路，以及免疫数组赋值抛错后仍保安装与原重入错误。Map 被替换后旧输出闭包仍读原 Map，不缓存 World 或政策。

原 characterization 与迁移后场景是同一原标题的两次输入阶段执行，不算新增两个独立场景。新有限单元仅执行一次；类型检查依据真实关闭回执，不从空日志推断。不重跑其它原套测试、全类型、整局、模型或全架构门禁。

触及的 frame 与命令职责头已中文化并解释原体／付款／失效，实际资源 `state.ts` 原字节不改。源／注释／接口位置改变新构建指纹，历史指纹不重写。本批仅关闭这个绑定所有者边界，不代表 I03/C17、全部游戏机制或 P9 已完成；Root 和独立代理审查后按功能提交，本作者不提交 Git。
