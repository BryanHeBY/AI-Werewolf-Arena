# 魔术师状态槽归属

## 范围

实际基线 `e45c972b2a271a09bce51c103399af66714fc527`。15 个源码路径：12 个现有消费者修改、旧 `magician/state.ts` 删除、新本族 `state-slot.ts` 和一个单元测试；最终 14 个现行源码。完整范围、原文与哈希保存在 [scope](generated/magician-state-slot-scope-final.json) 和 [before](generated/magician-state-slot-before.json)。

本批收走创建、完整 live 数据校验、同引用读取、脱离知识投影，以及真实初始化／历史追加／原身份编码算法。旧物理模块退休，不保留转发；现有函数名在新 owner 保留，本族公开 ports 同绑定导出读取和投影。Observation 只改魔术师 import 路由。共享类型、录制、独立档案核验、PM、DR 与其他机制不改。

## 原时序与写权

- 初始化仍先取得原左值容器，再读解析值两个参数并创建、赋值；不预读或补写。
- 历史追加仍先取得 `Object.defineProperty` callee，再两次读取同一个 binding 的 state/history，以原 index 和 descriptor 写入原 pair 引用。
- 追加后仍刷新 `expectedState`，随后更新交换 pair 和 committed；编码失败留下原已追加历史，不回滚、不授新资源。
- 完整 descriptor、Proxy、日次和号码规则保持。合法读取返回原状态引用；投影复制 history/pair，保持原可写 DTO。`readonly` 不冻结状态。
- frame 继续拥有原体生命、夜窗口、交换关系与原 `expectedState` 检查点。槽的 JSON 编码只是原运行身份比较，不是档案 decoder、许可或第二份状态。

方法表及其子表冻结，原状态、历史和知识副本不因此冻结。`allowedWrites` 是内部实际写步骤归属，不是新的运行权限屏障；调用前的原体／窗口准入仍由 frame 执行。

## 验证

[完整程序证明](generated/magician-state-slot-proof.json) 核对四段实际生产程序（原 state 核心、搬走的身份编码、历史写和初始化）及 12 个完整消费者：14,502 个 typed 节点、全非注释 token 树、32 个完整 ES/CJS 输出相同。消费者逆向展开真实新 writer／identity 算法，不以恢复整个旧函数替代新 owner 验证。四个共享契约／核验器／生命周期控制源码保原 Git 全字节。

[绑定证明](generated/magician-state-slot-bindings.json) 核对全部 281→283 个 import/export 模式、名字、别名及路线：262 个原样、19 个路线迁移；一个原 factory import 改为槽表，另新增 frame 表和公开 project 绑定。六个本族值声明物理终点明确；未将全部模式对照称为所有外部包声明证明。新槽沿用原 state 的直接依赖；当前 94 模块、286 边的有界静态值图不回到 frame、profile 或 Observation，不等于冷加载执行或全图循环证明。

实际仓内 1,721 个 TS/JS 文件的具名字面 import/export、import-type、dynamic/require/ImportEquals 盘点有 28 个本族新槽／公开 ports 入口，旧路径零消费；backend/scripts 追加搜索亦零匹配。计算加载及仓外消费者不在穷尽声称中。

[真实收据](generated/magician-state-slot-receipts.json)：新单元 3/0/25；原 Frame 精确用例 1/0/16、10 filtered。两次执行共 4 个不同用例、41 个断言，不是完整套件。有限 14 根类型一次实际退出 0；14 根职责头一次退出 0，采样 529 个实际 Git 文档路径、零诊断。没有重全门禁、整局或模型。

运行／类型采样之后，owner 仅修首头“不再”→“不另”与恢复 create 原换行／尾逗号。完整 ES/CJS 两输出相同的窄桥连接最终哈希；这项排版不冒称纯注释，原绿不重跑。其他源码不因此变化。

## API 与限制

旧 `magician/state.ts` 路径退出；新槽方法表和额外调用层是明确内部 API／初始化／调用栈变化。原可写状态、同引用读取、完整接受政策与失败前缀保留，不承诺仓外旧路径或任意 CJS namespace 重绑定的反射等价。

新单元直接调用写方法只验证算法，不冒充已获行动许可。原档案字段、档案 schema、严格 replay 验证与 source fingerprint 历史不改写；物理源、注释和入口变化会改变当前构建 sourceHash，不提供跨构建复现豁免。本批完成一个本族状态职责，不宣称整个 C17 或最终行为验收完成。
