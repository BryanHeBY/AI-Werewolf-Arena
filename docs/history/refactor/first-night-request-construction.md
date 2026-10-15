# 首夜窗口的显式请求构造依赖

## 范围与归属

以实际 Git `a80d5d773c2f49745fe6b6908a6d50a0839358ea` 为原文基线。13 个现行源码：三个实际初始化窗口、盗贼／千面人两个包装、开局组合、六个直接调用测试及既有开局组合风险单元；没有删除源码。

`InitialIdentitySetupWindow`、`WildChildSetupWindow`、`LonelyGirlSetupWindow` 退出具体引擎工厂的值导入，只依赖已有 `ActionRequestFactoryConstructorPort`。`rulesets/game-setup.ts` 在三个原窗口构造点显式传入 `requestFactory` getter；读取真实类仍发生在各窗口原 `new` 点。两个身份包装透传同一依赖对象，仍在自身实例构造时读取共享类，不在模块顶层捕获。

三处分别保留初始身份固定日次 `1`、野孩子／孤独少女原 `day`。每次仍 `new` 本窗口原 World／events／day 的工厂并以该实例调用 `create`，不共享现成请求或日工厂。鬼魂新娘、各族生命周期／库存／权限、原体复验及原 `finally` 均未迁移。

## 关键不变量

- 先准备状态、开选择／安装 scope 及原复验，再读取构造器；构造或 `create` 抛错保留此前写入前缀，进入原 `finally`，不补交选择。
- 原 `new` 的 callee 在 World／events／day 参数之前读取；新增依赖对象不提前查实际类。原 `create` receiver、输入字段、provider 等待和回复复验顺序保持。
- 开局组合仍交还原窗口 Promise，保原四步顺序、首个 false／失效短路和成功尾部无额外当前性查询。只新增前三步构造依赖，不修改鬼魂新娘。
- 构造端口、角色标签和工具名单不授予选择或资源许可；真实绑定、生命及付款仍由机制所有者复验。`readonly` 仅声明字段，未冻结实例或状态。

## 有界验证

两个新增风险用例使用真实野孩子板子／绑定：构造器 getter 失败后保原异常并关闭窗口／资源；显式构造器保原参数、实例 `create` receiver、同请求引用及实际选择提交。一次为 2 pass／0 fail／23 assertions。原精准取消用例另一次为 1 pass／0 fail／5 assertions。共 **3 个不同成功用例／28 assertions**；没有整局或付费模型。

13 源首次有限类型检查真实退出 2，仅新增单元有三个诊断：始终抛错 getter 推导为 void，以及两个引用 matcher 的可选类型。只补 `never`、擦除类型断言及非空类型断言，不改样本／期望；仅失败单元根复查真实退出 0。新增用例绿色运行位于类型修正之前，完整 ES／CJS 输出各一份相同证明运行代码不变，没有重跑绿色用例。

从当前全文精确正逆全部 44 项登记编辑到实际 Git：13 完整程序／29,086 个逆后非注释 token／26 个映射编译输出相同。另独立比较三个完整 `execute` 正文，仅逆各自唯一 `new` callee 后全部 token 同；四个生命／选择控制源码与实际基线／当前字节相同。当前工厂／端口的具名导入沿实际路径核到原唯一声明。

职责头只运行一次：13 个实际输入、564 个当时 Git 文档路径、诊断 `[]`。首工具调用只打印输出文本，未留独立 shell 退出码；本批以实际 checker JSON／日志的零诊断为证据，不为补收据重复运行绿色检查。

## API 与证据限制

这是显式构造依赖迁移：所有相关窗口／包装构造器新增必填末参数，实例多出保存依赖的字段；不保旧少参数调用、构造反射／实例字段、任意自定义构造器与原隐式工厂的等价。默认生产 getter 保原读取点，外部新结构接受面不代表权限扩张。工厂创建、角色选择和回退政策没有修改。

模块求值路径及新 sourceHash 会改变；保留包装晚读共享类，但本批不重复旧冷进程矩阵或宣称全依赖图初始化相同。`core/domain/actions.ts` 的既有构造端口由 Root 的 Sheriff 批提供，本批不编辑；并行 PM／DR／NightPipeline 等不属于这四个字节控制。

编译证明明确是逐项逆接线后的完整映射对照，**不是当前新 API 的 JS 字节与旧源码相同**。六个旧直接调用测试只加依赖接线／必要类导入，原 title／fixture／输入／assert 不变；风险单元仅新增用例及必要类型标注。未执行全量门禁、其余场景、Tape 或模型；本批不代表 C20 或完整目标已验收。

[范围](generated/first-night-request-construction-scope-final.json) · [完整对照](generated/first-night-request-construction-proof.json) · [实际收据](generated/first-night-request-construction-receipts.json)

独立审查仅指出证明器的一条数量注释：三个窗口加两个包装共五叶，原写四叶。当前工具只校准该说明，实际执行版另存 `proof-executed.ts`；原输出、收据与十三源字节不变，整理后工具未重跑。
