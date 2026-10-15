# 夜之贵族／秘密之身的同引用状态槽

本批 C17 将既有数据提交及本地审计影子的完整算法归 `noble_secret_body/state.ts`。现行角色是夜之贵族与觉醒愚者；秘密之身是后者的资源，不新增角色或玩法。真实 before 为 Git `354c935c3df0a784d8644bee53b0ec481e9a6934`，两生产源与六控制在捕获时均同字节。

## 唯一职责与真实接线

源码只含原 state、authority 和一个新单元测试，共三个路径。

- `state.ts` 原本就拥有两种 factory、严格数据 reader、选择及终态副本。本批在同一 owner 增加具体 `NobleBodyStateSlot`，完整收走原描述符检查／逐字段写入、两个提交后的 JSON 编码、两种 schema 副本的 JSON 比较，以及两个影子解析。
- 槽保存同一 nobleState／bodyState 原引用和唯一两个私有 JSON 字符串；没有第二份可变库存或新的 World 表。归一化 reader 返回副本，不能拿它替换原身份。
- `authority.ts` 保持唯一原 roster、Role／容器／Identity／生命绑定、夜间、请求、合同目标与已付款标记。先核原容器内两个状态引用，再让槽做原内容比较；不把合法数据当成许可。
- 原 profile 仍调用同一个 factory。独立 recording 检查点入口、伤害求解及玩家知情投影都未改；没有为新 owner 增加文件 I/O 或归档字段。

七个原实际提交点均直接调用槽：选夜仆、选保护目标、猎魔清除、到期、真实死亡关闭契约、夜间实际抵伤、白天放逐耗身。纯 next 的求值位置、随后 lease／知识／目标绑定／结算标记和回执顺序均保留。实际生命和死亡写入不归状态槽。

## 接受集合与失败前缀

原 reader 的 Proxy、精确字段、稠密数组、历史相关性、policy、nullable 和默认值全部保留。reader 原来可接受 null prototype 数据；原写入仍要求普通 Object.prototype、own data descriptor、writable/configurable 和原字段数，不能为了统一而放宽或收窄两者。没有新增 schema、冻结原库存或升级为逐层数组引用租约。

写入先完整检查原描述符，再沿原 `Reflect.ownKeys` 顺序逐字段 `defineProperty`，保持枚举等原属性。字段写入之后才读取 `JSON.stringify` 并编码 next；编码失败时原对象可能已改变，旧影子保持，外层尚未继续 lease／知识／目标绑定。中途字段写失败也保留此前字段，不退款或自动修复。

初始安装在原影子字段的位置，先编码原 normalized nobleData、后编码 bodyData，再继续原 Map 和通知数据构造。内容比较仍先贵族、后身体并短路；`JSON.stringify` 的方法读取和接收方保留。checkpoint 在原每个属性位置逐次 `JSON.parse` 已编码影子，不提前一次聚合或重验成新归档 schema；失败检查点仍可描述旧影子与未完成提交。

## 完整程序与有限验收

[完整证明](generated/noble-body-state-slot-program-proof.json)直接取当前槽的全部算法，不拿旧业务 body 替代：

- 原字段写函数完整 248 个节点保持；当前槽十个成员、四条构造赋值、两种 commit、两种比较与解码均逐项核对。
- 精确展开当前槽方法、七个 writer、所有原引用和两 checkpoint 表达式后，完整 authority 8,980 个节点及原 state 3,806 个节点保持，四份完整 ESNext／CommonJS 逆后输出字节同。
- 新测试只补一个 object 字段的明确 type 视图，两份完整运行输出同；没有修改预期、输入或生产类型来抹除诊断。
- 新四个有界 case 一次通过／27 断言：比较短路与 JSON 接收方、字段写后编码失败、晚字段写失败、真实保护选择失败的 raw／影子／lease 分歧。原 required-steps／final-damage 精准 case 一次通过／3 断言，共五个独立 case／30 断言。
- 有限三根首类型检查只有新测试 TS2339；两个生产根无诊断。精确类型修正后只检查失败测试根，session60636／fe0373 实际退出 0，未重复另外两根或已绿运行测试。
- 三源原冻结输入的真实职责头检查 0 诊断，三个中文头均有效；公开文档路径输入为 452。源码空白检查 0。随后只将三头角色名精确为“夜之贵族”，并为主动选择、一次身体与历史契约补中文结构说明；[末注释桥](generated/noble-body-state-slot-comment-delta.json)证明三完整程序及六输出同，没有重跑职责头、类型或已绿测试。

实际收据见[验证来源](generated/noble-body-state-slot-receipts.json)，[六控制](generated/noble-body-state-slot-controls.json)和[最终三源 SHA](generated/noble-body-state-slot-scope-final.json)已冻结。

## 明确变化与限制

新增运行 class 的公开出口、authority 私有字段布局、构造 allocation、方法调用与错误栈有意变化。证明覆盖具体算法与完整程序精确结构逆，不称两个当前新模块的直接二进制恒同，也不承诺任意 private monkey patch 环境等价。

槽的 JSON codec 仅服务原本地审计影子，不替代独立 recording verifier、strict Tape 或全档案 schema。原来源 hash／版本／历史档案不改；源码变化仍进入当前执行指纹。World、生命、夜间和请求撤权仍由原机制权威校验。本批不代表 C17 或 P3 全部完成；没有运行全量类型、全套测试、整局、模型、网络或全量结构门禁。
