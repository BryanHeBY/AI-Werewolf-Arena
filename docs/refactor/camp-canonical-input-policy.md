# F05b 当前阵营的单一输入来源

正式前态为已完成共同失败执行退休的 `4ffba3d9820d1fee72f28af20c2125732ade3013`。本批有限检查已完成，正在绑定非作者末审与原子提交范围。完整前稿已经保存；初始生产清单 140 路径，补获机械狼阶段调用和 Victory 的两处注释精度后为 142 个互斥领属候选；测试／support 初始 218 个候选，类型检查发现五个额外调用者后为 223 个。另新增三个独立风险测试文件；最终只计实际修改的路径。

## 当前状态与公开输入退休

删除 RoleComponent.camp，领域角色只持身份和私有容器。实际当前阵营由玩家的 CampComponent 提供；Catalog 元数据仅决定默认初值。历史快照、玩家知识、查验标签、技能历史阵营、Victory 和档案字段保各自语义。

现有 camp.ts 增加纯类型 `CurrentCampSource = () => CampComponent | undefined`。它不存状态、不授行动许可，也不反向寻找 Role 所属 World。领域工厂改为 `(role)`，展示工厂改为 `(role, locale?)`；旧 camp 参数、Role.camp getter／descriptor、自定义 init 的 Role.camp 写入和 applyRuntime 的默认空 ctx 明确退出支持，不保忽略参数或运行元数据回退。

RoleInitContext 必填同一个可写 initialCamp 句柄和晚读 currentCamp；custom init 改实际 draft.camp，正常展示和运行读取实际当前组件。纯初始化 helper 只保自己需要的字段。Camp 准备前移到 init 之前，是本批声明的失败时点变化，不冒任意旧 getter／构造错误前缀等价。

## 初始化与提交分支

Bootstrap 安装同一 draft。只有默认 Victory 分支在原 faction 字段表达式点读取当时已安装 Camp；缺少组件抛 `role_current_camp_missing`，不提前查询或新增全局枚举／Proxy 验证。membership 函数及显式数组不增加这个查询；函数的独立 ctx 仍没有 World，但携带同一 initialCamp 和 currentCamp。

初始选择只在 chosen 分支准备新 Role、draft、init 和默认 Victory；默认 Victory 从 init 完成的 draft 读取，不新增 membership 调用。运行 source 始终查询 World：新 Role 已装而新 Camp 未装时读取真实旧 Camp，不回退 draft。F05a 窄安装 catch 与失败退休继续保留。身份事实的 camp 字段仅 newRole 分支晚读完成时的实际 Camp，缺失错误保已安装／关闭／complete 前缀；retained 分支仍固定 Good。

## 晚读取与两类原体

源只在原 Camp 表达式处执行。普通 value-only 捕获比较值，允许缺失值为 undefined、同值组件替换保持当前；既有 dual-ref 权威保真实组件引用和版本／字段规则，同值新组件仍撤权。严格 OriginalPlayerScope 删除重复 roleCamp，但保 own-data campValue 的枚举校验。目标、roster 和纯已付效果不消费 F05a 的动作退休标记。

转换在 Camp 安装前抛错时，World 中实际阵营仍可能是 Good；移除 Role 的重复字段后，已捕获的纯值原体可立即匹配这个真实值。安装后抛错则保留已经安装的 Wolf。这是本批明确的输入与失败数据读取变化，不用影子阵营或退休标记伪造旧值失配。F05a 的行动资格继续拒绝失败 Role；纯已付效果、机械狼与觉醒隐狼的 effect-current 谓词不因此加入行动退休判断。错误对象、已付资源及已经发表的前缀仍保留；不能把本批接线声称为全部 55 个角色的行动授权收口。

九族数据槽沿各自原 own-data／Proxy／descriptor 策略读取实际 Camp，不建立统一严格读取器。Scholar 的原无条件 Camp 点继续无条件执行新 source；这一回调是新可观察输入，不宣称非法 Role 的全部历史轨迹不变。原状态／历史 schema、付款、排序、资源和来源规则不借此修改。

wolfTeam、自爆、baseline、原生／自定义展示和九族附加查询按声明位置传必填 source。原参数的 receiver、getter、短路和无 World 分支保留；五参普通狼回退补显式 undefined World。Catalog 传 `() => ctx.currentCamp()`，展示 dispatcher 不提前求值。三个 native rules.state 调用末传惰性 source，学习枪先读取原 runtime query 和 skill，再在原 Camp 点求值；普通 Hunter／WolfKing 状态读取可忽略新增参数。

查验标签保留贡献／回调、camp 回退与 role 标签的原读取顺序。需要阵营的查验在完成这些读取后，若实际 Camp 缺失则返回 null；只查角色仍执行原阵营回退表达式及其异常，但不要求该值存在。原本必须返回阵营的原生野孩子展示与记录 DTO，在原字段位置缺少组件时明确失败，不以元数据回退或类型断言伪造有效阵营。

新 source 是明确可观察的输入通道。原来读取 Role.camp 的 World 消费者改为同位置查询实际 Camp，可能在该位置增加 actorId getter 的读取；保留 Role 缺失、历史快照和审计的短路，不增加缓存去冒充任意 getter 计数等价。

## 验证与注释

调用／fixture 清单覆盖两个工厂、ctx、自定义贡献、九族 get／project／identity／next／reflection／target、枪 reader、反射及宽角色输入。旧键列表和忽略实际 Camp 的断言按明确 API 政策调整；坏 Camp 负例保真实 Role 和有效状态，不换成缺角色或坏状态求绿。World fixture 安装实际 Camp，worldless fixture 持显式组件与 source，不建立旧参数兼容索引或 Role→Camp 隐藏映射。

开发与输入适配按四个唯一文件 owner 并行，全部 source-ready 后才采样必要类型、风险用例与职责检查。源变更、真实首红、纯类型桥和后继修订分别登记；已通过检查不例行重复。新增及修改的维护注释使用中文，文件头之外说明数据身份、晚读取、付款和部分失败约束，审查核对说明与实际代码。

首次完整 backend 源／测试类型检查的 73 行诊断、有限配置的 TS2688 和四个职责头失败根均保留。修复只采 40 个失败／变更／新增类型根及 14 个失败／新头；后继两处真正变更再采两根类型，新查验单元单独首采。原成功检查不冒称在最后源码重复执行。六个旧 fixture 缺少既有 requestFactory 构造器端口和孤独少女三种 getter 反例使用 raw 配置，是此前接口接线遗留；补实际类与仅该反例循环的 canonical 板子，保原请求实例、getter 和断言，不把早于 provider 的真实失败归因于 Camp 迁移。

交叉审查同时修正旧 Role 匹配器中的 camp 字段、自等式断言、单独换 Role 时误添的 Camp 引用替换，以及缺 Role 的名单／目标短路。角色身份与实际 Camp 各自保独立预期，原反例不得靠新增撤权原因求绿。数据槽注释中的“不会执行 getter”明确仅指 Role／状态字段校验；显式 source 是可执行输入，在原 Camp 读取点调用并可原样抛错。

本批不扩大有限玩法组合、不替换领域引擎或增加 Agent 框架，不修改私配置、不调用模型或自动推送。独立 oracle、全角色能力闭包、严格复现和 P9 最终验收继续按完整目标交付。
