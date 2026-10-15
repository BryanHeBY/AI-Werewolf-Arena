# C07-B 与 C08 惰性复制准备独立审查

审查者：refactor_architecture_audit。只读范围：message-ids/message-refs、message-contract.test、game-text index/zh-CN/en；C08 prep的inert-event-data与旧text facade、四项新unit tests。直接与Git2d36e4d比较，不运行全量、真实模型或读取私有配置。未改作者B文件；按root额外授权仅补自己的A errors职责头一个never边界句，A代码body未变。

## 独立静态证据

/tmp/awa-review-c07b-c08prep.mjs 从固定Git blob提取TypeScript AST，不通过被测formatter重生成预期。结果 /tmp/awa-refactor-c07b-c08prep-independent-proof.json：

- zh-CN与en各1513个唯一literal keys；每个key/value和声明顺序完全一致；两份ObjectLiteral原字节完全相同，摘要分别7ca74e715a2aaa3e874465f0ea90b30f00bfc4412c0dbd49201f4705633e4e77、132290de4fe761b9dedbdda86db22f08b31ca8df86fd9fec3eaacca675966663。
- 新MESSAGE_IDS正好是旧Chinese keys完整原顺序，1513项；sequence hash cd750ba72a9b5902562d650125797b2417126bdb82b2aaa199822b05cd22ec78，匹配固定literal测试而非从当前dictionary推导。
- MessageRef interface body原字节一致：key仍闭合MessageKey；parameters仍可选Readonly<Record<string,string|number>>；未加readonly key、未强制按key泛型参数、未禁止原先type允许的NaN（runtime formatter仍拒绝）。
- 42个formatter function declaration全文字节一致，无新增/删除/改动；未知/缺参/额外参数/NaN/用户原文的运行拒绝路径保留。
- dictionary satisfies Record<MessageKey,string>维持完整且不额外接受key；Chinese保留原as const literal value类型，English原satisfies形状保留；MessageKey从contract唯一声明并具名兼容导出，无contract→text反依赖。
- 新isMessageKey只检查primitive string与冻结ID数组，不将inherited property/object/Proxy作为key，不检查对象properties，不授予行动能力。

## C08 prep边界

- copyEventData从export signature至end的1495字符与Git2d36旧text/event-data函数完全原字节一致（SHA c37dcc08bc037a14289f45e6736bd699c00b9faad892eac5958bb5c0bcc829ac）。default128、depth3、caller bound、primitive/raw string、null-prototype、own enumerable descriptors、原error codes均无增强或放宽。
- text facade具名转发同一个contract函数，不另建实现。
- 注释明确输入为无reviver JSON.parse或已证明inert值，可触发任意Proxy反射；不能承诺浏览器零trap。新测试明确观察Proxy反射发生，而不是伪造Node保证。
- Node plain_data.ts与Git2d36整文件原字节一致，仍在反射前types.isProxy拒绝；证据 /tmp/awa-refactor-c08prep-node-ingress-proof.json。未把node:util搬到browser包，未把既有Node入口替成shared copier。
- 这只成立共享copy出口，不把全仓事件解析/权限投影归一（C34）或全23fact模块迁移（C08）标成完成。

## 局部运行证据

- message4项 + inert4项 + text public4项：12 pass/0 fail/3219 expect；/tmp/awa-refactor-c07b-c08prep-independent-tests.log。
- contract与text真实package check各source types:[]及tests/Bun两个projects退出0：/tmp/awa-refactor-c07b-independent-{contract,text}-types.log。包含closed key、boolean参数、ReadonlyRecord mutation的ts-expect-error，失败被编译器确认；没有contract→text循环。
- 原backend i18n formatter contract四项：4 pass/0 fail/3476 expect；/tmp/awa-refactor-c07b-independent-formatter-contract.log。未知/constructor key、missing/extra/nonfinite参数、custom RoleCatalog与原文、locale交错都保留。

## 头部门禁与结论

Root gate指出两dictionary职责头缺明确边界；作者已仅补never parses facts/executes rules与formatting所有权句。提出者最终重新提取AST后两对象字节与42函数仍完全相同。Root公共index职责已随新增纯数据出口更新，不把only identity旧说明留到commit。

本范围无剩余阻断：C07-B强类型与format保真成立，C08 prep纯copy边界成立。全事件reader迁移、Node调用方闭环、core/actions完整迁移与root来源/依赖/阶段大gate属于各自后续证据，不由本审查代替。
