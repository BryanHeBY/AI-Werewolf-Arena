# 档案兼容与精确构建身份

| 文件                  | 当前新写入                                          | 历史读取                                 |
| --------------------- | --------------------------------------------------- | ---------------------------------------- |
| replay.json           | awa-recording envelope1，public_replay，内层schema2 | 未声明或受支持旧裸复盘按reader显式转换   |
| reproduction.json     | envelope1，strict_reproduction，内层Tape3           | 保留旧裸／封装Tape2原shape；不自动跨构建 |
| manifest.json         | 原根字段追加内联schema1及identities                 | 无版本保旧字段与身份缺席                 |
| players/player_*.json | envelope1，player_view，内层schema2                 | 受支持的无声明／1／2按玩家reader转换     |

身份包含request／presentation／ruleset和真实捕获build／RNG来源，不是签名或行动许可。未建Trace的初始公开档来源可为null；后继只在原发布时点接捕获来源，不加新的dirty／刷盘。公开及player身份不含seed，seed仍在原私有manifest／Tape。

声明新封装后，未知外层／内层版本或错误kind不能降级成旧裸档；历史自定义format扩展按原判别接受，不因名字碰巧相同就误判。玩家原文、局部seq与未知允许扩展保reader实际政策，不反推中文／当前阵营。

结构与独立机制审计通过后，严格执行先原source／lock，再RNG和ruleset，之后声明与payload来源一致性；语义版本相同不豁免源码指纹。当前指纹覆盖backend全部src、共享包src及声明的清单／锁身份；目录、注释、词典、schema、tsconfig、package resolver同样能改变sourceHash。不得回写旧记录或删除input成员求跨构建绿。

目录机械差分的旧／新构建各自使用自己的模块、依赖、layout和严格reader，不允许把新World／recorder注入旧build。比较中可排除哪些身份／临时产物字段必须有精确独立证明；不能宽泛忽略未知诊断或效果字段。相关理由见[ADR0004](../decisions/0004-archive-identities-and-evidence.md)。

## 严格 Tape3 的返回候选事实

Tape3新增可选`returnedCandidate`，只允许在error结算中保存已返回的ToolCall或显式null。Tape2 reader保原严格decision字段，版本2带该字段仍拒绝；不把旧档迁写为3或补造缺失候选。当前reader接受合法2及3，旧reader对新3没有前向兼容承诺。未知内层版本继续拒绝。

封装自身仍为envelope1；只有`strict_reproduction`允许`payloadSchemaVersion`为2或3，并必须与payload.schemaVersion一致。公开／玩家只允许2，manifest仍1；request／presentation语义身份没有变更。writer用显式末参数声明内层版本，不提前读取unknown payload的版本getter，保完整数据检查的先后。

真实顺序是先unwrap、结构准入及独立机制审计，再检查finalized与精确source／lock等；旧reader可能在版本或结构阶段就拒新档，不能宣称所有不兼容都先报source错误。本笔源码与schema变化正常改变sourceHash，严格执行门槛未降低；合法读取旧shape不授权跨构建重放。
