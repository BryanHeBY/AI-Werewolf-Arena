# 白昼学者／寂夜导师状态所有权

## 完整职责

此 C17 批以真实 `c3dc932647f67499b430253f5c77d2fb9cb363f1` 为输入，完成本族状态、原引用绑定、内容快照及实际库存／历史写入的唯一归属，不新增板子或拒绝政策。

`state-slot.ts` 拥有原六个 schema／创建／读取／选择函数、原低层 data descriptor 查询、内容 JSON 编码和角色／阵营数据 reader。严格 Proxy／descriptor／数组／历史／一次库存校验仍是原算法；`readModifierState` 返回原可写脱离副本，选择只改副本，角色 reader 返回原 raw 只读视图。数据相同或有副本并不能提供 board／角色／生命／夜行动资格。

真实 live 绑定改由 `ScholarMentorStateSlot` 持有原 `state`、`remaining`、`history` 三层引用和原 `expected` JSON 字符串；没有第二个 WeakMap、镜像库存或新租约。匹配仍依次核 raw、remaining、history 引用，之后才按原 schema 复制／编码比较内容。同 JSON 替换任何一层引用仍撤销。

初始化也归槽写 owner：profile 原配置 parse 在前，原 `privateState` 左值读取必须先于 caster 分支和原状态工厂，两个查询 thunk 不提前执行、不缓存 World 或状态。选择提交仍由 frame 先完整校验并生成 `next`，然后按原顺序进入槽：

1. enhance 赋值；weaken 赋值。
2. 读取 `Object.defineProperty` callee，读取历史对象，再读取历史／length 和 `String`。
3. 读取 `next.history.at(-1)` 原条目，以原 descriptor 追加同一引用。
4. 原 schema 复制／JSON 编码成功后才更新 `expected`。
5. 返回 frame 后才 `pending.delete`，非 pass 才追加原 selection。

失败不回滚已经写入的库存或历史，也不补删 pending。frame 仍拥有原 board WeakMap、roster／原生能力／身份／生命校验、夜 pending／selection、bonus grant、原生目标、回执许可、提交和关闭／abort。原 `bonus-effect-records` WeakMap 和数组整个保持，不把运行回执序列化或复制。

`rules.ts` 拥有原完整十二人有限板 `resolveModifiers`：原列牌、阵营、选择合法性和遍历不变，先排除施法者免疫，再处理同一好人碰撞；两项有效选择目标均为狼时，不论同一或不同目标，走原导师死亡分支。规则不读 World、不付款、不安装库存。

## 调用与公开边界

旧 `state.ts` 删除；原 schema／选择消费者直达槽，有限板 resolver 直达本族 rules。原 `night_frame` 的角色数据 reader 出口退休，实际读取者全部迁 canonical owner。公开 `ports.ts` 只新增原 `readModifierState`／`scholarMentorStateForRole` 数据读出口，不为测试公开初始化、提交或槽实例方法。

本族五个原测试只迁 import，原 title、动作、fixture、循环和断言保留。其余 frame/阶段/profile 保原业务表达式与调用参数，原 stage 的选择／事件／provider 和加成付款／记录序不改。

最终十五路径：十个原本族路径（其中旧 state 删除）、两个新 owner、一项新 unit、两个共享读取者。十四路径实际存在。Root 独占接线的共享 reader 只有本族两条 route；共享 `player-observation-projector.ts` 按同一 c3dc 原字节记录三条 route：Scholar 两条、Order 一条。后者属于同时冻结的 Order 状态所有权 cohort，本批没有编辑其投影、其他角色、PM／NP／DR／Voting、AI、录制或 verifier。

## 实际验证

- 原七个 state 函数分别从实际新 owner 对照，原 frame 的三个数据／编码 primitive 也完整对照，共十函数。原整个 state 非 import 程序用实际 owner 声明重建，1,514 typed 节点、两份完整输出保持。
- 九个原存续本族消费者及两个共享消费者完整 inverse，17,030 typed 节点、二十二份完整 ESNext／CommonJS 路径／调用形状映射后输出保持。共享两个源精确只逆五条 route，其中 Observer 一条 Order route 明确另族归属。原 frame/profile 整程序不以旧整个 body 覆盖候选；实际新匹配、提交、构造字段和初始化查询分别核后接回原调用。
- 245 个保留 import bindings 原 route／名字／alias／type-only 保持；20 个迁移 binding 登记真实端点；2 个原类型／工厂消费随完整写 owner 退出，3 个新 owner binding 明列。五当前源码根的所有字面模块形式不存在旧 state 路径，不宣称其它根／计算路径全覆盖。
- 新 slot／rules 当前静态值依赖共 50 模块，没有返回其它 backend、frame、profile 或 stage；不是整个历史 cold 图。四个稳定控制（bonus records、夜清理、共享原数据、Alive）真实 Git／当前字节相同。
- 首十四根有限类型 `fede7c → de13d6` 实际 0。首十四职责头／557 Git 文档路径检查只有 ports timing 词项红；准确写出已付事实“时点”后只失败一根 `2f7fce` 通过。中文头存在首检查十四根为零。
- 新四项手写风险用例 `10c413` 为 4／0／21，原 frame 的 both-choice／charge identity 精准用例 `a1775a` 为 1／0／11，另 27 项过滤。五个不同成功用例合计 32 断言，跨两次执行；原组不重跑。首新测试收集曾因我选不存在的 GC identity subpath 失败，未进入 body，改真实 public 根同一个 Camp，保首记录。

新增头与重要逻辑说明均为中文，解释 raw 和脱离副本、内容证据与引用、库存／历史写入失败前缀、初始化左值、免疫／碰撞和 frame 的许可／生命职责。程序证明首四次工具红如实保留：两处构造参考换行布局、未区分 import 的 class 计数、未单列新 reader export；只修比较器，没有改产品求 raw 相同。最终 `e609d3` 通过，不重复类型或运行绿用例。

## 明确限制

原私有 plain binding 变成具名 class，field 初始化、prototype、方法查找、初始化调用栈和内部布局是新接口差异。完整真实匹配／写 body 对照与风险用例不保证任意 prototype monkeypatch、私有反射或 namespace 重赋等价。新增原角色 reader／Camp 运行依赖采用同一真实共享声明，当前可编译／静态无返回边，不承诺原所有模块求值路线完全相同。

联合 Order／Scholar 共享 Observer 与类型传递依赖必须同一次冻结／功能提交；当前依赖采样不冒单族整个历史图。没有新增 schema、政策、RNG、await、资源副本、清理或缺失动作容错。未跑模型、整局、全门禁或 golden；不代表整个 C17 或 P9 收尾。

## 证据

[范围](generated/scholar-mentor-state-slot-scope-final.json)、[交付证据](generated/scholar-mentor-state-slot-evidence.json)、[实际程序](generated/scholar-mentor-state-slot-proof.json)、[绑定](generated/scholar-mentor-state-slot-bindings.json)、[执行收据](generated/scholar-mentor-state-slot-receipts.json)；真实 before、精确 edits、原四工具失败版本、实际完整输出均持久保存，独立审查不纳作者附件哈希，避免循环。
