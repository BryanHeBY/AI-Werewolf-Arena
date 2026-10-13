# 夜能力公共数据契约

## 本批范围

本批对应 C30／C33 的公共类型所有权切片，基线是实际 Git `2117e4979a0256f95c990d25f209e347fdef9a83`。修改前四个既有文件与该 Git 字节相同；六个路径包括三个既有运行模块、一个包声明、一个新纯数据叶和一个新编译期单元。

- `backend/src/game/mechanisms/roles/abilities.ts`
- `backend/src/game/mechanisms/roles/night_action_history.ts`
- `backend/src/game/observation/player-observation.ts`
- `packages/game-contract/src/night-ability-views.ts`
- `packages/game-contract/package.json`
- `backend/tests/unit/engine/night-ability-views.types.ts`

新的唯一公共入口为 `@ai-werewolf-arena/game-contract/night-ability-views`，只有 `exports` 和 `typesVersions` 增加该 subpath。依赖、锁文件及包根出口不改。

## 类型与运行所有权

`NightAbilityMetadata` 完整拥有原实例除 kind／state 之外的十二个共同字段。后端映射保留 kind／payload 关联；`NightAbility<K>` 及深只读视图原声明保持，通过该映射引用唯一共同元数据。

`AbilityStatus`、`PlayerNightAbilityStates`、`PlayerNightAbility`、`NightActionKind` 和 `OwnNightAction` 的唯一声明迁至共享纯数据叶。玩家 DTO 保留原可写字段及七种能力关联；内部 `sourceDisclosed` 和 `nightSuppression` 不进入玩家 DTO，真实来源仍由运行投影按原披露政策裁剪。activation、deathExpired、所有可选／可空值和自身夜行动记录的 readonly 修饰保持。

这些数据不创建实例、解释新 schema、授予行动或库存写权。active 只是原状态标签，不能替代原生命、来源、当前窗口和提交前检查；已接受行动记录也不证明付款、伤害、死亡或最终事实发布已经完成。

后端保留所有实际投影、状态判断、复制、实例查询及目标政策。夜行动账本仍是原 World 隔离 WeakMap；原写入保留 day-1 下界，读取保留 day-1..day 过滤后逐行浅复制，过期、耗尽或转移后的目标限制仍按原行动者本地历史处理。没有迁移或更换这些运行所有者。

## 真实消费者与 API 退休

修改前对 1776 个公开 JS／TS 文件作 AST 盘点：只有 PlayerObservation 两个直接 type import，分别消费 PlayerNightAbility 与 OwnNightAction。前者还经 mechanisms/index → game/index → backend/index 三层 wildcard 形成旧公开类型出口；后者没有额外 wildcard 出口。

现在三个运行模块均直接从公共 subpath 消费相应类型。五个旧后端声明及原能力类型的间接聚合出口明确退休，不留兼容桥。现有 runtime 函数出口保持。新编译期单元十四个旧 API import 是明确拒绝反例，不能将其记为遗漏消费者；这些类型别名实际进入验证 tuple，避免无用符号诊断被误当 API 拒绝。

新的 PlayerNightAbility 从共同元数据与公共 state DTO 推导，不再继承后端 NightAbility。这个类型组织变化有意存在；七个 kind 分别比较旧／新展开字段、后端可写实例、深只读视图和玩家 DTO，并另核双向赋值。

## 完整程序保持

三个既有运行模块共 4815 个强遍历节点。在精确还原迁出声明、共同元数据引用和两条消费者类型来源后，完整程序节点一致；未遮蔽函数、数组、回调或断言。直接比较当前／旧三模块的完整 ESNext 与 CommonJS 输出，六份原始运行字节全部相同，不增加 type-only 冷加载边。

十二个元数据字段逐项保留类型、顺序、可选及原修饰符；kind／state 两个成员保持，四个完整迁出声明按唯一物理类型来源作精确比较。`NightAbility`、`NightAbilityReadUnion`、`NightAbilityReadView` 三个原声明保持。abilities 的十一函数和账本的三个函数完整程序一致。修改账本后部 day-1 读取条件的非首子节点反例被强遍历识别。

源代码与包内新叶属于当前引擎来源指纹输入；本批不改写历史归档身份，不以运行字节相同承诺旧严格 Tape 跨构建兼容。

## 有界验证与中文说明

后端四个受影响根的有限类型检查一次通过，session 13643 实际退出 0；game-contract 自身生产配置独立检查一次退出 0。新编译期单元包括七 kind 精确关联、双向赋值、十二共同字段、四迁出纯声明比较，以及十四个旧出口和九个字段／写权拒绝反例。未运行纯类型文件、既有 suite、模型或完整对局。

五个 TS 职责头中文 presence 均通过。首次真实职责检查发现新 `.types.ts` 按数据类别缺 owner 说明，仅补“本单元拥有固定旧类型的独立预期”；1788 个非注释节点保持，原通过类型不重复。最终五头、430 个实际文档路径、职责诊断 0。账本原英文头及重要说明已准确中文化，新增共同字段说明明确内部披露／抑制、资源到期和 status 与许可的区别。

完整基线、六路径 SHA、AST／运行输出、真实导入来源、类型收据与首职责诊断保存在 [交付证据](generated/night-ability-views-evidence.json)。独立源码审查由 Root 后续汇合，本说明不自称已完成全局重构、全量门禁或公共观察结构的全部迁移。
