# 定序王子重收票组合

基于实际 Git `033218f2c166a369e795745a431421f17ef58b79`。四源是原 VotingPipeline、新规则组合、新本族 voting 公开贡献和定向单元；五个原控制源全文保持。原捕获块含闭块共30个物理行，约29行业务，完整迁移后不把两个私有导入简单换路径。

## 职责与原时序

组合拥有首轮票后板子门控、原选择 Promise、激活后的严格选项替换、现场投票者过滤、复收票 Promise、原当前性及严格开票调用。同步生成器未配置时0 yield，窗口返回false时1 yield，激活后2 yield；流水线只等原Promise，没有helper尾部等待。原窗口内部选择和必需发言两个Provider等待、付款、事实与finally关闭仍归原窗口。

options getter/setter指向流水线同一可变局部。原previousCurrent先捕获，再spread读取、严格替换；新闭包先复验原身份／生命，再以原函数调用形式调用旧阶段回调。名单与World/day在原表达式点查询，失败不撤销严格模式或已付选择。collect/record两个窄回调保流水线receiver、原方法callee查找先于实参，原集合与开票结果引用透传，结果字段仍在原点解构。collectVotes的生命捕获、席位顺序、重试／目标生命及PK严格复验全部保留，PK继续使用同一替换选项；普通、Animal、映射、Noble及结果路径不变。

原两个函数由新具名公开facet直接导出同绑定；reader ports不加载窗口。只删除VP已无引用的Role specifier，其余34个named import绑定／模式保持。规则组合复用现有公开VotingPipelineOptions的type-only声明，实际两种输出均无返回引擎的运行import。新增模块、适配对象、generator及调用栈／布局是明确内部API变化，不承诺任意私有反射、原CJS namespace重赋或完整历史冷加载等价。票据知识和构造端口不构成资源／行动许可，原actor原体与生命仍由权威复验；不新增规则、schema或付款。

## 有界证据

新三字面用例首次3/17通过：无配置同步完成且不读运行依赖；已付款后World名单读取失败保留历史、事实和严格替换顺序；复收票Promise原异常拒绝保留已付款且不进入开票。旧精准PK失效用例首次1/2通过，另外15过滤；两个run共四不同用例、19断言。四根有限类型首次25566/50d428退出0，没有绿重复。

完整VP四精确编辑正逆回真实Git，6278非JSDoc语法节点／4208叶及两完整raw输出同；实际新owner完整if逐表达式逆回原政策，343节点／233叶同，两个原布局raw/printer输出不同，统一所有非JSDoc token间空白（复核完整typed树）后两完整输出同。非首child错误字面反例能被强遍历识别，未裁剪回调、字面或数组。首逆工具不支持删除的空after，第二次仅printer布局失败均保原脚本／输出；只修证明器，生产未迎合输出。

当前七源码根1888个TS/JS文件完整AST字面库存10站点，其中5站点涉及本次三个函数；首基于名称文本预筛漏两个同族authority路由，最终去除预筛并按实际物理相对路由核。覆盖named/namespace/default import、export、importType、importEquals、dynamic import和require；不声称计算specifier、仓外消费者或完整冷图。

首四职责头检查真实失败1（新unit缺oracle词项），前三已绿；输入2806个真实tracked docs路径包含非MD，不能称2806规则文档。只将unit说明校准为“手写字面预期”，完整1004 typed节点及两raw输出不变，失败unit一根职责检查使用612个真实MD路径退出0。初中文存在4/0，最终结果是两阶段合并，不宣称末四根或行为／类型重跑。中文内容、晚读取和授权边界交非作者人工审查。

本批不是全部投票、C24/C28或P9完成；未运行全量架构／行为门禁、模型、整局或更新golden。新源码参与后续真实build指纹，不回写历史档案身份。

[范围](generated/order-prince-revote-scope-final.json) · [证据](generated/order-prince-revote-evidence.json) · [收据](generated/order-prince-revote-receipts.json)
