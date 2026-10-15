# F05b World 消费者与真实阵营测试输入

本分组执行 [当前阵营输入政策](camp-canonical-input-policy.md)。正式前态为 `4ffba3d9820d1fee72f28af20c2125732ade3013`；原 165 个候选的完整 Git 原文保存在 `generated/camp-canonical-world-inputs-before.json`，首次联合类型诊断补获五个真实消费者，追加全文由 `before-expanded.json` 连接。现范围为 13 个生产文件与 157 个测试候选，实际修改 13 个生产文件和 152 个测试文件，另外 5 个候选保持原字节。本分组不持有公共工厂、角色 ctx、角色状态槽或总政策文档。

## 生产读取责任

诊断、玩家回合记录、夜结果玩家字段、运行事件记录与模拟输出，在原阵营字段位置读取同一 World 的实际 `CampComponent`。原 Role 缺失短路以及允许的 `unknown` 回退保留。原本必填的 roster、玩家提示与模拟结果字段缺少实际 Camp 时在该数据位置失败，不用 Catalog 默认阵营制造当前值。

狼队可见性、目标提示、默认胜负规则与魅惑放逐规则分别沿原条件位置读取实际 Camp；没有统一阵营缓存或新的授权谓词。已安装的初始 roster、动物审计、婚约与孤女审计、初始选牌历史仍保各自优先级；记录中的历史阵营、查验标签、Victory、消息与 DTO 字段不作为当前组件删除。

这是声明的新数据输入通道：同位置的 World 查询可能新增 actorId getter 读取，缺失 Camp 也有明确的新接受边界。不声称任意 getter 次数、私有反射或旧构造参数的运行等价；不通过提前缓存伪造这种等价。

## 测试输入适配

实际构造调用退出旧 camp 参数，原展示 locale 保留；raw World 夹具明确安装原枚举值的 Camp，已有组件引用不重复替换。无 World 的夹具独立持有实际 Camp 对象及惰性 source，不建立 Role 到 Camp 的索引、镜像或兼容 WeakMap。原角色、生命、请求、资源、历史、错误字符串与事件 oracle 保持，涉及新的真实阵营输入与故障读数的差异单独登记。

坏阵营与 getter 负例继续使用合法 Role 和有效状态，故障注入移到实际 Camp 组件。需要阵营的查验缺失值按总政策返回 null；仅查角色及固定披露标签不伪造阵营。三个原本只替换 Role 的反例继续保留已有实际 Camp 引用，避免新增 Camp 引用失效掩盖原体撤权。已退休 Role.camp 的静态拒绝用例明确保持为旧 API 负例。

野孩子转换的 Camp 安装若在实际写入之前抛错，World 中仍是旧 Good；旧 Role.camp 已变为 Wolf 的读数不再是当前数据来源。相关断言改读真实 Good，并保持同 Error、已付款／事件／组件引用、永久执行退休与已付效果边界。实际安装后或后续 Victory 失败仍读取已安装 Wolf。恢复真实 Camp 值不恢复 F05a 的永久执行退休。这是 F05b 输入及失败数据政策变化，不包装为无行为差异的路由迁移。

## 阶段与验证

首个 source-ready 阶段完整保存在 `generated/camp-canonical-world-inputs-source-ready-first.json`（`2a31ec40411b7e12b62ac690265b13460ce0b07d73ae713bab13c245f0721be7`）。随后就绪阶段 `18149d13…`、四个测试源的差异以及首类型修复前全文分别保留。首次完整证明采用该 165 候选／446 步阶段，真实终态为 0：264854 typed 节点、50613 NodeArray、344326 非注释叶及 330 个整逆输出。原证明、脚本和终端收据保持；后继修复只做实际新增差异的增量桥，不重整证明。

Root 的首次完整 backend source／tests 类型实际退出 2（73 条诊断）；本组遗漏的 Role 别名、查询必填 source 尾及 COMPONENT 绑定按真实失败根修复。六个原 NightStageContext 夹具在实际 4ff 中已缺少必填 requestFactory，本次经授权补返回已 import 的真实 GameActionRequestFactory 构造器，保原 makeRequest 实例及构造点。这是明确的旧夹具输入闭合，不声称测试 JS 字节或任意反射相同，也不放宽公共接口。

联合后继只检查 40 个失败／新增／修改根，真实 `e7cf46`／session `70474` → `a96ffc` 退出 0；首个有限配置的 TS2688 类型路径环境错误另保，修 typeRoots 后没有重复原绿色完整程序。职责头首 331 根保五条诊断、四个失败根；只检查四个失败根及十个新增输入，共 14 根 `656b95` 退出 0。完整联合指针与命令由 `generated/camp-canonical-cohort-checks.json` 承接，不把空 stdout 单独当成功，也不称首次完整类型已绿。

首类型修复后为 170 个候选、477 个精确步骤，源码冻结。首次增量证明只覆盖 22 个修复程序（其中五个新增 Git 消费者）：52035 typed 节点、9597 NodeArray、66836 非注释叶、44 个整逆输出，真实终态 0。类型与职责头由 Root 统一执行，本分组不重复；其末收据由联合记录承接。证明核对实际 Git 前态、完整精确正逆变换、程序 kind／叶文本／NodeArray、受保护 JSDoc 与 ES／CJS 输出；它证明登记变换与程序范围，不证明 F05b 与旧输入运行等价。

经 Root 许可，在后继 World `aa3205…`／Ref `fa6b0d…` 共同输入首次执行四个精准用例：Wild 的 Camp 写入前失败（22 断言）、Camp 已安装后 Victory 失败（14）、中文 camp／role／combined 查验标签（12）、六人有序装配的 successful guard（144）。四个不同用例分别执行一次，均真实退出 0，合计 192 断言。原命令、stdout、源 SHA 与退出收据逐次保存；不能把这四例称为整个 152 个测试文件、seed 矩阵、模型、全部角色或首 `2ea0…` fence 的行为验收。

同行随后指出 initial_roster 实际使用 entityIds，并未读取 seat；只将职责头的“实际 World 座位”改为“实际 World 实体名单”。完整当前前样与单注释正逆／非注释程序／两份整输出桥保存，真实退出 0；原类型、头、行为与证明保持各自采样。末登记为 478 步，不增加运行逻辑或重复绿色检查。

## 非作者审查后的最窄输入修复

非作者完整审读另发现八个测试源中的九项必要差异：一条旧双源相等断言变成自等式，保留前条独立阵营预期，并改后条核 `Object.hasOwn(role, "camp") === false`；另三个 Role-only 替换反例移除误添的 Camp 安装，保已有实际组件引用；五处字面 Role matcher 拆成原 Role 身份与同玩家 World Camp 的独立 Good 断言。原 formal Scope／MD／evidence／checked source 及八个完整前样保存，不能把这些称为原所有 oracle 字节不变。唯一八程序逆桥 `829d6b` 退出 0，19227 typed／3913 NodeArray／25394 非注释叶／16 整逆输出；前绿色整证明和四个行为用例不重跑。

这九个此前未跑的精准场景首次结果为八绿、135 断言和一条真红。孤女 replaced_state_getter 的原 raw config 在 provider 之前被配置身份 guard 拒绝，未进入 Role 替换分支；不能把这个错误归因于删除 Camp 安装。Root 限定同一循环的三种 provider 负例传 `{...g, config:g.boardConfig}`，保所有 getter／Role／Target、标题和 checkpoint oracle；共享 helper 与其它 raw 输入不变。只复唯一真失败及另两种未执行输入，`87283e` 实际三例／21 断言退出 0；唯一源逆桥 `65b4df` 退出 0，4479 typed／969 NodeArray／5923 非注释叶／两整逆输出。首红源码与 stdout 保留。

末共 488 个精确步骤，实际源范围仍 165、候选仍 170。累计 15 个不同用例最终通过，16 次 case 执行中保一条真实首红，成功断言共 348；不是全部测试文件或全部旧夹具通过。后继八测试源只按必要精准输入验，不重复原绿色类型、职责头、四例或完整程序证明。

本分组不宣称全部角色权限、严格复现、中文覆盖或 P9 已完成，不运行模型、私有配置或全门禁。
