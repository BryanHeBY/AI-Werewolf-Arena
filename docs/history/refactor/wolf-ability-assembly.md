# 共享普通狼贡献装配

本批以实际 `0ba755c4dfb352a0de259f7222c6118387e09ec6` 为源码基线，迁移 21 个既有 profile，并新增共同装配所有者、公共能力端口及一个单元测试文件，共 24 个源码路径。范围与逐文件指纹见[冻结清单](generated/wolf-ability-assembly-scope-final.json)，原字节与七个控制文件见[真实 before](generated/wolf-ability-assembly-before.json)。未改 Catalog、World、阶段经理、死亡结算或具体狼刀算法。

## 实际职责

`wolf/ability-assembly.ts` 唯一创建 `ORDINARY_WOLF_CONTRIBUTIONS`，完整保留普通狼资料、运行及默认展示贡献。共同运行装配登记狼聊、狼刀、自爆、工具、阶段提示、校验、参数修复和特权 mock；具体 handler、库存、付款、生命及行动许可仍归原机制所有者。这是共享普通狼贡献装配，不宣称资料与运行已变成两个独立可替换路由，也没有引入通用角色基类。

`wolf/profile.ts` 保留 `WOLF_ROLE_PROFILE` 旧公开名称，以同绑定别名作为实际 Catalog 注册入口。`wolf/ability-ports.ts` 向派生角色公开同一对象和五个原能力常量。端口不复制对象、包装方法、增加注册表或授予权限；与狼刀目标查询端口分开，避免 handler 反向引入自身装配。

20 个真实生产 profile 改用具名公共能力端口。野孩子原先直接借用的阶段、工具／提示、校验、修复常量，以及狼美人的原校验变量，仍通过原变量绑定读取；没有把它们改为可替换的 `runtime` 字段查询。师徒共用 profile 的 `base` 条件捕获原样保留，白天学者仍不继承狼工具／阶段。

## 对象及时间保持

- 普通狼对象只创建一次，`metadata → runtime → presentation` 创建顺序及原字段键序不变；原数组、handler 和方法不复制或冻结。
- 派生角色原展开、筛选、追加和覆盖顺序保留。阵营、狼队权限、已知能力与合法行动不是同一概念；注册贡献不代替实际请求、生命或资源许可。
- 所有派生 mock 仍在原调用点读取共享对象的 `runtime`，再读取方法并以该 runtime 作为 receiver；宿主合法替换字段或 getter 后仍按原晚读取生效。
- 新 owner 的两个迷雾／乌鸦查询通过既有 `mist_raven/ports` 同绑定取得，原函数体、参数和读取顺序未变。

曾考虑将 metadata/runtime 拆成两个固定 const。实查发现这会改变可写 `WOLF_ROLE_PROFILE.runtime` 替换后的派生调用路由，因此候选已撤回，未作为最终行为迁移；最终保留同一 plain 可写对象，没有新增代理或 store。

## 有界证据与实际收据

[完整程序对照](generated/wolf-ability-assembly-proof.json)核对普通狼原完整装配 294 个 AST 节点及 20 个完整消费者的 13,265 个节点、全部非注释叶和原字面值；经精确名称／import 路线逆后，21 个完整程序的 42 份 ESNext／CommonJS 输出 raw 相同。376 个实际命名绑定逐个验证，其中 26 个借用绑定迁移、350 个绑定不变；七个控制文件完整字节相同。未恢复整个旧主体来遮盖新实现。

此首证明属于 owner 尚保原 Mist 私有 import 的真实候选。Root 审查指出移动该 import 会制造新跨机制内部边界；最终仅该模块路径改为既有公共端口。[实际 route 桥](generated/wolf-ability-assembly-mist-route-proof.json)核对两个原 query 的 ultimate declaration、完整 294 节点／所有叶与两份路线逆后的输出。实际未逆的最终输出因 import 路径改变而不同，不能冒称全部新模块字节与旧模块相同。

[有界静态图](generated/wolf-ability-assembly-module-graph.json)按完整 ESNext 输出中的值依赖读取：原 367 个业务模块，最终增加两个 alias／公共装配节点后为 369 个；精确消去这两个接线节点后，原 367 个业务所有者的完整可达集合相同，未添加或丢失业务 owner。原 21 个 profile 来自固定 before，其余依赖两次使用当前同源，不能据此宣称整个历史图或并行开局 WIP 的字节不变，也未执行所有角色的首次加载入口或宣称原循环清零。

[职责头检查](generated/wolf-ability-assembly-heads.json)真实读取本批 24 个源与当时 462 个已跟踪文档路径，职责门禁和中文头检查均零诊断。它只检查形状，职责真义由源码审查验证。

[收据](generated/wolf-ability-assembly-receipts.json)保留真实执行边界：

| 检查 | 实际结果 |
| --- | --- |
| 新有限单元 | 3 通过、0 失败、43 次断言；一次执行 |
| 原 24 root 有限类型 | session37943，终止 `7e705e`，退出 0 |
| 最终 Mist public-route owner 增量类型 | 仅 1 root，session70244，终止 `295e8e`，退出 0 |
| 最终 route 桥及有限图／职责检查 | session39495，终止 `2f0bf9`，退出 0 |

新单元覆盖真实对象／handler 引用及派生覆盖、`runtime` 属性和方法 getter 的晚调用／receiver，以及狼聊优先、狼刀 pass 与可选自爆不默认执行。属性修改在 `finally` 恢复，不调用模型或完整对局。

首轮新测试因写入时工作目录多了一层 `backend` 而无法解析 fixture import，实际 0 通过、1 错误已单独保存；移动到正确路径后正文未变。Node 证明工具的 Git 子进程曾被 `EPERM` 阻断，同工具随后以 Bun 实际执行成功；失败不计作绿色回执。类型检查的真实关闭回执证明退出 0，空日志本身不是证明。

## 范围限制

保留旧公开角色名称及贡献对象的可写字段 API，只退出其它角色对 `wolf/profile` 或内部能力叶的直接借用路径。CJS 输出的模块导出属性由原 `exports.WOLF_ROLE_PROFILE` 可写 data property 改为具名 re-export 的 getter 描述符：原 plain 贡献对象身份、可写 `metadata`／`runtime` 和晚 getter 读取仍保持，但不承诺对 CJS module namespace 任意重赋整个导出属性的反射语义相同。模块路径、调用栈、公开端口装配加载图及新构建 `sourceHash` 会改变；历史指纹不重写，不提供跨构建复现豁免。没有修改 mock 决策、RNG、付款或许可规则，没有全量类型／原套测试／整局／架构门禁复跑，也不据此关闭整个角色迁移或 P9。

[独立审查](generated/wolf-ability-assembly-independent-review.json)已核实际 24 个源、21 份 Git before、全部绑定与原控制；Root 源码审查亦通过。按功能提交；本作者不提交 Git。
