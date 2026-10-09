# P7 混血儿功能交叉审查

规则：[AWA Hybrid 1.0.0](../rules/awa-hybrid-v1.md#hybrid)；[接入与验收边界](../hybrid.md)，冻结历史笔 `f2eb3d9`。实现原生首夜必选与独立胜利归属，实体 Good 民、普通查验 Good；有限十角色组合与六/十二 AWA 示例不冒充白神原板。

## 独立首审、处理与复查

- **A（review_arch_psychic）**：原空 Victory 对象/数组内容终验、actor/target 原生命、只首同步提交、提交后同日 pipeline 重入、true camp 与成员资格分离可行；独立 core/配置50/452通过。
- **A 阻断**：初版 profile 的 Baseline 在真实 SDK/ACP 未行动后自动选榜样，与卡“不代选”冲突。根代理移除该 baseline；新增显式 `allow_fallback:false`，两通路共用守卫，注入备用策略也不调用；严格 Tape context 读者接受可选 boolean。普通请求默认 fallback 与观察机器人自己的选择不改变。
- **A 记录复查**：禁 fallback 的回合初版仍标 `used=true`；修两通路为false。实际 SDK HTTP / 进程内 ACP 两语×空回复/传输失败8/249，三轮落盘none、无伪造工具/回退；失败Tape保false、原空归属及失败，篡改true重放拒绝。A最终关闭接入/数据意见，0残留。
- **R/T（review_rules_psychic）**：独立50/452、来源/AWA边界、验好/民边/死者赢家/实体判胜/秘密权限均一致。九人工方案逐类复算终局alive/words/成员，预期不是从执行结果生成。
- **R/T fixture 修正**：十二人首日先警选后公布夜死，H8待死亡仍须 nomination/vote。初版方案漏两请求并把words排在前面；独立真实PM探针证实 `choose→nomination→vote→words`，根代理按all electorate补齐，日间alive再排8。警徽 reason 修为既有 `voting_death`；未修改规则流程或降低断言。修后54局及严格Tape27/11649通过。
- **L/D（review_rules_gargoyle）**：独立6/152，注入隐藏state字段也不会进本人prompt/DTO；actor-only/God全部排除边界、中英标签与console一致；三实际fixture物理身份/生命不因选择变化，已死Good Hybrid按显式名单获Good/Wolf胜利。
- **L/D 展示阻断**：英文十二人终局长caption遮住存活7号Guard与贴近8号赢家行，旧E2E仅验短归属帧bbox。根代理仅在sealed decision时把席位圆桌中心/纵半径38/21改33/17，增加终局每席位bottom<caption.top检查；补新事件的双语stage人类标签。最终browser/PNG须复查，不用短帧通过替代终局。

## 字面完整局与输入/录制证据

九场景各SDK/ACP/混合×zh-CN/en：Good榜样/狼榜样且本人活、两类本人首夜死亡、屠城Wolf赢、HiddenWolf伪装及接刀、十二Good/Wolf榜样猎人夜枪和狼王票出连锁、十二屠民Wolf赢。公开查验H始终Good；God affiliation不进任何玩家，每位Actor只获本人脚本、提示检查不拿全局牌或seed。首日警选/夜死、遗言、枪、徽、PM判胜仍由原owner处理。

人工literal牌：六人 `merchant-witch:1155` 为W1/WK2/H3/S4/W5/V6（复用已知deal seed，但计划与oracle重新写），Hidden为 `merchant-hidden:123` 的W1/Hidden2/H3/S4/W5/V6；十二 `hybrid-twelve:573604` 为WK1/W2/3/4/S5/W6/G7/H8/Hunter9/V10/11/12，纯deal查找后固定。控制器配置只负责预先编排，模型侧没有种子/真阵营决策访问。

两示例板各20种子 `hybrid-random:0..19`，四既有style混合：40全自然终局、零非法/回退；两种选择与两方胜者正覆盖、每局严格Tape，候选2/138通过。新增故障8例单独记账，不冒称8完整对局；54实际子进程局要求agent/MCP PID结束，controller检查无未预期请求、每轮no fallback/error、实际schema/初始化/每决策与Tape一致。

## 最终门槛与状态

最终目录 **20 verified/44 planned** 的源码冻结后，以下门槛全部终态exit0：

| 门槛           | 证据与实际范围                                                                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 后端受影响门槛 | `/tmp/awa-hybrid-verified-gate.log`：**964 pass/0 fail/23966 assertions/87 files**；全部engine、AI、recording、contracts，角色配置/目录与本笔54局/40seed及8故障Tape。不是全backend release                                         |
| 实际完整局     | 同日志九场景×SDK/ACP/混合×两语＝**54局**，每局严格Tape、逐字独立oracle、agent/MCP PID回收；candidate独立27/11649后又在最终元数据源重验                                                                                             |
| 受限随机       | 同日志六/十二各20 seed，共40，全部自然终局/零reject和fallback，两方选择/胜者正分支，每局严格Tape；candidate独立2/138后最终再验                                                                                                     |
| 必选故障       | 同日志8例＋原专项 `/tmp/awa-hybrid-required3.log` 8/249；SDK实际HTTP、ACP进程内factory，失败落盘none与空membership、false回放/true篡改拒；不冒称完整局                                                                             |
| 静态门槛       | `/tmp/awa-hybrid-verified-{type,deps,boundary,i18n}.log`；type/deps/boundaries/i18n exit0，仍57精确源码例外                                                                                                                        |
| 前端           | `/tmp/awa-hybrid-verified-front-unit.log`：**139/0 fail/1224 assertions/22 files**；final front type/build exit0                                                                                                                   |
| 浏览器         | `/tmp/awa-hybrid-browser-final.log`：**58实际Chromium全部通过（2.9m）**，布局修正后全既有回归与Hybrid四例，含终局每席位caption边界                                                                                                 |
| 实际PNG        | `/tmp/awa-hybrid-affiliation-zh-final.png` frame280，`/tmp/awa-hybrid-twelve-en-final.png` presentation frame6760；两render命令终态exit0，root/L独立view。先前使用raw frame10720越界已按presentation76事件纠正，未更改渲染范围约束 |

L/D最后独立目检：中文全6活，stage“胜利归属”、God字幕准确；英文7号Guard与8号已死Good/Hybrid/Winner均在caption上方清晰，五赢家1/2/3/4/8，遮挡关闭。A禁fallback/记录及R九字面预期复查0残留；最终文档证据与源码范围已交原审查者核对。这不是P7整阶段或P10最终验收。

最终登记复查：A、R/T、L/D直接核对新日志、源码、目录实数及文档，均0残留阻断并支持功能提交；未重复广测或把A记为独立PNG目检者。R/T明确九literal oracle、H8首日选举、badge reason、当轮与历史计数均闭环，无新的规则或手写预期阻断。

P7余魔镜少女、觉醒隐狼、黑市商人三项；P8–P10、64角色/22机制组合矩阵、长局与T6真实模型目标保持。未读写用户configs/认证，未调用外部模型；旧686局历史验收与本笔54局各有源码范围，不能说旧686局在本笔全部重新验证。
