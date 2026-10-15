# C17 夜能力授予、复制与转移提交负责人

基线为真实 `0ed5b3257c93c8ab820036bc47fb406d6e7568cc`。原 36 个已跟踪源从这个提交捕获；唯一后继消费文件 `seer-tool-admission.test.ts` 在独立功能提交 `874030190c7b26980c1f82fe9a638caad3be99c6` 后读取真实 Git 字节，只迁移一个导入。最终范围 40 源，原记录不改写成同一个历史来源。

## 实际职责

`night-ability-grants.ts` 收走原 `AbilityGrant`、完整 `grantNightAbility`、私有 `installAbility` 和完整 `transferNightAbility`。新负责人执行原安装数据校验、来源核对、复制、明确知识／资源政策、黑市回调后复验以及实际字典提交；保留原 `privateState.abilities` 和 `retiredAbilityIds`，不建立第二库存。

原 `roleOf` 与 `emit` 完整实现归 `night-ability-change-runtime.ts`，授予／转移和原启停／首次死亡到期两个真实负责人共用。内部叶不从机制聚合公开，没有复制第二份角色查询或事实发布政策。

`ability_changes.ts` 保留原生安装、起效日、启停、使用次数、首次死亡到期和借用退役的六个完整命令。旧叶不再公开授予／转移／授予类型，也不保转发桥；机制聚合出口直接公开新负责人的三个同名绑定。35 个真实具名消费文件迁 44 个绑定：3 个生产文件共六处授予调用，32 个测试文件；转移在现有生产中没有调用，旧 11 个测试文件的 23 个调用保持，不能称新增生产转移能力。

`allNightAbilities`／`findNightAbility`／退休 ID 读取、`copyAbilityData`、status、玩家投影、prepared 原生安装和六种 payload slot 都保留原实现。数据复制仍按原 structuredClone、稠密数组、有限数、循环检查和对象可选 undefined 处理；本批不收窄旧接受集合，不新增库存 schema 或归档 codec。

## 顺序与失败

- 原授予先复制和核对来源，再写实际字典，最后发布。发布时仍先取得事件 push 方法，随后读取时间／实例字段／来源克隆；发布失败不撤回已安装槽。
- 原转移保留 statePolicy 调用、复制与黑市组件／生命／字典实例／state／source／规范化内容复验。目标安装及 granted 发布成功后，才 delete 原槽、取得或建立原退休数组并 push，最后发布 transferred_out。中途异常只保留此前状态和事实，没有事务退款。
- 原 metadata 使用记账仍先 lastUsedDay 再可选增加 uses；Demon 的特有 uses 再 lastUsedDay、完整审计和封存完全不动。临时抑制和借用租约仍由原机制控制；借用退役的 Object.defineProperty 查找及晚 supplier 未改。
- 新物理模块与内部 shared export 改变了初始化接线和直接叶 API。完整程序逆证明约定接线后的原算法；不主张任意模块替换、private monkeypatch 或整仓初始化时序完全相同。

两个商人源和三个传输测试原英文头译为有效中文；独立审查后仅将商人头的“等待／提交”准确修为“跳过／提交”（事实表示本夜已跳过），另外补授予数据结构、已安装发布前缀、晚政策复验与 delete／push 前缀的中文说明，不翻译机器字面。

## 有界证据

新增四个独立字面测试一次执行通过，22 个断言：来源读取失败保安装、目标发布失败保目标和未删源、退休 getter 失败保删除前缀和目标事实、黑市晚 source 替换撤销转移。原明确 transfer 政策用例单独一次通过，六个断言。原 Lucky 死亡到期精准用例首次发现本批误删仍在循环中使用的 COMPONENT 值导入，真实 ReferenceError 留存；只恢复该原导入并单独重跑失败用例，通过五个断言。最终六个不同用例，共 33 个成功断言；不把首次失败或多次执行写成一次全绿。

完整来源证据逐项比较四个迁出声明、两个 shared 声明、六个原 metadata 命令和完整旧程序 2,480 个节点。34 个初始消费文件完整 70,382 个节点及双输出精确导入／说明逆；后继 Seer 文件另 1,367 个节点／双输出，之前 39 个源码重新核字节且不重复旧程序检查。12 个控制源保持原 Git 和当前完整字节。

25 个新 owner 导入绑定与原物理来源逐项核对；两个新 owner 的实际擦除后值导入闭包 80 模块／153 条边没有返回新 owner 的环。这个有限静态图不执行 require／动态路径，不等于全仓图或历史初始化顺序。

最终有限类型与实际中文职责检查以 [收据](generated/night-ability-grants-receipts.json) 登记真实终态；不执行已绿色的 Seer 测试、完整 suite、整局、全量门禁或模型。不更新 seed、golden、严格来源身份或旧 schema2。矩阵整格仍部分交付。

[冻结范围](generated/night-ability-grants-scope-final.json) · [完整程序对照](generated/night-ability-grants-proof.json) · [绑定与有限图](generated/night-ability-grants-bindings.json)

末两处中文精度修改保存前冻结范围及完整工作树 before，原类型／测试／职责头收据保真实前阶段。只核这两源完整非注释程序和四份原始输出桥，不重复原绿检查。
