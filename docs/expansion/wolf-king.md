# P5：狼王接入与验收

冻结规则见[AWA Wolf King 1.0.0](rules/awa-wolf-king-v1.md)，来源及AWA改编边界以规则卡为准。`wolf_king`是实际注册的第八项角色，其余56项继续后续阶段。

## 所有权与行为

- profile继承普通狼队的互认/夜聊/刀票流程；互认只给成员ID，不暴露具体狼牌或枪资源。`canSelfDestruct`明确声明普通自爆资格，不从阵营或刀权自动推断。空窗口继续关闭，普通自爆没有带人效果。
- 独立私有`wolf_king.canShoot`；本人Observation为`ownState.wolfKing`，其它角色不得因共用shoot取得该状态。只在成功枪击产生公开`wolf_king_shot {actorId,targetId}`，毒等禁枪不额外发公开身份事件。
- `roles/death_shot.ts`收拢同一单次死亡枪的schema/修复/目标校验/消费算法；角色仍各自声明私有状态、允许死因与事件。没有BaseRole/事件总线/清理框架。角色工具校验优先该演员profile，避免同名shoot的注册顺序覆盖猎人或狼王。
- World持有死亡授权；共享hook不直接写Alive，不判胜。DeathResolution唯一标死/追加波次/徽章负责人，PhaseManager最后封盘。迟到的角色/资源/生命/授权变化丢弃，非法或异常不误耗枪；主动null空枪消费一次。

## 提示、格式与API

狼王新行动使用`death_shot`；猎人仍使用`hunter_shot`和原事件/字段。ActionReception、受限模拟、严格Tape同步接通新stage，任意stage/trigger字符串本身不能授权尸体动作。

共同提示明确每轮日次。SDK系统消息与ACP初始化明确本人狼王牌；每轮私有状态包含本人剩余枪，普通狼同伴等收到公开板子brief但不能收到该私有计数。使用独立字面marker核对实际wire，不通过生产formatter生成期望。

`HUNTER_TOOL_SPECS`旧导入路径保留，指向共用枪schema；未指定locale的native shoot metadata描述从旧中文猎人专属改为英文角色中性，不能再声称该静态API默认中文。机器工具名、key、类型和参数必填约束不变；实际SDK/MCP共同游戏协议及两語行动hint仍按当前locale本地化。移除该旧文件四条AST中文例外，受控扫描现为57条，历史审查计数不改写。

公开/玩家schema2及内部Tape2保持；内部严格source/lock/rules/RNG门槛，新源码产生的动作与CP包含真实独立枪状态。旧内部格式仍拒版，旧Hunter公开档继续原字段、名字、原文及文案。前端只消费共享DTO/术语，狼王与猎人枪是不同标签、同一明确死亡投影。

## 可配置示例

- [六人板子](../../configs.example/boards/six_player_wolf_king.json)：1狼王、猎人、预言家、3民，屠边、预置1号警长及2.25票权，关闭自爆；这是AWA演示板，不冒称官方六人标准板。
- [十二人板子](../../configs.example/boards/twelve_player_wolf_king.json)：1狼王、3普通狼，预/女/猎/白痴及4民，沿现有基础条件与警长/自爆参数。女巫仍支持已声明selfHeal。
- 对应games文件沿用example的`deepseek_v4_flash`绑定，未写入认证或自动修改用户configs。可在自己的provider/agent配置中选择SDK或ACP。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_wolf_king
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_wolf_king
```

狼王本版本固定一枪和明确死因表，没有假装支持unlimitedShots等未声明变体；严格配置拒绝这些参数。

## 人工、完整通路与受限模拟

[核心判例](../../backend/tests/engine/rules/wolf_king.test.ts)核对字面原因表、shot/pass/invalid、同工具两角色独立校验、授权/生命/状态/角色竞态、私有资源与公共死亡；直接resolver测试仅检死亡波次，真实PhaseManager与完整runner才证明最终判胜。

[完整场景](../../backend/tests/support/wolf_king_scenarios.ts)的seed/发牌/动作均预先冻结，模型决策不读World。5场景×SDK/ACP/混合×中英共30实际完整局，逐局严格重放：

| 场景           | 字面oracle                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| 六人放逐链     | 首夜5死亡；放逐King1→枪Hunter2→枪Seer3，徽1→2→3→4，只有5/1遗言，最后Good优先且存活4/6                          |
| 六人毒         | 初批King1毒死+Hunter2刀死，整批先dead；仅Hunter枪5，徽1→3，无King枪，存活3/4/6                                 |
| 六人枪击反向链 | 首夜Hunter2刀死→枪King1→枪Seer3，只有2遗言，徽1→3→4，King实收Shot授权，存活4/5/6                               |
| 六人普通自爆   | 首夜5死亡；King1普通blast不请求枪/放逐，无追加人头，徽先于唯一终局，存活2/3/4/6                                |
| 十二人扩展     | 已冻结牌席中King2首日被放逐枪10；次夜毒4/猎人7枪3，普通狼1最终blast；King尸体不收第二夜夜聊，存活5/6/8/9/11/12 |

成员含已出局的本阵营玩家，各场景完整outcome/检查点/日次/徽章/事件/原始动作有独立期望。部分gun turn先非法999再合法同窗口更正；SDK验证错误回执、ACP真实MCP验证shoot_target，枪不误耗、不回退。真实进程/MCP要求正PID和ESRCH；没有请求的ACP玩家保持懒会话不创建，不拿缺PID冒充回收。

[两板受限观察模拟](../../backend/tests/runtime/wolf_king_simulation.test.ts)各12 seed均自然结束、零拒绝/回退、实际wolf_king_shot正覆盖，每局Tape再执行；它补充随机覆盖，不能取代人工oracle。

[前端实际档案](../../frontend/tests/fixtures/six-player-wolf-king/wolf-king/en/god.replay.json)来自真实SDK完整六人放逐链；单测、Chromium两语交互及实际双语Remotion帧核对枪击标签、逐事件死亡、终局前无winner/最终名单。模型响应为本机合成，不声称完成外部Codex/Claude策略质量评测。最终门槛和三路复查见[交叉审查](reviews/p5-wolf-king.md)。

P5白狼王扩展使用独立WhiteWolfBlast死因；本AWA版本允许猎人/狼王对此追枪，含毒等禁因仍禁止。具体窗口、合并死亡及来源歧义见[白狼王卡](rules/awa-white-wolf-king-v1.md)。
