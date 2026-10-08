# P4 G03：死亡来源与猎人决定

本子批执行 [AWA Classic 1.0.0](rules/awa-classic-v1.md) 的基础枪规则。死亡窗口授权、全链条状态归属、自爆和徽章时序将在 G03 后续子批完成；这里没有把新角色目录登记为执行实现。

## 死亡事实

`core/domain/deaths.ts` 的 `DeathCause` 与伤害/保护的临时 `StatusMark` 分开。`DeathSources` 按玩家保存全部死亡原因；DamageResolutionSystem 产生 `wolf_kill` / `poison`，放逐产生 `exile`，猎人追加死亡产生 `shot`。包含毒的复合死亡保留毒原因。

`lovers` / `dream` / `duel` / `self_destruct` / `ability` 是可表达的事实标签，不代表对应扩展角色已经实现。默认枪资格只接受非空且全部为狼刀、放逐或枪击的来源；其他来源不通过。

## 猎人决定与消费

- 钩子仅处理确实死亡的原生猎人；不再数神职或把末神排除。
- `DeathShotSelection` 明确区分 `shot`、`pass` 和 `invalid`。等待选择后重新核对当前角色组件及枪状态身份、角色/资源/生存资格；撤销或替换丢弃迟到选择。合法枪击目标死亡来源为枪，空枪消耗一次枪机会但不制造枪击事件，无效或抛错不消费枪。
- `shoot.args.target_id` 为 `number | null`，`null` 表示主动空枪；缺省、无法解析的值和非法存活目标仍被拒绝。
- SDK 与 ACP 共同接收层只预检和选定动作，成功回执仍为 `accepted:true, applied:false`；实际枪消费由死亡钩子执行。
- 引擎死亡请求最多三次。非法目标或返回非枪动作可更正，耗尽后保留枪状态并结束本次尝试；这不授予未来任意阶段行动权。
- 请求保存 `death_sources` 与实际 `death_phase`，分别表达死亡原因与死亡阶段，行动阶段仍是当前运行阶段。首夜白天收枪时二者可以不同。
- 所有模式的实际 PhaseManager 回归核对枪击先于 `game_over`，末神打掉最后一狼后按基础优先级判好人胜。

## 接口与历史文件

源码 `EventRegistry.onDeath` / DeathHook 的 callback 从数字或 null 改为 `DeathShotSelection`，来源从 `StatusMark[]` 改为 `DeathCause[]`。定制角色钩子需要同步迁移，不把 null 与无效决定混为一谈。

内部 Tape 的严格 request schema 增加可选 `death_sources` 枚举数组；schema 仍为 1，源码/lock/规则兼容校验保留，旧源生成的 Tape 不会被伪装为当前执行兼容。公开复盘与玩家记录格式仍为 v2，`hunter_shot` / `hunter_silent_due_to_poison` payload 未变；旧发言/提示原文不翻译。

中英角色说明及枪目标 hint 共用 game-text，说明空枪消费、非法目标不消费和本 AWA 末神规则。新增 death_sources 是引擎私有行动上下文，不自动公布未知夜间细节。

## 验证边界

[人工判例](../../backend/tests/engine/rules/death_causes.test.ts) 覆盖双语死因表、复合毒、末神三模式、空枪/非法/异常和真实阶段判胜顺序。[真实传输](../../backend/tests/ai/integrations/action_reception_transport.test.ts) 通过本机 SDK HTTP 与 MCP 子进程核对错误→空枪→重复提交的相同回执，并断言预检不消费。

本批不宣称已经收走 Hunter 钩子、放逐与自爆中的 Alive 写入，也不宣称上下文 stage/trigger 已替换为 World 持有的死亡授权。后续 G03 将统一这些所有权，并验证初批遗言、徽章、角色死亡钩子、追加波次及自爆收尾的完整顺序。

后续G03已接入[World死亡窗口](death-action-authority.md)：shot/pass内部选择还需deathActionId且授权覆盖消费点，低层钩子调用者按新契约打开/关闭窗口。Alive中央死亡写入及自爆/徽章仍继续下一子批。
