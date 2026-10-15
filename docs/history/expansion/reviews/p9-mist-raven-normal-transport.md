# P9d：迷雾鸦影正常 SDK／ACP／MCP 通信

状态：正常完整通信功能切片完成，前置 `58a0979`。两个角色仍 planned、44/64；新角色严格失败、精确迟到／资源、种子与前端继续。

## 字面场景与实际链路

四份字面行动计划（linked、saved-dreamer、protected-heal、draw）各经过 SDK、ACP、mixed 两语，共 **24 个完整协议局**。随机发牌采用公开板和固定种子 `mist-raven-transport-v1`，固定结果为炼金1、摄梦4、预言家9、白痴10、狼5/8/11、狼鸦12、村民2/3/6/7。字面计划不从真实请求或记录生成，逐 actor 的全部 day/stage/outcome 与原计划比较后，再公共解析与精确 Tape 重放。

| 场景           | 三夜夜死             | 最终Alive        |
| -------------- | -------------------- | ---------------- |
| linked         | `[8] / [4,2] / [3]`  | `[1,6,7,9,10]`   |
| saved-dreamer  | `[8] / [2] / [3]`    | `[1,4,6,7,9,10]` |
| protected-heal | `[] / [8] / [3,4,2]` | `[1,6,7,9,10]`   |
| draw           | `[8] / [4,2] / [3]`  | `[1,6,7,9,10]`   |

均第3日自然放逐狼鸦12后Good胜利。R独立FNV/Mulberry黄金值 `0.78085219534114` 对三目标取index2；字面雾圈 `[5,11,8]` 命中8。linked/saved/draw在N2解封只知5，5随后死亡仍保留；protected在N2恰三狼保持封印、N3单狼解封知识为空。

SDK使用真实AI SDK及本机兼容模型端点；ACP是真实stdio进程、注入的MCP sidecar和Client提交。模型选择由各自的字面脚本提供，不调用真实模型。各provider cap2，mixed沿既有奇偶分派。实际检查初始名字／角色身份／队友、当前狼鸦知识及炼金库存、两语提示、英文messages和工具schema无Han、当前三个新阶段的机器动作与JSON参数提示，以及 SDK body.tools／MCP listTools 的 submit_action 三字段 envelope。get_game_schema保留三项静态桥接协议，没有被错误扩成角色动作列表。

## 独立 wire 约束

`mist_raven_transport_oracle.ts` 是测试夹具的数据与授权账本，不依赖 live projector。每个actor持有自己的状态，SDK历史窗口及ACP增量共用该actor状态，最终player view另建独立状态，避免两种序号混用。

- 七事实核精确shape、所属角色／本人、当前日；新角色的已选目标对字面choices，当前请求ordinal必须晚于来源动作。
- 正整数seq绑定type与规范化内容，同序号改目标／改type、同事实新seq、未见旧seq第二次消费、虚假spent均拒绝；仅同seq同内容的合法SDK重复可过。
- 狼鸦普通队列／聊天／刀票仅在字面解封时点之后，正文成员只能为本人和当刻已知队友；不能添加未知死狼。解封后字面pack facts及sourceDay另挡住已知队友的前夜聊天被重新编号补发。
- 抽刀对字面结果与来源投刀ordinal；狼鸦不能接收解封前日次的抽刀，即使被重新编号到解封之后。
- N3资源spent通知在本夜普通投刀完成后才可出现。失败局最终player view也接入同一授权检查；这项接入不表示新角色失败通路已经验收。

维护反例有合法对照、正确currentDay与明确错误，避免缺少日期被上游拒绝而误称授权校验通过。最后加入私密字面目标、当前行动尚未结算、历史同狼聊天与spent时点判例。

## 三路审查与门禁

- R：四套字面方案、每actor窗口／请求总数、原夜死／终局／库存知识与独立黄金RNG通过，`/tmp/awa-mist-transport-r-plan-review.log`；未用生产伤害函数生成预期。
- A：原9个序号／日期／资源反例、9个choices判例及最后2个spent／3个未知成员判例原样复跑 **23 pass／0 fail／27断言**，四份原输入未改，`/tmp/awa-mist-wire-final-a-review.log`。具体意见全部关闭。
- T/L/D：真实24完整局独立重跑 **12 pass／0 fail／14170断言**，42.81秒，`/tmp/awa-mist-transport-delivery-review-v2.log`。原改目标／同seq篡改及提前事实被准确拒绝，合法重复仍过，`/tmp/awa-mist-wire-delivery-v2.log`。角色／schema／动作参数检查均在实际wire上执行。

主任务最终功能门禁 **33 pass／0 fail／14217断言／2文件**，45.86秒，`/tmp/awa-mist-transport-final-feature.log`，包含24局及21个维护wire测试。全部正常ACP／MCP pid关闭后ESRCH，零非法提交与fallback，每局严格重放；不把PID证据扩称全部长期资源验收。

共用夹具兼容性：旧学者导师enhance的SDK／ACP／mixed两语6局与新24局联合 **15 pass／0 fail／16373断言**，`/tmp/awa-mist-transport-compatible-v4.log`；旧choice缺失失败的SDK／ACP两语4局 **2 pass／0 fail／686断言**，`/tmp/awa-mist-transport-failure-compat.log`。root check及format:check、diff通过，`/tmp/awa-mist-transport-check-final.log`、`/tmp/awa-mist-transport-format-final.log`。本批改测试与协议夹具，不声称重跑P9d阶段全量。

初轮反例曾未提供currentDay而提前拒绝，已改为正确日期／具体错误与合法对照；另unit误把同夜pass和使用当成两个合法额外刀槽，已改为跨两夜而未放宽唯一机会。原日志 `/tmp/awa-mist-wire-review-fixed-first.log` 等保留。独立T首次因sandbox禁止listen失败，保留 `/tmp/awa-mist-transport-delivery-review.log`；只授权localhost协议后重跑，没有访问真实API／私密配置来绕过。

## 接续

新角色缺失／非法／迟到通路与finalized失败Tape；runtime-resources规定普通十秒、仅精确late请求一秒、实际到达证据、真正旧turn MCP提交拒绝和物理回收；然后20–50固定种子、真实前端fixture／seek／frame／Chromium。以上尚待执行，角色登记保持planned。
