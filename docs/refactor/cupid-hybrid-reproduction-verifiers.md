# 丘比特／混血儿独立严格档案核验

## 范围与准入政策

实际 before 为 `f5ee25e1dc9a04a047c9a063aca4ec27f295e08f`：原装配全文 1 源、新路径缺席 3 源。新建两个独立核验 owner、一份手写字面 Tape 单元；装配保留原 16 步全文与首错顺序，只在末尾调用 Cupid、Hybrid。未修改录制 schema、私态 codec、两个运行阶段、关系写方、租约或遗言。

这是 **同 Tape schema 2 的新增严格语义拒绝政策**。原本未拒绝的伪造／矛盾严格档案会新增拒绝，也可能先于执行器原 sourceHash 不匹配错误；不宣称机械行为等价。新的源码和路由参与新构建 sourceHash，精确内部 Tape 执行继续核真实 source／lock 身份，不猜祖父版本、不改历史指纹。公开 replay／player reader 不调用这两个核验器，其历史兼容规则保持原路径。

## 唯一职责与可审计数据

| owner | 独立核验 | 原运行权仍归谁 |
| --- | --- | --- |
| `verification/reproduction/cupid.ts` | 有限板子／两来源政策、首夜至多三次请求、配对与原阵营、remaining／choice／Lovers、按插入顺序安装的 Victory、选择→两次互认→关系事实、殉情方向／枪抑制证据、关系或普通阵营成员 | 原 stage／relation 持关系与付款；死亡写方、判胜和阶段经理仍持真实权力 |
| `verification/reproduction/hybrid.ts` | 首夜榜样与必选请求、真实 Good 身份与捕获目标 Camp 分离、remaining→choice→Victory→选择事实→隐藏归属事实、死者仍按已冻结归属获胜、配置顺序的屠城／屠边／狼半条件 | 原 stage／state-slot 持付款；World 持组件，原胜利条件和经理封盘 |

只 value-import 中立契约、纯事实和结果 reader；Record 仅 type-import。独立规则与测试不加载生产 World、stage、关系／胜利 owner 或 checkpoint 写方计算预期。原其他角色私态扩展不按当前角色删除；本族严格数据与字段／事实相关性独立审核。

### 失败前缀

- Cupid 先安装 Lovers，再消费 remaining、写 choice，再按原配对／actor 插入顺序安装归属，最后发表四条选择／互认／关系事实。失败 CP 可以停在任何实际可观察前缀，不要求未发表事实已存在，也不退款。
- Hybrid 先构造归属，才写 remaining、choice、安装 Victory，随后发表两事实；只剩余次数已写而 choice 尚空是可保留前缀。
- 已封盘后发表／收尾再失败，`complete=false` 仍可能带真实终态；按已提交数据核对，不抹终态。`lovers_death` 在真实标死前发表，失败 CP 可见事实而目标仍活；不能单凭它认定死亡已提交。
- Trace 的 deferred false 会把 outcome 覆盖为 error、丢弃原 returned action；pending 也未保存候选。只有最后一次同族决定可承载已付选择：known action 必须解析并匹配 CP 的配对／目标；末次 error／pending 可由 CP／facts 确定合法数据与可达写序。更早匹配或 opaque 不解释后继不同 known／null／无效回复；Hybrid 仅写 remaining、choice 尚空也必须由末次 valid-or-opaque 解释。这只说明记录证据不足，**不把 opaque 当授权或回复内容证明**。

### 受众与证据限界

God Tape 原 Cupid／Hybrid 事件均无显式 audience，原 schema 也不允许这两族补 `[actor]`／`[]`。核验保持原缺省，检查事实种类和精确字段；请求的 visible_events 只能带本人的选择／互认，不能带秘密关系／阵营结算。Tape 不含另存玩家时间线，不能据此声称全部玩家档隐私验收完成。

Tape 未序列化 life/version、组件 ref、执行退休、请求 alias／lease 或精确逐请求事件游标；不补造完整 current／await 授权审计，也不宣称全部跨族死亡闭包、C17／C37 整阶段完成。

## 来源与验证阶段

首 ready `c7e9aff3…` 保存于 `source-ready-first.json`。Root 首执行前静态审查发现 opaque settlement 证据缺口，保存两 owner／unit 全文与精确后继 delta；这是静态 finding，未冒运行红灯。最终待检查 ready 为 `51812834…`。

before 中七条参考均为实际 Git 全文；其中 Cupid／Hybrid 两 stage 后继由 Root 并行接租约，只保原来源和后继采样，不要求 current 与旧 Git 同字节。另五条为固定控制。测试／类型／头／程序证明均由 Root 统一执行，作者未运行任何检查。

### 实际首次执行与仅失败后继

| 检查 | Root 实际收据与范围 |
| --- | --- |
| 独立新单元 | `d3ed1f` 首次退出 0，13 个不同声明、76 次成功断言；未跑旧局、语言／transport／seed 矩阵 |
| 四头 | `a533ae` 首次退出 0，4 源／727 当时 Git 文档，零诊断 |
| 主证明 | `ca3d96` 首次退出 0：原装配 16 完整语句原文保持，4 精确全文编辑正逆、181 typed／38 NodeArray／74 非注释叶与两 whole inverse 输出；两个新 owner 的实际端点／中立 value imports 独立核明。新算法不以旧程序等价自证 |
| 首共同类型 | `2ced09`／88699 → `dc5601` 真实退出 2，10 根的 23 条诊断全部在两个新 verifier。不是首次全绿 |
| 仅失败类型修复 | 各一处把 `fail` 的 never 函数类型显式写在变量上，运行 JS 不改。首两源全文及原 raw 保留；`91c958` 窄桥首次退出 0，两整程序精确正逆、四份 actual ES／CJS 相同，另两源字节不变 |
| 后继有限类型 | `04b7aa`／75119 → `aecef4` 退出 0，仅两 failed owner 加另一批实际变更单元，共 3 根；空 raw。没有末 10 根或全仓重新运行 |

主证明采到两个 owner 的原 typed 数量为 Cupid 3,571／401 arrays／1,882 非注释叶、Hybrid 2,835／312／1,515；类型后继各增加 1 typed node／1 NodeArray，叶数不变，当前 typed 树有实际类型位置差异，不冒 typed 树全同。两完整运行输出由窄桥承接，原业务／头／主证明全部不重跑。

另一批真实 Trace 第 14 声明因 builder 把 requiresAction 放入严格 context 先于本 owner 发生 schema 红；修唯一输入后 `0e7ef1` 一次失败后继 1 pass／24 expect／13 filtered，两族部分付款 error CP 实际经过 Trace→本 parser 通过。这是协同 producer 消费证据，不计入本批 13 个独立字面声明、76 断言，也不把其早期输入错误归因本核验器。完整共同阶段由唯一 `relationship-last-words-joint-type-receipts.json` 保存。

## 独立审查的末次决定因果修正

NativeFinal 静态审查指出：首稿的任一 known 匹配会掩盖后来不同 known／null／无效回复。真实阶段首次付款后退出，早 A 若付款不会出现后 B，若未付也不能越过末 B 返回提交 A。因此 Root 明确批准按**最后一次同族决定**核对；这是有意新增拒绝，不是类型修正或运行程序等价，也不是已执行的红测试。

首完整 formal scope `05cd206f…`、文档／证据／作者批准、Root `9989…` 批准及当时三源全文均保存为 snapshot，不覆盖首主证明、头、13 单元或类型桥。当前仅两个 owner 的候选准入／Hybrid 仅 debit 分支及附加一个新单元声明变化；装配未变。新声明用两族字面 A→B、A→null／invalid 拒绝和末 opaque 接纳，另核 Hybrid 仅 debit 的空回复拒绝／opaque 接纳。

| 唯一增量执行 | Root 实际结果 |
| --- | --- |
| 新因果声明 | `a466c2` 首次退出 0，1 pass／12 expect／13 filtered；原 13 声明与断言完整字节保留，没有复跑 |
| 三变根类型 | `d0add2`／94620 → `0b443c` 退出 0，只两个 owner 与新变 unit，空 raw |
| 精确增量证明 | `75b621` 首次退出 0，3 变源／4 精确 delta；三整程序逆演、6 whole inverse 输出相同；6 actual 输出明确不同；原 13 完整声明／断言保留，装配同首稿 |

本批独立单元累计 **14 个不同声明、88 次成功断言，分两次互不重复执行**。另一批真实 Trace 的第 14 声明是不同文件和输入，不混入此计数。当前源码冻结；无头、主证明、原 13 例或类型桥重跑。
