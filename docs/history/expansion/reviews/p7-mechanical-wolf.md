# P7 机械狼完整启用审查

本笔按 [冻结卡](../../rules/awa-mechanical-wolf-v1.md) 和 [接入契约](../mechanical-wolf.md) 将第 18 项 `mechanical_wolf` 交付为 verified。六学习结果、五机械技能、实际阶段/网关/PM/死亡 owner、双语提示/信息权限、配置/记录/呈现共同启用；不是只登记角色或把普通 gift 冒充机械技能。目录现 18 verified、46 planned，P7 尚未结束。

## 独立审查与修复

| 职责               | 发现或补证                                                              | 根代理修正与原审查者复查                                                                                                |
| ------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A 架构与运行时     | 技能侧仅读序列化 mode，复活、未登记范围、kill 原对象改 skill 都能获技能 | 统一原 World/owner/life/mode 快照权限，skill validator/bind/effect 最终复验。三个真实阶段探针入核心，独立复现全部关闭。 |
| R/T 规则与资源     | gateway 已合法返回后，同一毒库存被改 0 仍产生新毒                       | await/gateway/提交前检查 remaining>0；一次请求、保已耗 0、无新 claim/event 两项固定回归，原 probe 关闭。                |
| A 与 R/T           | 枪的 camp/privateState 及浅复制机械 owner/learning 需要保持原授权       | 共享枪终验原阵营/私有容器，机械枪另绑定 state/learning/gun；四项撤权保原未花枪且不命中。                                |
| R/T 真实死亡 owner | 同批两狼死不假继承；先真实批继承、后原生 Hunter 追加枪死保历史          | 两个实际 PM 首夜字面场景入核心，完整死亡与最后 night_settled Good；不把手动 Alive 单元例当实际接线证据。                |
| L/D 配置边界       | 有限白名单新错误未登记，CLI 退化为 config_check_failed                  | 登记已知 machine code，公开 parse 与直接 bootstrap 均拒不支持组合，固定 code/安全 board.roleSetups 路径测试。           |
| L/D 与 R/T 双语    | 不消耗措辞过宽，反射/保护细则与原生/外部 gift 边界不足                  | 两语补实际已消费前缀、580 时序、绕盾零递归/Dream、普通守救两刀抵消、原生限制与绑定 G02 独立规则。                       |
| R/T 信息授权       | 机械枪类型公开会披露真实机械身份，须显式冻结                            | 卡/契约/两语明确授权公开枪种、身份、实际目标；不公开学习对象 ID 或其它库存。                                            |

A 最后独立 53/540，R/T 最后资源专项 29/166及真实 owner probe，L/D 独立 8/256及双 PNG 目检；三路全部已发现问题关闭，0 剩余阻断。根代理额外固定普通 G02 guard 与原生学习/kill 模式并存的实际两夜正例，防止背景规则误约束外部能力。

## 最终门槛

- verified 最终目录/双语源码冻结后：type/deps/boundaries/i18n 全 exit 0，受影响 engine/config/catalog **627 项、8916 断言、46 文件**通过；控制专项 39/159 再验。
- 基础 50＋石像 36＋通灵 36＋机械 54＝**176 本机双语 SDK/ACP/混合完整局**，全部严格 Tape。另六人/十二人各 20 固定受限观察种子自然结束、零拒绝/回退、实际技能/skip/继承/刀票正覆盖及全部 Tape。合 **90 项、46157 断言、5 文件**通过，exit 0。
- 九类机械字面 oracle 核状态、原生身份/伪装标签、库存、遗言、死亡/枪顺序、最终存活/胜者与检查点。实际 prompt 核学习/就绪/继承/模式与狼队信息；God 反毒从所有玩家视图剔除，M 不获狼聊历史，全部计划消费与 ACP/MCP PID 回收。
- 前端最终 type/build 与 **119 项、1078 断言**通过；实际 Chromium **50 用例**通过。新增双语实际反毒/枪交互，所有席位与字幕 bbox 无遮挡。
- 实际 Remotion PNG 中文反毒 frame 2620 与英文十二人枪后 frame 7930，root 与 L/D 独立目检通过：反毒因果尚未标死 caster；枪后真实目标已死，无提前胜者，Mechanical 真底牌/警长标签正常。浏览器与 PNG 后只调整后台角色背景及目录状态，渲染文案/JSX/投影未改；最终共享目录的 front type/unit/build 再验。

日志 `/tmp/awa-mechanical-verified-{type,deps,boundaries,i18n,engine,wire}.log`、`/tmp/awa-mechanical-verified-front-*.log`、`/tmp/awa-mechanical-browser1.log`。PNG `/tmp/awa-mechanical-reflection-zh-final.png`、`/tmp/awa-mechanical-twelve-en-final.png`；仓库三 fixture 来自本机合成完整局，无用户私有资料/认证。

候选 implemented 源码的首次 176 局与 40 seeds 不冒认激活后的证据：verified 登记后按同矩阵重新运行，以上采用后者。十二人首次 0–19 无继承，20–39 无，40–59 有历史但未出刀；固定 60–79 的 79 有两票，不降低门槛或改牌池/策略。

这是单角色功能门槛，未复跑本轮以前全部 578 局矩阵；P7 结束仍须全部已支持角色/板子 release 回归。未调用外部模型、读取认证或修改用户 configs；T6、长局/P10 及其余 46 项完整目标保持。
