# 共用参与者捕获与复验所有者

真实前态为 `15b680d9d55f4ead009a0fb363c6736523def03a`。九个源码路径包含七个既有文件、一个新领域 owner 和一个新风险单元；不修改 core barrel 或其它族的参与者政策。

## 完整职责迁移

`core/domain/original-participant.ts` 唯一拥有原 `DebateParticipant` 五字段结构与两个完整算法，公开名称为 `OriginalParticipant`、`captureOriginalParticipant`、`sameOriginalParticipant`。Debater authority 原三声明及出口实际退休，没有旧路径 reexport 或包装转发。Authority 仍持有窗口、一次提交登记、处罚与其生命版本失效。

六个真实 consumer 是 Debater window/profile、通用 validation_rules、Initial setup、Wild lifecycle 和 Wall authority。它们直接从新物理声明导入，保留原局部具名别名及所有调用表达式；authority 只导入同一类型作为 `DebateAuthority.participants` 字段。其它原 authority 消费者只用保留的窗口／处罚功能，不改其测试或业务。新单元也直接消费中立 owner。七根精确正逆覆盖全部原程序，Wild 刚提交的 F04 失败撤权逻辑保持。

## 原引用与接受宽度

- 捕获原生命在先，Role 查询在后；生命缺失仍执行原 Role 查询。仅两者均存在才按 `role.role`、`role.camp`、`role.privateState` 求值，原 getter／Proxy 异常仍在原位置传播。
- 返回顶层快照仍可写，组件与 privateState 都保原引用；不克隆、冻结或添加 brand，不把快照当作库存、许可或档案。
- 复验先执行原生命／版本短路，再查同 Role 引用及原三个字段的严格相等。状态内容变化不在这里做 JSON 比较，也不读取或新增 Camp 组件引用检查。
- `game/mechanisms/roles/original_player_scope.ts` 是另一套严格政策：有效 ID／枚举、own descriptor、Proxy 拒绝、Camp 引用、冻结和 World 品牌均不同；完整字节作为控制，未合并或用来加强本组资格。字段类型和可写性不变，玩家或角色裁剪投影也没有代替原状态引用。

实际导入库存先经全仓当前 TS／JS 文件命名与 authority 路径搜索确认；旧三个 symbol 没有额外测试直接消费者。最终有 15 项具名引用，逐个导航到新文件的实际 export 声明。局部旧别名不代表旧出口仍存在。此证据不承诺任意外部动态计算属性、CJS namespace 重绑或旧模块反射 API 兼容。

## 必要验证与真实阶段

- 新单元 `022adb / 0`：2 个不同字面用例、20 个断言，核继承 getter／Proxy、循环状态和原引用接受、快照可写、Camp 无关、缺生命仍查 Role、同 Error 和生命先短路。
- 原精准 `968b64 / 0`：`debate_speech / target_revive revokes pending outcome`，1 个用例、6 个断言；61 个其它用例 filtered。没有改旧输入、标题、oracle 或补跑其它绿。
- 九根有限类型 `492fcc`／76053 → `1c9fc5 / 0`；九头 `0ecb30 / 0`，当次 679 个 Git 文档路径，原诊断为零。两者均首次成功。
- 对照首 `1a8b13 / 1` 是工具把空 `after` 删除项当作普通 substring，逆向 uniqueness 误判；实际执行版脚本、编辑和输出完整保留。只修工具为每个精确编辑记录其原应用 offset，再逐项逆回；源码没有迎合工具修改。
- 末 `8ee1bb / 0`：七个完整程序的 11 项编辑正逆相同、三个实际完整声明只做规范名称逆映射后相同、14 份 ES／CJS 完整逆向输出相同；累计 typed AST 比较 19416 节点、10106 叶。新 owner 的完整函数与结构独立比较，不以恢复旧整个 authority 代替它。15 项引用为直接路径／导入名／实际 export 的物理声明核，未声称全 TypeChecker 图或完整词法库存。
- Scoped diff-check `400c79 / 0`。

新 owner 仅值依赖原核心组件名与生命查询，World／Role 是原类型依赖；没有反向 feature 值导入、新 store、Class 或注册。模块位置／导入拓扑和三项公开 API 明确变化，实际 JS 并非逐字全同，也没有执行完整冷加载图。四个 whole controls 为严格 OriginalPlayerScope、night_effects、Debater state、Initial deal；并行 Animal 与 Initial public facets 不作为恒定控制。

所有源码在检查后保持冻结。未运行全门禁、模型、整局或历史已绿集合；源码身份按真实当前字节生成，不改历史 strict 身份或加豁免。本批收走共同数据算法，未完成 Camp sole-source 或统一所有原体权限政策。
