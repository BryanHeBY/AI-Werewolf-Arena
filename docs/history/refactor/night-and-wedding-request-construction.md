# 夜间与婚礼的显式请求构造依赖

## 完整职责与范围

实际 Git 基线 `8940e3cf9e6f8789c001911c4d59ea5ff0a45c55`，在首夜三窗口批已提交之后采样。19 源 = 18 个现行源＋1 个新风险单元；无删除。猎魔人三控制器与幽灵新娘共享回合退出具体引擎工厂值导入，沿已有 `ActionRequestFactoryConstructorPort` 在四个原 `new` 点构造。没有借用 `makeRequest`、复用日工厂、默认或 optional 兼容桥。

`NightStageContext` 新增必填、只读类型的 `requestFactory` 运行字段；NightPipeline、唯一共享 builder 和四个完整手写上下文以 late getter 装配原类。两猎魔人对象输入与幽灵新娘输入传入 `construction` 对象引用；handler 不先读取真正类。原生预言家／守卫已传完整 ctx，所以两原 handler 无需改动。原动态导入和 await 保持。

幽灵新娘首夜窗口接收同一显式依赖，base 只持 `construction` 普通引用，后续 `...base` 不提前执行其构造器 getter。game-setup 只给第四个窗口补依赖并校准头；前三个已提交 getter 的执行正文不变。两个旧直接婚礼调用迁同类 getter。

猎魔人 authority 单元有 2 个实际猎杀／13 个原生药对象调用，统一给显式依赖引用。测试 getter 仅在原 new 点 `require` 实际 Factory，原 helper 的动态导入／await 不动，也不顶层早捕获类。原标题、fixture、动作、预期和断言全部保持。

## 时序、许可与失败前缀

- 猎魔与婚礼先开原 turn，再在原 try 内读构造器／参数并以新实例调用 create；构造或请求失败沿原 finally 关闭，不能补交选择。
- 原生药先开 frame／进行夜复位并核 marks，原生夜先捕获 frame；两处 new 与 bind 原在 try 外。构造失败不进入原 finally，本批保此前写入与原失败边界，不增加通用清理或退款。
- 构造 callee 仍先于 World／events／day 实参；NativeNight 的 `ctx.events` 保晚读。库存、原体、目标和严格交付仍在原 frame／authority／请求所有者校验。
- 新依赖不进入 `ActionRequest.context`、MCP、玩家 DTO 或录制格式。ctx 类型与 readonly 不是运行权限屏障，也未冻结输入或原库存。

## 实际验证与保留失败

新增三例 `3c9c61` 实际 3 pass／0 fail／17 assertions，覆盖猎魔／婚礼 try 内许可关闭、原生药 try 外开启位与同库存前缀、原生夜 callee-before-events。原猎杀 null 精准例 `4ed862` 实际 1 pass／0 fail／11 assertions、141 过滤。**四个不同成功用例／28 assertions**，各只执行一次。

原幽灵新娘 `actual bootstrap/factory/setup preserves native 2/3 and final independent goals` 在 `8be2ab` 实际失败（0／1、10 过滤）：`beginWeddingSetup` 在新 factory getter 读取前抛 `ghost_bride_setup_unavailable`。不改 fixture／oracle。仅这个红例在实际 8940 Git 公共源／完整原测试／package 快照复查：1,727 文件，96 个 public package 源在执行前与 workspace 同字节；`6b70de` 实际仍 0／1、同首失败。旧 fixture 身份契约问题另笔修复，**本批没有宣称全部测试通过**。

首次测试启动 `2ffe44` 工作目录误用，源文件未成功创建，Bun 无匹配测试；原失败日志保留。修工具路径后才写新单元并执行真正三例，不把工具失败列成已运行产品用例。

19 根有限类型 `8b1c37/session80280 → ff9d17` 实际 closed exit0，无失败根重跑。职责头一次 `a49d13` 实际 exit0：19 个源、570 个当时 Git 文档路径、零诊断。没有全门禁、整局、Tape、模型或绿色重复。

18 完整程序按 46 项精确编辑正逆至实际 Git、39,662 个逆后非注释 token 和 36 个映射 ES／CJS 输出保持；四控制器完整正文只逆各自唯一 callee 后同。四个原 authority／request／夜 lifecycle 控制源与实际 Git／当前完整字节同。证明正常写出完整 JSON／日志，但该编排仅打印 output、未保独立 terminal／handle；以实际生成报告为限，**不凭空声明 exit0，也不为了补收据重跑绿色证明**。

## 变化与限制

新必填输入／ctx 字段、窗口末参数、实例依赖字段和 getter 查询为公开运行 API 变化，不保持旧省略构造依赖的调用或任意反射形状。它们不新增资源政策或状态 store，不改变档案 schema／校验／历史身份；新增源及路由参与新构建 sourceHash。

完整编译对照是明确逆接线后的映射结果，不表示当前 API 的 raw JS 与旧源码字节同。共享 ctx 多一个运行字段，接受面和加载路径会改变；测试 builder 新值导入亦属明示路径变化。本批不证明全动态／冷加载图相同。Seer／Guard handler、core actions、PM／DR／Voting／Observer、其它族及已交付首夜三 getter 不在改动范围。

[范围](generated/night-and-wedding-request-construction-scope-final.json) · [完整对照](generated/night-and-wedding-request-construction-proof.json) · [实际收据](generated/night-and-wedding-request-construction-receipts.json)

独立审查仅校准猎魔人阶段职责头：构造依赖不提前取类，但原 `world: ctx.world` 等字段仍在原对象构造点读取。只改该条 JSDoc，全文精确注释桥连接原 proof／heads／types／运行采样；不重任何绿色项。
