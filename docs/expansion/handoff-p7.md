# P7完成后的Agent交接

## 执行边界

用户2026-10-09最新指令是“把P7最后一个角色实现完就收尾，准备交给其他agent”。本轮止于黑市商人及P7整阶段验收；**P8–P10未开始，不继续实现**。原64角色/22机制路线保留，当前23 verified、41 planned，不能把P7结束当完整扩充完成。已有长期目标的工具状态为paused，不能将未完成的全目标标complete；下一Agent按用户后续指令接续。

入口：[目标与路线](roadmap.md)、[64角色目录](roles.md)、[测试/交叉审查/commit指南](delivery.md)、[实时进度](progress.md)。本阶段证据：[P7验收](reviews/p7-activation.md)、[Black完整交付](reviews/p7-black-market-merchant.md)。

## 已交付内容

P1–P6完成。P7七角色为通灵师、机械狼、奇迹商人、混血儿、魔镜少女、觉醒隐狼、黑市商人，各有独立规则卡、有限组合、六/十二板子、双语完整对局/Tape及呈现证据；角色目录链接对应验收。资料目录有64项名称，不代表64项可运行；主动配置仍拒绝未注册/未许可组合。

Black板子与游戏例子：`configs.example/{boards,games}/six_player_black_market_merchant.json`、`twelve_player_black_market_merchant.json`。六人为2Wolf+Black+Seer+Witch+Villager；十二人为3Wolf+单枪Wolf King+Seer/Witch/Black/Dreamer各1+4Villager。默认模型仅沿用示例Agent引用，可由游戏配置换成已有Agent；认证不进入板子或记录。真实忽略configs及密钥未读取/修改。

## 接续时必须保持的所有权

| 边界 | 当前实现与禁止退化 |
| --- | --- |
| 阶段/死亡 | PhaseManager推进且最终判胜；DeathResolution先完整遗言、警徽、原生/礼物死亡钩子与追加波次。第一枪末狼/末神仍不能跳过后续枪 |
| 死亡动作 | permit绑定原World/body/life/phase/day及确切ability instance ID；关闭旧许可后开新许可，迟到/换实例不能借资源 |
| 夜能力 | 每实例唯一state/资源/source/activation；role/private/metadata撤换撤销旧请求。付费提案保首次死亡前缀，但复活的新life不能继承旧效果 |
| 礼物 | 不改变真实角色、阵营、胜利归属、原生资源；Black下一夜140，Miracle原125/700；gift-gun实际900armed，首次死亡后永久过期 |
| 能力变化 | callback后复查生命、role/private、source/metadata、库存与activation；Black只转living Good且保原状态，不copy、不补stock，不能凭低层API宣称玩家转移机制已交付 |
| 同目标历史 | actor-local、same-kind、成功接受才记录；原生/礼物共享政策，不同actor独立；转出/耗尽不抹历史。recipientPolicy历史仍影响合法目标与提示 |
| 信息 | 玩家DTO/prompt使用已知字段投影，不直接序列化raw privateState/实例对象，不调用未知getter；God记录/Tape保合法完整数据，排除运行引用。查验camp/role/组合合法报告保留。事件按发生时受众，God提案不提前改玩家life |
| 语言 | zh-CN/en按局/展示调用传入；机器ID/key/enum稳定，原始名字、人设、发言不自动改译。前端只依赖共享契约/文本 |
| 失败/记录 | 对显式action_failure_policy:error的请求，无工具clean wait合法，none/null按具体机制处理；三拒绝/transport/cancel报错，不伪skip/fallback。旧Lucky/default策略按原契约。Tape兼容检查按源码指纹，不放宽成“能读就重播” |
| 资源 | runner负责一次关闭、原错和并发清理错误汇总；provider调度器/会话池负责租约、迟到创建、ACP进程与MCP监听回收 |

主要入口：`backend/src/game/mechanisms/roles/{abilities,ability_scope,ability_changes,recipient_ability_stage,night_action_history}.ts`、`black_market_merchant/`、`backend/src/game/engine/phase_pipeline/night_pipeline.ts`，以及既有death_resolution、player_prompt_policy、记录/回放模块。旧Miracle lucky_stage路径是共享recipient流程的兼容导出，不能未经调用核查删除。

## 验证入口与本轮证据

```bash
# 全阶段；本地HTTP/ACP/MCP与浏览器需要允许监听和子进程
bun run --cwd backend release:check
bun run --cwd frontend typecheck
bun run --cwd frontend test
bun run --cwd frontend build
bun run --cwd frontend test:e2e

# Black人工完整局、固定seed自然模拟及受控失败Tape
cd backend
bun test --preload ./tests/setup.ts tests/runtime/black_market_game_execution.test.ts tests/runtime/black_market_simulation.test.ts tests/runtime/black_market_failure_replay.test.ts
```

Black最终48 tests/13906 assertions对应84实际本机完整局、40自然seed、4受控失败Tape；全量后端release 2027测试/184573断言/0失败（type/deps/boundaries/i18n/smoke全部exit0），前端173单测和78实际Chromium通过。详细日志与PNG在阶段验收。测试fixtures为真实God导出；SDK本地HTTP、ACP真实进程/MCP的正常84局与mock session失败4例区分记录。**未调用外部模型**，T6仍未完成；20seed不冒1000seed定时或全部技能覆盖。

本机/tmp日志可供当前接手Agent核查，但不保证长期保留；可复现依据是仓库规则、人工场景、测试及录制协议。完整录制要求当前source hash；不要在源码修改后拿旧Tape当当前引擎严格验收。

## 后续顺序

1. **P8**：先冻结丘比特、咒狐、杠精的AWA版本，关系/第三方判胜、秘密信息、额外流程；事件卡/道具首组逐效果冻结，不以资料名单直接启用。
2. **P9a–f**：按roadmap分六波，身份牌池5项、定向攻击/封夜6项、映射流程7项、攻防动态6项、表达秘密6项、其余觉醒8项，共38项。觉醒隐狼已P7交付，不重复计数。
3. **P10**：64项状态与22机制支持取值核对、已许可板子交互矩阵、双语、长期批量seed/长局资源和小规模预算T6。不能用目录名称、低层API或少量随机局替代完整功能验收。

每角色遵循规则文档→独立R/A/L（含T/D）审查→修正复查→人工判例/实际双传输两语完整局及严格Tape→每板固定seed→前端/视频→功能commit。公共底座、完整角色、组合板子和阶段验收按职责分笔；原始oracle不用生产函数计算，真实外部模型评测只在用户授权的隔离配置与预算下进行。

## 提交与收尾

赠枪底座 `5c41428`，之前是死亡实例许可 `0c3c878` 和Black规则冻结 `0b389d8`。本轮已提交旧配置测试planned示例修正 `3bcadb6`、Black完整功能 `83cac45`；最后一笔为P7验收与交接文档。最后文档commit的准确hash用`git log -1`读取（不在自身内容写自引用hash），功能记录登记在[进度](progress.md)。接手先确认git status及该处hash，再做后续工作，避免把未提交的用户内容一并提交。
