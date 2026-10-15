# Q3 普通死亡／警徽／遗言归档边界：只读准备

准备实际 Git 为 `b1b5a860e8556d4bc5d3cdafaf27bdcb0615f19c`。`before.json` 保存十四个关键公开模块的完整现文与 Git 字节（全部相同）；这不是整个传递构建 fence。脚本尚未运行，不能将下列静态预期记为实际拒绝。Ghost 后继工作树不在本准备的不可变 control 声明内；真正 baseline 只在 Root 冻结运行窗口后，以当时完整源码指纹录制并立刻重放。

## 每层真实保证

| 入口 | 已有保证 | 本实验不能据此推论 |
| --- | --- | --- |
| `packages/replay-contract/src/index.ts` 的 `readReplayDocument` | 纯序列化数据、封装种类／版本、基本字段、唯一玩家 ID、连续事件 seq、明确终局显示一致性；保历史 reader | 不推导每个死亡来源、真实生命版本、警徽许可或遗言资格。安全数据接受不等于规则漏洞。 |
| `recording/reproduction.ts` 的 `parseReproductionRecord` | 先封装／Tape schema 2、严格字段与因果游标，再调用机制装配；有具体事实 reader／受众检查 | generic schema 未作为独立公开函数导出；不应称本调用是“只结构”。普通生命是 `alive` 数据，不包含运行 AliveComponent 原引用和版本。 |
| `verification/reproduction/assembly.ts` 的 `verifyReproductionMechanisms` | 固定18个具体独立 verifier，直接仅读归档；原16步顺序后加Cupid、Hybrid；各族有明确部分付款／失败前缀规则 | 不因函数数目覆盖所有普通徽／遗言／死亡波因果。直接调用本入口也不会检查 exact 构建身份或重新执行游戏。 |
| `runtime/simulation/replay_reproduction.ts` 的 `replayReproduction` | 先结构＋18装配，再 finalized、source/lock、RNG、ruleset、封装声明，真实 bootstrap、原请求/选择、每周期完整 CP、全事件及逻辑操作比较 | 旧构建或伪造 hash 不能拿作当前重执行反例；若先拒 source mismatch，不能声称已抵达普通死亡规则。未记录的引用/版本/await 位置不补成许可。 |

18个 owner 为 InitialIdentity、WildChild、LonelyGirl、GhostBride、AnimalDream、FragrantPair、NobleSecretBody、DemonHunter、ScholarMentor、MistRaven、RadiantEclipse、TimeConsort、WolfSorcerer、Trickster、Magician、OrderPrince、Cupid、Hybrid。特别是 **Cupid 已明确拒绝 Lovers 派生者的普通枪 decision/fact**，已有独立手写单元，不重复声称该支新缺实现。

## 一次性有限输入

脚本只用真实 bootstrap、PhaseManager、原录制器和字面 ActionProvider；不启动模型、SDK/ACP/MCP传输或私有配置。三个新输入各一个周期，避免重跑旧题名／矩阵：

1. 六人 Cupid：配对 Hunter2／Wolf3，狼刀3，2仅 Lovers 牵连死亡，无枪事实。手改插一条 Hunter2→4 枪事实；此支静态预期已有 Cupid 独立拒。
2. 六人 Dream：Dreamer1梦游Hunter4，狼刀1，4被 linked Dream 带死，无枪事实。手改在 dream_death 后插 Hunter4→2 枪事实。
3. 六人普通徽：初始警长4首夜狼刀死，真实 holder choice 交5并保首夜夜死遗言。变体A只把转徽事实 toId5→6，最终 CP 仍徽5。变体B只把4的 last_words 请求来源阶段 Night→Day，并明确 WolfKill；执行 phase 仍是 Day。基础政策 Day+WolfKill 不授予该遗言。

baseline合法性先由手写事实／资源读数断言，完整原始严格封装与公开封装落盘，再实际 exact replay 成功；生产引擎仅作合法档案 producer，**拒绝 oracle 不从 DR／资格函数生成**。四变体是对 clone 的上述字面修改，original engine／lock／RNG／ruleset／envelope 身份不变，事件插入只调整已包含该事件的 CP eventCount 和公开 seq。

LastWords 的死亡来源阶段不在公开 grant/spoken 事实中，因此不伪造一个公开等价字段；该项 public reader 标 `notApplicable`。Badge 变体只证实 fact-vs-finalCP，Tape 没有组件生命版本，不能把它叫真实死亡版本篡改实验。

## 执行与收据

唯一准备命令（由 Root 执行，当前未执行）：

```sh
bun --no-env-file /tmp/awa-q3-archive-guarantees/probe.mjs > /tmp/awa-q3-archive-guarantees/output.txt 2>&1
```

cwd 为仓库根。完整生成输入、每变体 precise edits 与四层结果保 `/tmp/awa-q3-archive-guarantees/execution/`。当前 source/tree 需 Root 先固定；源指纹是执行时真实构建，不冒准备 commit。每个合法 baseline 先 exact replay；任一失败保存原 `result.json`，停止，不能将 fixture 或 source mismatch 改成预期规则拒绝，也不能重跑先前绿输入消红。

若实际结果为 ordinary 的独立装配接受、exact replay拒绝、public合理宽接受，应以这三个精确保证收口，不因此自动加新 schema／角色 verifier。若 exact replay 在同源合法基线下仍接受矛盾变体，再报告真实轨迹并由 Root 单列政策／实现任务；本准备不改生产、测试、矩阵或进度。
