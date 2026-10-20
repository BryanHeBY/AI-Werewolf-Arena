# 典狱长原十二人示例

[规则卡](../../rules/awa-melbourne-warden-v1.md)明确区分主办方公开核心与 AWA 补全。有限牌组为三名普通狼人、典狱长、四平民、预言家、女巫、猎人与摄梦人；不开放任意高级角色混板。

## 可运行配置

[Board](../../../configs.example/boards/awa_warden_12_partner_native_v1.json)、[LLM game](../../../configs.example/games/twelve_player_warden.json)、[ACP game](../../../configs.example/games/twelve_player_warden_acp.json)。保留已有 runtime 与隔离认证配置，仅复制本族 board/game：

```bash
mkdir -p configs/boards configs/games
cp -n configs.example/boards/awa_warden_12_partner_native_v1.json configs/boards/
cp -n configs.example/games/twelve_player_warden*.json configs/games/
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_warden --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_warden --locale en --display-locale en
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_warden_acp --locale zh-CN --display-locale zh-CN
bun run --cwd apps/game run --configs-dir ../../configs --game-config-name twelve_player_warden_acp --locale en --display-locale en
```

LLM 示例使用 `deepseek_v4_flash`，ACP 使用 `acp_default`；可将 game 的 agent 改成现有 `runtime/agents.json` 中已配置的名称。`roles.warden` 只支持 `policy: awa_melbourne_warden_v1` 与 `forcePolicy: awa_warden_partner_native_v1`，省略参数时采用相同默认值。

## 实际行为与知情

N1 不请求交易。N2 起，pair 在摄梦、狼聊及团刀前完成；保留现有各阶段顺序，不全局重排摄梦。两名不同的未参与存活者可含典狱长本人；合法 pair 提交立即消耗双方整局一次资格，null 明确空过不消费。双方先独立收到仅含 partner 座位的请求，再秘密选择 `trade` 或 `betray`。

普通双交易只免本夜夜刀、毒、梦连续和夜源梦连锁，不免交易死亡或 Shot。双背叛仅强制双方各自已有的原生个人技能指向 partner，团队刀票保持原目标。女巫可以明确 none，救药还必须满足真实刀口、自救和库存规则。平民、猎人、普通狼和典狱长不会凭空得到新个人技能。本人入局采用专门四格：同选典狱长死、异选另一人死；不叠普通保护或强制。

pair 仅主持者知道；对象通知与决定仅对应参与者知道。主持者不会因为主持而获知其他人的选择。完整结果只入 God 记录。缺失、迟到或撤权显式失败，已付 pair 与已接受的决定保留，不默认填充选择。运行入口现有失败策略会取消其它仍未完成的请求，不能将取消后的晚提交当作成功回执。

## 两语真实教学归档

[中文](zh-CN.replay.json)与[英文](en.replay.json)来自种子 `warden-transport` 的本地合成 SDK 服务和真实游戏工具/录制链，无付费模型。N1 不交易；N2 预言家与女巫双背叛，预言家实际查验女巫，女巫已耗毒而明确 none，团刀仍打另一座位；N3 典狱长与平民双交易，按本人表以独立 Deal 死亡，狼队清空，好人自然胜利。

两份文件均为完整 **God 视角**，包含角色与秘密决定，不能充作玩家授权档案。前端按实际事实显示时间线；pair、决定和死亡提案本身不修改生命，实际淘汰仍由对应死亡事实驱动。固定示例关闭警长与自爆窗口以突出交易；公开可运行 board 保留警长与原自爆机制。
