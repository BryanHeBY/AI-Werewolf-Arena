# 预言家状态试点

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
