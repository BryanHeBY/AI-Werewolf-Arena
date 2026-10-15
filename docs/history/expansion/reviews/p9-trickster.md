# P9c 诡术之境有限组合板功能验收

日期：2026-10-11（UTC+08）。基线 main@5f25fd9。仅登记本规则的 implemented，不关闭 P9c/P10 或用户总体验收。

## 支持范围

公开预设 awa_trickster_12_v1：三普通狼、诡术师、四村民、预言家、女巫、魔术师、定序王子。政策 awa_trickster_exile_v1；具体边界与来源见 [规则卡](../../rules/awa-trickster-exile-v1.md)。

原始身份、号码、票数不变；仅在最终有效放逐目标确定后映射一次。王子作废的首轮票不能触发映射，重投与 PK 得出最终目标后才映射。目标已经死亡时不额外放逐，也不回退杀死原目标。夜间同对魔术师与诡术师效果抵消，已消耗号码均保留。施法者死亡不回滚有效提交。
诡术师首次个人选择前不获知队友，完成选择后按规则加入狼队；系统身份提示保留首次快照，逐行动 user 状态更新队友信息。该行为通过真实传输逐行动校验，不以旧 system 文本代替当前权限。

## 验证记录

各次运行独立，数量不得相加冒充唯一测试总数。

- 中英两语言各 20 seed，共 40 局原生 World 自然终局。
- 新旧角色事实解析、Tape 重放与篡改拒绝复验：56 pass / 0 fail，1085 assertions；覆盖诡术师、魔术师和定序王子。
- 映射、同对抵消、王子重投后 PK 三个正常场景，中英 × SDK/ACP/混合，共 18 局真实本地确定性传输，9 项测试、7884 assertions 通过。无付费线上模型调用。
- 生成并保留 6 份真实 replay 和 6 份末 checkpoint，供浏览器实际出局席位与死亡目标映射回放。
- 逐行动队友知识、缺失/晚到动作及王子流程失败前缀，与旧魔术师、王子回归合跑：39 pass / 0 fail，14591 assertions。
- 全前端单测 431 pass / 0 fail，4712 assertions；新增 Chromium 回放 6 pass / 0 fail，单 worker、零 retry。
- 非法必需选择、双方消耗不退款及王子消耗保留、公开配置与已测场景等价，连同旧角色失败回归：35 pass / 0 fail，7676 assertions。
- 独立只读审查确认上述三个补验缺口闭合，未发现本轮指定范围的 P1/P2。正式登记后的最终门禁：目录与公开配置 5 pass、229 assertions；完整前端 431 pass、4712 assertions；完整 Chromium 216 pass，单 worker、零 retry；前后端 build、check、lint、format:check、diff 均通过。1114 份输入文件指纹前后完全一致。日志位于 awa-trickster-registration-final。

## 关键修复与边界

录制严格解析补齐 trickster_candidates、trickster_may_pass 和私有事件 audience；审计绑定决定、消耗、同对抵消、最终放逐映射及实际死亡，不接受删除映射后重编号的伪造录像。
测试 oracle 原先漏列 trickster 狼队身份，导致合法狼队讨论被拒绝；修复允许名单，同时增加诡术师私有事实类型、字段和接收者校验，未放宽生产隔离。
数据事实解析遵循共享 data-descriptor 复制契约：拒绝 getter，不触发属性 get；不能将此描述为屏蔽所有 Proxy 反射陷阱。

本批功能门禁通过后目录为 23 verified、17 implemented、24 planned，40/64。P9c 阶段全量、其余角色与 P10 仍开放；历史全后端通过记录不代表当前源码全量验证。仅 main 本地线性提交，不推送。
