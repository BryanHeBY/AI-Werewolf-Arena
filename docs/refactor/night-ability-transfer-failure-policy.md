# 夜能力转移的 F03 失败政策

## 本次职责和输入变化

基线为真实提交 `e0dd0306998ec7ffa5fe52bb01f2c75cc1d279cc`，三原源全字节与开工工作树相同，加一新单元。仅修改 `roles/abilities.ts`、`roles/night-ability-grants.ts` 和两 `unit/mechanisms` 测试；不修改 F02、C18/C37、Camp、具体角色资源或共用记录发布实现。

`abilities` 现在完整提交转移数据；`night-ability-grants` 保留原来源、复制、资源和安装政策。原 private `installAbility` 的完整预检收为 `validateAbilityInstall` 并返回实际 Role，普通 grant 仍在原预检后安装、再发表。它的旧宽接受面和已安装后发表失败前缀没有夹入新 transfer 政策。

F03 是独立行为政策修正。过去目标已安装、其发表失败时，源仍在库存；独立历史实验 `09647a` 已证实两边都可被 `findNightAbility`、`activeNightAbility` 找到，day 2 状态均为 active。该实验两 owner 固定 `5fcc3149`，传递依赖是当时工作树，原文件和输出不重跑、不覆盖。生产代码目前没有直接 transfer 调用；不能把这个事实说成已发生的玩家故障。

## 完整提交顺序

原 source 查找 → 原 statePolicy、JSON 复制与完整黑市／资源复验 → received 复制 → 完整目标／来源安装校验 → 晚核真实角色与库存 → 源槽 delete → 原点晚读退休列表、push → 目标字典安装 → 原 target granted → 原 source transferred_out。

所有原预检拒绝都发生在本 owner 的首库存写之前；调用者回调自行改字段不属于本 owner 无写的承诺。新提交只持本次实际 Role、privateState、abilities 和实例引用，没有镜像库存、pending 弱表或通用事务。目标没有字典时仍在安装点创建，不能为预检提前写空库存。退休 getter／push 仍在源 delete 之后执行；任何异常继续抛原 Error，保留已有前缀，不退款、不补偿、不偷偷更改 disabled。成功目标 metadata、资源计数、状态和两条事实的顺序保持。

### 新的转移接受边界

- 不同 actor 的实际 Role、privateState、abilities 都必须独立；先有的非法共享不由本命令修复。
- 库存路径须为稳定自有 data。Role 的 privateState 必须为自有 data；privateState 与字典采用普通或 null-prototype 对象，拒绝 Proxy、继承库存槽及访问器条目。目标原 null／undefined 库存仍在安装点创建。
- 原实例须确实占有输入 id 对应的自有条目，id 为同值 data，局部不得有第二条目引用同一实例，目标也不得已有同一原实例。只按 Object.values 找到 id，不足以证明 delete[id] 会删到它。
- 晚核实际 World 角色与原 source privateState；新拒绝不伪装成旧 payload schema 或生命许可，非黑市没有新增黑市资源政策。

保证针对合法唯一库存、这些实际写端口和可抛的记录 sink。sink 获得事件输入，没有从本 API 获得库存写权。任意强制写回旧槽、绕过 readonly 的 JS monkeypatch、替换全局方法或预存其它 World owner 不属于整个环境的防御承诺；有限引用检查也不被描述为永久稳定 getter 证明。裸旧实例的 metadata 不被失活锁存，仍持原字段；库存中的实际查询才区分本次是否还有有效 owner。

## 两个旧故障输入与新 oracle

| 同一原输入 | 原政策 | F03 新政策 |
| --- | --- | --- |
| target granted 的原 push 抛相同 Error | source 未删、target 已装，两边 active | source 已删并退休，target 已装且 active；只原初始事实，抛同 Error |
| 原 retiredAbilityIds getter 抛相同 Error | source 已删、target 已装且已发表 | source 已删，target 未装、未发表；只原初始事实，抛同 Error |

两个原 fixture、变量、事件回调及 transfer 参数／statePolicy 保留；输入 prelude 全原字节同。调用外部缩进因 try/catch 捕获同 Error 有变化，完整参数语法和字面／回调未改。原标题与结果断言明确变更为 F03，新 oracle 不称运行等价。不相关 grant 故障与黑市撤权两 case 完整原文同，未重跑。

## 实际验证

- 新三 case 首次 `b31462`：3/0/60，包含三个别名、四个 key／访问器／Proxy、一个冻结目标安装输入，共八变体。
- 两旧故障输入的新 oracle 首次 `337c25`：2/0/16，2 filtered，`toBe` 核同 Error。
- 原单 zh-CN 成功例首次 `e818f3`：1/0/24，11 filtered，保转移计数、起效、来源、退休重复拒绝及可见事实。
- 共六不同 case、100 断言，三次执行；绿色项未重复。
- 四根类型 `db1f94` / session 34130 → `14f9d7` 实际 exit 0；头四根 `b47e2b` 实际 exit 0，664 Git 文档、诊断/CN缺失均 0。空类型 log 不是终态依据。

完整原校验、transfer 预检、其余 abilities、原 helper 与两未改 case 共 13 个比较，7732 typed 节点/5153 语法叶，12 完整映射输出同。首授予展开旧 return 借用新尾，因此另以真实旧 inner return 和外层 cast 独立推导：`6b156e` 完整 grant 1152 节点/765 叶、两输出同；没有重复其它已绿比较。新完整 commit 622 节点/420 叶及六个实际 bindings 已单列。计数是排 JSDoc 的 getChildren 语法遍历，不是全部词法 token。新 F03 提交体作为政策 delta，没有逆掉后称整个旧 transfer 等价。

原发布 helper、机制 index 和精准成功测试三个完整 Git/current controls 保持。两个公共 grant/transfer 函数及显式聚合出口不变；旧内部 `retireTransferredNightAbility` 退休，新完整 `commitTransferredNightAbility` 不经机制 root 公开。新增值导入只有 Node util 的 Proxy 检查，没有新角色加载边或跨族规则框架；不声称全部历史初始化形态等价。

所有 Bun 命令使用 `--no-env-file`；没有运行模型、网络、付费配置、全行为套件或结构全门禁。类型/行为采样在后继 F02 工作树之前，证据不承诺整个传递闭包的最终字节。源码变化参与当前构建来源指纹，历史指纹或严格档案校验政策没有改写。本笔不宣称全部 C17/P6 或任意外部 JS 接受集合完成。
