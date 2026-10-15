# 诡术师状态槽归属

## 完成范围

真实 before 为 `fa4f80c4321dd3bbb7d1ff1c579d68ec3d856893`。13 个源码路径：新增本族 `state-slot.ts` 和一个风险单元、删除原 `state.ts`，其余十个消费者精确迁移。完整旧 schema／create／同引用 get／知识 project／`nextTricksterChoice`，以及原 profile 初始化、frame 历史 descriptor 追加与身份 JSON 编码，归同族唯一状态槽。

frame 继续拥有唯一 Board／夜窗口、原名单和生命版本、expectedState、finished／exileResolved、当日映射、取消／中止／放逐输出。未修改 PM、DR、Voting、录制、verifier、配置或产品文字。共享状态类型、原 exile_mapping、已交付夜生命周期及独立核验器四个控制源全字节与原 Git 相同。

## 输入、写入与失效

- 原 live reader 先拒绝 Node Proxy，仅读自身 data descriptor，不调用 caller getter、数组方法或迭代器。日期递增、非空二人组升序和号码一次使用、相邻夜不能连续主动跳过等完整接受集合保持。get／schema 是同一函数，合法返回原状态和 history 引用；readonly 只约束读方类型。
- project 和 nextChoice 保原脱离副本及可写性；legalIds.includes、连续跳过与首拒绝次序不变。它们不取得原体、窗口或资源写权，nextChoice 本身不追加原 history。
- 初始化无参数，保持原 privateState 左值容器读取→create→setter。历史追加先找 Object.defineProperty callee，再两次读原 state/history，以原 index／可写 descriptor 写入同一个 choice 对象和 pair 引用。
- 原 frame 顺序保持：next.history.at(-1) 得到原 choice→追加 history→刷新 expectedState JSON→复制冻结 frame pair→committed。编码失败保留已写 history，旧 expectedState 随后撤权，不退款、不补提交或修复原库存。
- 身份 JSON 只编码原 project 结果并作运行比对，不是档案 decoder、快照恢复 API 或行动许可。原 Role／Identity data value、Alive descriptor／版本与名单／state 引用由 frame 复验；一次普通死亡的已付效果、复活／替换撤权政策不变。
- finished 仍保留当日放逐映射，exileResolved 限原一次输出；下一夜关闭上一映射，abort 对尚未 finished 的窗口原样生效。这些职责没有迁入数据槽。

公开 ports 只补两个实际运行 reader：getTricksterState／projectTricksterState，与槽声明同绑定。state／frame 真正 owner 单元直达槽；另三个只读旧测试和 Observation 经公开 ports。未为了测试公开 create、nextChoice 或 writer。新方法表和子表冻结不冻结输入状态／历史／知识副本，也不新增镜像或 lease。

旧 state 物理入口退休，无旧转发桥。新 owner、方法表初始化与调用栈是明确接口／布局变化，不承诺仓外旧路径、任意私有反射或 CJS namespace 重绑定等价。

## 有界验证

[before](generated/trickster-state-slot-before.json) 保存 11 个真实 Git 全文和四个控制 SHA。[完整程序对照](generated/trickster-state-slot-proof.json) 独立读取实际新 owner 算法，再展开原调用点；四个完整生产程序和十个完整消费者共 10,850 typed 节点，完整非注释树／叶及 28 个整段 ES/CJS 输出相同。未恢复旧整个调用体充作生产者证明。所有原输入、断言、policy／文案／错误和其它函数保留；旧测试只有绑定路由与中文说明变化。

[绑定对照](generated/trickster-state-slot-bindings.json) 精确核全部 237→240 个 binding：218 原位、19 路由迁移，原 create import 退一条，表和公开读合计新增四条；七个具名声明物理归属明确。五个当前源码根（backend/src、backend/tests、frontend/src、packages、tooling）的 TS/JS 字面 import／export、inline importType、dynamic／require 和 importEquals 盘点旧 state 消费零；frontend/tests、backend/scripts 和历史 generated 未计入。计算路径与仓外消费者不在穷尽声明内。槽直接依赖与旧 state 相同；当期静态值图 94 模块／286 边不回 frame、profile 或 Observation，未执行冷加载或声称完整历史初始化图相同。

[真实收据](generated/trickster-state-slot-receipts.json)：新三个风险用例首次日志为 3/0/25；首 shell 末 cat 的元数据没有单独暴露 Bun 退出状态，按真实成功 summary 记录，不编造 terminal chunk，也不为收据重跑绿。原正常 finally 保留白天映射精准用例 `e1640a` 真实 1/0/1、9 filtered。两次执行四个不同用例共 26 个成功断言。

有限 12 roots 类型只一次：`26c307`／session 89137→`d447ed` 实际退出 0。完整程序 `9feca8`／session 65474→`128f7c` 实际 0；binding `881039` 实际 0。首职责头十二源／542 同 Git 文档路径出现 ports 时点与终结两诊断（`09773f` 实际 1）；只补该真实中文头，failed-only 一根零诊断，另外十一根不重复。修复发生在首次类型进程期间，仅注释，最终完整程序对照含该修复；不宣称原首头全绿。已检查本批 diff 空白。

没有整局、模型、全门禁、完整旧套件或已绿重跑。源码路径及中文说明影响当前构建 sourceHash，历史身份不改写；本批完成诡术师数据槽归属，不代表 C17 或最终玩法验收全部完成。[最终源范围](generated/trickster-state-slot-scope-final.json)。
