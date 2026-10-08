# P4 G03：死亡动作窗口授权

对应 [死亡来源子批](death-causes.md)，本批收紧原来通过 stage/trigger 与布尔 allowDead 标志授权的通路。完整死亡链 Alive 归属、自爆/徽章和遗言策略继续后续 G03，不提前登记新角色。

## 所有者与有效期

World 持有 transient death-action map，DeathResolution 为单一死亡演员打开 `shoot` 或 `speak` 窗口，授权覆盖实际钩子消费，整个 onDeath 在 `try/finally` 中关闭窗口；不会在返回选择时提前关闭。相同演员已有窗口时拒绝重入；每次打开分配局部递增 ID。关闭幂等，旧句柄不能关闭后来的新窗口；不同 World 不共享授权。窗口不保存认证或会话内容。

授权绑定 `actorId`、tool、day、phase、generation 和存活组件/生命周期版本。原生 AliveComponent 的每次存活转换增加内部版本（WeakMap保存，不进入DTO/Tape），死亡→复活→再死亡永久失效旧授权；替换Alive组件同样失效。请求的 `death_action_id` 只是关联值：World 没有匹配窗口时，复制 metadata、stage/trigger 或旧 ID 不能授权。SDK/ACP 共同接收层同时要求正确死亡 stage/trigger，最终 gateway 再校验 World 窗口和当前存活/角色/目标/资源；内部 shot/pass 选择还携带本次 deathActionId，Hunter await后在同步消费点再核对对应World窗口。引擎窗口的isCurrent查询绑定运行阶段/天数/终局状态，接受后的微任务撤销也不能消费。预检仍不消费，枪由原死亡钩子完成。

- 枪只在确实死亡且具有当前授权的猎人死亡行动中通过，生存猎人不能自由开枪。
- 遗言有自己独立的 `speak` 窗口，不给枪/投票/其他技能权。
- 成功、空枪、非法重试耗尽及原异常/取消都关闭窗口；异步状态/天数/阶段改变或主动撤销不会应用迟到选择。
- PhaseManager 切换到不同阶段时同步清空窗口，进入终局同样关闭；旧 turn 的 ID 不会在下一窗口复活。
- `activeDeathActionCount` 提供内部资源计数，用于清理断言；不放进玩家 DTO/观战内容。

World 是受信引擎容器，`openDeathAction` 是引擎装配 API，不暴露给模型/MCP。拥有完整 World 的宿主代码可以改变游戏状态，受限模拟与远端模型仍只通过既有 DTO/ActionTurn。局部 ID 不是跨局会话 token，跨传输 session/turn 隔离继续由 A01/A02 所有者保证。

## API、记录与错误

`ValidationContext.allowDeadHunterShoot` / `allowDeadLastWords` 删除，改为 `deathActionId` 并要求 day/phase 匹配；模型提交的 action arguments 没有新增权限字段。定制死亡机制需要使用 createAliveComponent 创建可跟踪生命周期的组件，先打开 World 窗口，再创建请求/最终验证；shot/pass 返回值包含 deathActionId，实际消费后最后关闭；复制布尔标志不兼容当前执行。

`ActionRequestExtras.death_action_id` 可选正整数，内部 Tape 的严格 request schema 收录；ID 顺序由引擎流程复现，源码兼容门槛不放宽，schema 仍为 1。原始引擎请求与Tape保留关联字段，PlayerPromptPolicy的受限Observation.request副本删除death_action_id，隐藏的他人窗口数量无法通过全局序号泄露；SDK/ACP文字不显示该ID。公开复盘/玩家记录 v2 和已有技能事件 payload 不变，旧原文保留。

拒绝 `death_action_unavailable` 提供中英一致说明；通用死亡演员在非死亡 stage 仍为 `actor_dead`，生存演员无授权枪为 `shoot_unavailable`。ID 不随公共技能事件发布。

## 验证

[人工窗口判例](../../backend/tests/engine/rules/death_action_authority.test.ts) 核对 actor/tool/day/phase/generation、伪造/关闭/重开、World 隔离、生存/复活、接收成功后撤销及最终校验、原错保留与清理、接受后微任务撤销（phase/day/终局/主动关闭/复活）、死亡→复活→再死亡和组件替换，以及不同他人隐藏窗口数量下受限DTO完全相同。实际 SDK HTTP/MCP 双语空枪回归显式打开测试窗口；完整 runner 通过真实 DeathResolution 打开/关闭，并严格 Tape 重放所有请求，不以手工窗口替代完整通路验收。
