# C30 赠枪生命周期 owner

固定实际 Git 来源 `496414bfad89cf0555a8b0a8ebc9fbcee989bdd9`。4 路径冻结（3 源码、1 新单元测试），精确 SHA 见 [固定证据](generated/death-gun-lifecycle-owner-evidence.json)。

新 `death-gun-lifecycle.ts` 实际拥有原 owners/counters 两 WeakMaps、原对象证明和 16 个完整声明。`death_abilities.ts` 保留真实 copy 不支持／gateway 枪权政策及原 public API。现有 `player_state.ts` 持有原 PlayerDeathGun 与 projectDeathGun，transfer 和 public 投影引用同一个函数，避免新 owner→entry→owner 初始化环。没有新的第二状态、通用枪框架或薄转发 owner。

20 个原声明逐字一致，原 player 模块完整 runtime 程序一致，15 public runtime 名不变。授予／武装／转移／退休／first-death 付款、getter 和事实顺序全部保留。返回原读取引用；transfer 创建原新接收实例；复活不能刷新旧原体枪权。

## 有限收据

- 新边界测试 3/0，27 assertions：公开函数同引用、跨入口共享授权、转移发布失败已付前缀、first-death 收尾及复活失效。
- 原 bounded 三项 3/0，25 assertions：未武装首次死亡、captured事实不执行额外getter、转移资源保持。
- 严格有限三个测试模块类型检查 session 55450 已实际终态 exit 0。
- 4 个中文职责头 0 failures，拥有路径 formatter 0；只改 trivia，无重测／重编译。

本批只交付赠枪生命周期。C30 普通夜能力 metadata owner 全部消费者闭合及 C31/C32 仍按总计划继续执行。没有改 deathWave／intent／schema2／角色枪规则、进行全量门禁或模型网络调用。

最后只将 player_state 两句既有 DTO／own-data 说明中文化，并明确不承诺任意 Proxy 零 trap。仅一 SHA 评论变化，20 声明／原 runtime 仍同，4 heads 0；未因此重编译或重测。

## 中文结构及边界说明

原体证明、单一 WeakMap、安装后计数、武装／转移写入顺序、首次死亡版本与最终过期在逻辑旁说明。两个既有玩家 DTO／own-data 注释也已中文化，明确不承诺任意 Proxy 零 trap。Root 实际核对授予、转移、公开函数、投影与失败输入；独立审查覆盖最终四 SHA，最后两注释仅单 SHA 增量复核，不重复行为／类型检查。
