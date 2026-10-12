# 基础角色状态归属

## C17 数据与访问入口切片

`private_state.ts` 的剩余 15 个状态类型、28 个读取/安装入口归到 14 个实际机制：女巫、守卫、摄梦人、角色查验、猎人、狼王、白狼王、骑士、守墓人、狼美人、熊、隐狼、石像鬼和白痴。13 个原生 profile 直接使用其 owner；能力实例类型也从实际 owner 获取。石像鬼通过角色查验的具名公共 port 安装查验能力。

四类夜间能力继续调用既有 `installNativeAbility` 和 `findNightAbility`，保留安装时复制、原生优先选择和返回的实际实例引用。其余十类状态继续使用完全相同的 privateState 字符串槽，赋值后返回输入对象，不创建镜像或新存储。旧入口只具名导出同一函数与类型，按 C44 删除。

本切片只建立类型与访问的归属。现有规则校验、实际 mutation、原体绑定、生命周期、玩家投影及 checkpoint 编码仍由原模块持有，后续必须分别迁移，不能把本笔登记为全部 C17/C20 完成。外部存档字段、角色 ID、资源消耗和历史 DTO 不变。

## 验证与审查

原 Git `2acf56d` 的声明逐项比较：15 个类型仅调整同目标的相对类型路径；四类能力的八个访问函数原文保持；十类 private slot 的二十个函数仅内联原 `getState`/`setState` 的实际语句并替换相同字面键。14 个真实消费者的全部非 import 正文逐字保持。

57 项有限源码比较、30 个职责头检查通过。十类原 private slot 的实际探针另核对同一函数、同一返回引用、一次原键写入及抛出原 getter 错误，共 60 项；探针只验证访问契约，不作为合法角色状态或完整规则覆盖。完整后端源码类型检查通过；既有角色目录四项与 Seer 状态四项共 8 项、293 次断言通过。未重复后端对局、浏览器或全量测试。独立审查核对实际 Git、槽引用、读写顺序和导入边界后提交。

## Knight 消费写权

Knight 的公开状态字段 `canDuel` 为只读类型视图，仍是原 privateState 对象，没有 runtime freeze 或 clone。日间窗口通过机制公共 port 读取资格及引用；实际 duel commit 完成原校验后，调用 feature 内的 `consumeKnightDuel` 执行原唯一消费写入。该命令不重新获取状态、不重新检查候选、不发布事件，也不提前标死；后续发布失败仍保留已付库存。

原 commit 全文仅替换该赋值为具体 owner 命令；窗口运行正文及原状态声明仅 readonly 类型标记以外保持。新增三个有限单元测试覆盖发布失败、资源 setter 拒绝及 captured slot 不得再次读取，15 次断言通过；只读字段的编译负例和原 Knight/投影消费者的有限类型检查通过。原存档的 `knight.canDuel` 字段及玩家 DTO 不变，复杂机制的 schema/编码贡献仍按后续切片收口。

## White Wolf King 消费写权

公开原生状态 `canDetonate` 为只读字段，保留原 privateState 引用。窗口、提示和实际自爆提交通过白狼王公共 port 读取；提交完成原目标校验和 death proposal 构造后，调用具体 `consumeWhiteWolfDetonation` 执行原一次 false 写入，随后才发布原事件。失败不重查状态、不退款、不改变最终死亡或窗口撤权。

原四份完整非 import 正文只允许该赋值和 readonly 类型标记的明确映射；六个职责头通过。两项发布/setter 失败测试、10 次断言与原消费者有限类型检查通过。独立八个 fresh 原/现 commit/window/prompt/catalog import 同成功及同出口，公共 port 与旧桥的函数引用一致。外部 checkpoint 与玩家 DTO 保持原字段，不混合普通枪或 Demon sealed stock。

## Hidden Wolf / Gargoyle 继承事实写权

两种资源各自的 `hasInheritedKnife` 是只读事实字段。原 inheritance 协调者完成原存活狼、阵营、角色及已继承检查后，调用各自具体 owner 命令写 true，再发布原事实。两个命令不重查、不变阵营、不返回当前刀权；Gargoyle 的当前刀权仍另检查已完成查验，Mechanical/Awakened 的学习资源不接这组命令。

原四份完整非 import 正文只映射两个赋值及 readonly 标记；setter/getter 逐字保留，同槽和同引用不变。四项发布失败/多个存活狼的有限测试、18 次断言与原 Hidden/Gargoyle 消费者有限类型检查通过。独立八个 fresh 原/现 inheritance/catalog/bootstrap import 同成功、同出口，五个职责头通过。没有回滚已继承事实、提前死亡或修改存档。

## Guard 普通 lastTarget 写权

原 native captured-state 与 recipient 两条 lastTarget 写入归 Guard owner，公开读取字段只读。Native 仍在原 marks/claims、事件和 logic op 之后、ability use 之前写入；recipient 仍在原 marks/claims 之后、事件之前写入。Recipient 命令先取得原 ability.state 的赋值引用，再读 target.id，target getter 更换 slot 不能把已选择的写入转移到新对象。Demon sealed 第三 writer 与原生/赠予库存政策保持原 owner。

原三份完整非 import 正文经明确调用/type 标记逆向一致，五个职责头通过。三项 getter 换槽/抛错、setter 拒绝测试、13 次断言及原 repeat/night abilities 消费者有限类型检查通过。独立直接比较固定 Git 赋值与新 helper 的三种错误/引用前缀，并核八个 fresh stage/recipient/catalog/bootstrap import 同成功及同出口。没有新重查、clone、refund、use accounting 或归档字段。

## Witch 普通 payload 写入

reset、self-heal refresh、terminal pass/second-turn close、native heal/poison 消费及 recipient postfix poison 各有具体 owner 命令。reset 保两项 flag 写入后才按原 short circuit 调 currentDay，原方法 receiver 保持；refresh 先保 LHS state，再按原规则重复读 RHS ability.state。Native -= 与 recipient --/两次 state 读取分别保留，没有统一成一个通用库存操作。

原 marks/claims、use accounting、Time Consort commit、reflection、事件/记录次序不变。Demon sealed stock 与独立 verifier 的自有可写账本不调用这些生产命令。WitchState 的其他只读 API、codec 和全部 writer 权限仍须后续收敛，本批不冒完整 C17。

原三份全 token 语法经六调用逆映射一致，安装/读取原文不变，五个职责头通过。六项 setter/day/state-getter 前缀测试、20 次断言，原 second-turn pass 一项与有限类型检查通过。独立 reset 的 ctx receiver、第三 RHS state 读与原 LHS 引用、八个 fresh stage/recipient/catalog/bootstrap import 均核对。最初测试从 public port 误导入安装函数导致加载红，改为直接 state owner，生产端口未因此扩权；原红日志保留。

## Seer / Guard 目标政策入口

两个既有目标谓词归各自机制的公共 port，实际 night stage、profile 与提示候选使用同一函数。删除已无消费者的 target_policy/repeat_policy 叶子；原新鲜自查、重复守护政策、历史/day getter 的短路与错误顺序保持。Guard 没有新增最终提交重查。

七项原程序与既有 Guard 命令比较、七个职责头通过；新增四项、13 次断言及原 Seer await 后自查一项、五次断言通过，一次有限类型检查通过。独立源审和十个原/现 cold entry 的结果、出口相同。本批只整理目标政策归属，完整目标资格和状态编码仍继续。

## 普通选择与反馈历史写入

RoleInspection、Dreamer、Wolf Beauty 的三个原 payload 写入及 Gravekeeper 的单个 history push 归各自既有 state owner。运行流程在原位置调用具体命令，仍使用已经捕获的同一 state/target/day；Gravekeeper 的 fact 不提前展开，history/push 方法查找、fact spread 和两次 result 读取的错误前缀保持。

RoleInspection 的资格复查和 use accounting、Dreamer 的连续目标计算及已付效果、Beauty 的魅惑绑定、Gravekeeper 的资格/去重与所有事件均留在原顺序。命令不再查当前 state、World 或租约，不退款。本笔没有将可写状态类型改成只读，没有引入 schema/codec 或删除旧访问门面；这些权限与格式仍须后续完成。

十二项原程序逆向及八个职责头通过，四个原有限场景、43 次断言和一次有限类型检查通过。独立比较实际 Git 与完整写入/消费者程序、Gravekeeper 两种 getter/spread 成功和失败前缀，十二次 cold entry 原/现相同；Beauty/Gravekeeper 直接 stage 入口的原有 TDZ 保留并明确记录，没有以成功的 bootstrap 入口掩盖它。全量验收集中后置。
