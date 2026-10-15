# 预言家状态所有权

## C17 的实际迁移

权威位置保持 `Role.privateState.abilities[id].state`。`seer/state-contracts.ts` 持有原 `SeerState` 字段声明，`seer/state.ts` 通过既有能力 owner 安装和查找状态，承接普通查验与获赠查验的四项写入。没有增加另一份状态或编码形状。

安装仍复制输入模板，再返回实际存储对象；连续读取仍返回同一引用。原生优先、明确 abilityId、唯一获赠实例、失效实例可读等选择规则保持。状态替换继续以引用变化使既有 ability scope 失效；能力 owner 继续负责实例 ID、使用次数、激活、退休和库存。

普通夜间查验使用原先捕获的 state，写入仍在 Time Consort 提交之后、Fox 提交之前。获赠查验使用单独的具体命令，保持原四次 `ability.state` 读取和两次 `target.id` 读取。两处都保持写标量、复制 lastResult、追加 history 的顺序；history 抛错不回滚先前标量或已提交效果。

## 保留的职责

Demon Hunter 的第三条原生查验写入仍属于它的 sealed native commit。其捕获的 `nativeArrayPush`、原状态和 JSON 检查、写权限及使用次数提交保持原样；本试点不将它称为已统一的普通写入。

玩家知识投影、借技状态重置、能力复制/转移以及独立归档 verifier 保持各自职责。外部 checkpoint/Tape 格式不变；兼容 accessor 为具名重导出，C44 按实际消费者清单退出。

## 局部证据

四项 owner 测试通过，31 次独立字面/身份/读取顺序断言；九项原有原生安装、知识转移、获赠与目标政策相关用例通过，75 次断言。十三项原声明、accessor body、逆替换 caller 和未动 Demon frame 证明通过，Root 独立核对 accessor 原文。整合 backend source/test 类型检查通过。未运行全量对局或浏览器测试。

这完成一个普通机制的状态试点。所有机制、schema/编码贡献和复杂机制迁移按矩阵继续，不能据此将完整 C17 展开工作标为完成。

## 深只读真实入口

`SeerReadState` 是原能力槽数据的深只读类型：标量、lastResult、history 数组、每行及行内 result 都没有写权。`getSeerState` 和 `setSeerState` 返回该视图，保留同一对象引用，既不 freeze 也不 clone。公开 ports 直接重导出同一 getter，真实 Agent 读取已走此入口；profile 安装和读取直接归 state owner。

普通与获赠的 record 命令接收原捕获的只读引用，仅在 state 叶内通过擦除后不产生代码的类型转换恢复原四处写入。每次 `ability.state`、`target.id`、result spread 和 history push 的读取及失败前缀保持，不增加缓存、过滤、验证或回滚。现有能力读取视图复用 owner 的类型声明，停止重复定义 Seer 的数据形状。

两项旧 fixture 的直接状态造数保留相同赋值和断言，仅增加显式测试类型转换；没有新增生产写入口。原 owner 与新编译负例/同槽引用测试共五项通过、36 次断言；原 prompt fixture 一项通过、2 次断言。最终十文件有限类型项目实际退出 0；初两处 matcher 类型诊断保留，仅修测试类型。

独立审查核对七个生产与两个原 fixture 的完整运行程序不变、十四个相关 stage/codec/reader/verifier 原字节保持、十个责任头、十二次原/新入口冷导入及真实函数身份。作用域依赖检查没有新增失败，39 条历史债务未豁免。没有重复运行对局或全量门禁。

此视图不授予行动权限。RoleComponent 的通用 privateState Record、all/find/active 返回的可写能力句柄、其他角色的状态与完整 schema/codec 仍是明确剩余工作；本批不将 Seer 或 C17 整格标记 complete。
