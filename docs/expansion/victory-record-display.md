# P4 G04：胜利记录与中英呈现

接续[胜利核心](victory-outcomes.md)。manifest、公开复盘、终端、审计、工作台和Remotion均消费同一显式判胜事实；不从阵营/身份推断未记录的获胜成员。

## 原始判胜与运行结束

ReplayFinalizeMeta.gameResult可携带实际封盘；aggregate严格读取/复制，检查已声明玩家与winner投影。manifest新增game_result，保存outcome/decidedAt/判胜reason。finish_reason仍表示自然结束、runtime_error或runtime_timeout等执行结束原因。

公开replay schema仍v2，result新增可选decision（完整SealedVictoryResult），winner/reason原有字段保留：winner是primary faction兼容投影，reason是运行结束原因。已经赢了但cleanup失败时，decision明确胜利、reason明确runtime_error，两者不能相互覆盖。未封盘失败不造decision。

正常runner、受限模拟和离线动作复现显式传实际结果；旧手工finalize未提供结果时不猜。公开writer独立复制，不让修改调用参数影响已经保存的主档。reader拒绝非法kind/字段/成员/并集/point/投影/访问器和无法序列化的非枚举判胜字段，实际返回副本再次校验；合法header decision与所有合法typed terminal必须完整一致。未知其它字段及玩家原文保持已有政策。

## 同一展示文本

共享game-text提供claim、完整outcome、获胜名单与判定点的逐调用中英formatter。个人或关系primary的winner=null不代表无胜者。额外claim明确写“同时获胜”，成员并集不重复显示；无胜者必须是no_winner。

- 终端game_over与最终runner摘要使用同一格式。
- 审计摘要metadata使用完整胜利；审计AI输入保留decision机器数据，共同系统提示明确decision权威、null兼容投影及运行失败不能覆盖封盘。
- 工作台最终结果展示decision、获胜名单及point；运行原因与判胜原因不同时另列判胜原因。
- 时间线game_over显示同一结果与获胜名单；摘要、当前事件、时间线和视频帧均用全局玩家名单校验，未知成员等坏显式事实标未知，不回退成阵营胜利或无胜者。只有terminal而没有header decision的合法新档也能显示完整结果。原始JSON不改写。
- 席位只在当前帧已经经过合法typed game_over时标winner，已出局获胜者仍保dead但明确winner。
- Remotion按frame纯投影使用同一数据/文案，不读取播放/focus/系统时钟。终局之前不借最终result提前标席位；工作台的最终摘要本来是全局资料栏。终局主文案包含获胜名单，底部只补判定点，不重复名单。

机器goalId/groupId保原值，本批合成夹具使用scenario_solo/scenario_pair，不声称其为实际角色。后续角色提供真实规则与目标术语，不把伪造角色规则装入这些展示fixture。

## 旧档与无效输入

旧公开v1/v2的winner/reason按既有归一政策读取；没有decision就没有明确成员名单，不拿player.camp或role重建。旧terminal事件outcome与decidedAt均不存在时保旧文案，没有获胜席位推断。没有decision或终局事实的runtime_error/runtime_timeout显示未结束，不能当作no_winner；已有旧档明确终局或max_days_reached/completed保兼容。新显式decision不合法则加载失败；孤立坏terminal payload在标签中保持未知，不能造成getter执行或伪获胜。

内部Tape继续v2，public新增字段不放宽source/lock/rules。public录制格式与内部领域状态有明确转换，前端只依赖共享DTO及reader，不导入引擎。

## 验证与产物

[主档实际落盘判例](../../backend/tests/recording/victory_record.test.ts)两语五种结果核对game_result与public decision、清理错误后胜利保留、原文/副本/投影与getter/未知成员反例；[前端帧判例](../../frontend/tests/unit/replay/victory-display.test.tsx)核对结果、timeline、dead winner、无提前标记、静态markup、同帧确定性和legacy不推断。

[展示夹具](../../frontend/tests/fixtures/synthetic-victory-display/victory/zh-CN/god.replay.json)是三人合成个人+关系双胜，只用于展示验收；实际基础/四窗口完整SDK/ACP/混合对局及严格Tape验证真实引擎的阵营结果记录。真实Chromium交互与中英PNG/英文MP4在本批审查中记录，不用纯函数断言冒充浏览器或视频产物。
