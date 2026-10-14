# 噩梦之影状态槽

## 本次边界

以实际 `0cbe610f5e5293d6b3f4d64628fb750759a4a0e4` Git 为基线，16 路径：15 个现行源、删除原 `nightmare_shadow/state.ts`。13 个旧源全文和四个稳定控制源已与该 Git 核对；首盘点漏出的 `target_hint_registry.ts` 在修改前另核完整原字节后纳入。

- `state-slot.ts` 拥有原构造、live 校验、原状态读取、玩家副本，以及原初始化、三项字段写入、历史追加和身份编码。
- `targets.ts` 拥有完整原恐惧目标政策，复用原日期谓词；不从数据槽读取或产生运行窗口。
- `night_frame.ts` 仍持有名单、能力／原生命绑定、夜窗口、`expectedState` 与 `committed → target → wolfBlocked`。槽不另存 WeakMap、shadow 或许可。
- 公共 `ports.ts` 导出真实同绑定 get／project／target 查询；没有新增写者出口。六个旧测试仅迁原路由；Root 只迁 projector 的一条 import。

原 state 的七个命名函数完整分归两个 owner，接受面没有收紧：仍先拒绝 Proxy、仅读自身 data descriptor，但没有新增精确键 schema。get 保留原 state／history 引用；project 按原顺序复制字段和每条历史。readonly 是读方类型，不能当行动资格。

## 时点与失败前缀

初始化保留左值容器先读，再读两项政策及创建／赋值。实际恐惧提交仍先完成名单、日期、目标与原生命检查，随后 `lastDay → lastTarget → packReady → Array.prototype.push.call`；push／call 查找先于 history 容器晚读。

身份编码逐条读取历史后才查 `JSON.stringify`，不调用原状态自己的 `toJSON`。frame 仅在编码成功后写 `expectedState`，再提交夜字段。push 失败保留已写三字段；编码失败保留追加历史，不回滚、补付款或提前标 committed。原首次死亡禁言、相邻夜禁选、首夜同伴知识和狼刀政策不变。

头与重要逻辑注释使用准确正式名“噩梦之影”，说明原状态／副本、写权、读取顺序与失败前缀，不翻译机器标识或原测试标题。

## 验证与证据

- 三个新字面风险用例：初始化 LHS／政策 getter 顺序，push callee 失败前缀，JSON lookup 失败后的 history／旧 checkpoint 撤权。`1bb95a`：3／0／16。
- 一个原精准首恐惧与狼刀／知识场景：`ff1850`：1／0／13，另 10 filtered。共四个不同成功用例、29 个断言，分两次运行；没有重复已绿用例。
- 15 个现行根首次有限类型：`bc9391`／session 53239 → `5139e9`，exit 0。没有编译删除文件，也不含全仓 gate。
- 同一 15 源原职责检查：`791175`，571 个当时 Git 文档路径，诊断与中文头缺失均 0。
- 完整原 state、真实新 identity／写序／install 四个程序及 12 完整旧消费者精确逆：`761e75`／session 7269 → `3354a4`，exit 0。共 14,162 个 typed 节点和 32 个完整 ESNext／CJS 映射输出；七函数逐体核对另列，不重复计入该汇总。
- 273 个原 import binding 保持实际物理端点；仅删除 frame 已移到槽使用的纯类型 `NightmareShadowState` 和 profile 已由槽安装使用的 `freshNightmareShadowState` binding，新增两处真实槽 binding。五个当前源码根全字面语法盘点 1,747 文件、29 个 canonical 站点、旧 state 引用 0。
- 新 slot／targets 当前相对值依赖闭包分别 2／4 源，无回 frame／profile／stage；这是有限当前采样，不是全历史 cold 图。四个原数据／生命控制源保持完整 Git／工作区字节。

首次测试写入命令工作目录错误，实际没有创建文件／执行 case；正确路径写入后才有上述三例。证明工具三次失败是两处 empty-after 删除反向定位与新旧 binding 递归解析不对称；首脚本与诊断保留，修比较器后通过，没有改产品求绿。

## API 和范围限制

原私有 state 路径退休，新增冻结 SLOT 方法表、thunk／方法调用、模块与调用栈是明确 API／布局／加载变化；不保证仓外私有导入、任意 prototype monkeypatch 或 CJS namespace 整导出替换等价。玩家投影和身份 JSON 都不提供许可或严格档案 decoder。

数据槽只收本族实际写入，不改变 frame 的名单、原生命、能力、窗口或 checkpoint 生命周期；目标政策独立，不合并其他角色规则。字面库存覆盖 `backend/src`、`backend/tests`、`frontend/src`、`packages`、`tooling`，不涵盖计算加载、仓外或历史 generated。未运行完整对局、模型、全量类型／结构／行为门禁，也不声明 C17、P9 或全玩法完成。

## 冻结后 EOF 空白修复

Root 首次 staged diff-check `8c738c` exit 2 仅发现 targets 的 EOF 额外空行；已只删除最后一个多余 LF。`0f940f` exit 0：完整 187 typed 节点／205 非注释叶及两完整输出保持；其余 14 源完全相同。原类型、测试、头和整体证明保原采样阶段，没有重跑绿。原 scope／evidence 和完整 targets 前字节另存，最终 source SHA 由该窄桥连接。
