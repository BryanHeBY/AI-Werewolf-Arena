# P7：中立玩家枪协议底座

这是[觉醒隐狼规则卡](../rules/awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf)要求的独立协议修正，未注册或启用觉醒隐狼。目录仍21 verified/43 planned。

## 实现边界

- 原生Hunter内部事件仍为 `hunter_shot {hunterId,targetId}`，裁判God复盘保留真实来源；自己的死亡行动请求仍使用hunter_shot。
- 所有玩家可见的原生枪投影为 `player_shot {actorId,targetId}`，与未来复制Hunter成功枪一致。字段按白名单构造，未知库存、学习对象、trueRole等不能进入提示。
- 玩家event档stage按投影事件统一为death_shot；God旧档stage不改。普通玩家不能从原type、字段名或event档stage辨别枪来源。本笔不新增匿名公开复盘格式。
- 共用Prompt/ObservedBot依据中立枪事实排除已死目标。中英终端/前端/Remotion为中立枪文案，旧God猎人枪仍可读，席位仍按真实复盘身份展示。
- A发现成功枪审计遗漏player_shot；同时补齐已有mechanical_shot。blocked/silent不计成功枪。机械狼和狼王的公开事件保持各自已冻结规则。

## 验证与交叉审查

受影响门槛：backend163测试/1976断言/24文件，含投影等价/未知字段、真实玩家档type+stage、ObservedBot死亡知识、死亡连锁和枪授权/原生命、记录、呈现及审计。第一次沙箱无法拉起合成ACP审计子进程，不算通过；同门槛在允许本机子进程的权限下完成0失败。

实际十二人Mirror旧角色局LLM/ACP/MCP/混合×zh-CN/en：3测试、每项2语共6完整局、2600断言、0失败。God实际Hunter枪保持，所有玩家event档都是player_shot/death_shot；每局严格Tape与ACP/MCP PID清理。只是本地合成决策，不冒外部真实模型T6。

backend type/deps/boundaries/i18n通过，57项已登记兼容文字不变；frontend149测试/1296断言/24文件、type/build通过。前端中立枪单测/浏览器/PNG使用旧实际十二人God档的明确合成协议变体，只替换枪事件和stage，不能声称未来Aw对局已完成。

实际双语Remotion PNG frame4870均terminal0：/tmp/awa-neutral-shot-zh.png、/tmp/awa-neutral-shot-en.png。Root实图核中立字幕、四死/零赢家、God席位和警徽保留、无遮挡。

- A（review_arch_psychic）：首审发现审计漏计，修正后独立13测试/82断言，最终源码0残留；浏览器须等最终句柄。
- R/T（review_rules_psychic）：R0，独立25测试/129断言/6文件核两来源各viewer、哨兵/detach、真实持久档stage、ObservedBot排死、双语呈现审计及原枪life/迟到/替换；6完整局+Tape与现有前端/browser足够，支持提交，不需无关广测。狼王/机械公开类型保持各自既有披露规则，Aw仍planned。
- L/D（review_rules_gargoyle）：最终0残留，玩家协议与档stage一致，God原来源/本人请求/旧God兼容保留；独立目检双语PNG中立caption、四死、无提前赢家且无遮挡，审计同步和browser两例通过，支持提交。
- 实际Chromium：现有句柄6006 terminal0，双语新增中立枪2测试全通过（2.3min）；字幕、四个死亡席位、零赢家及画面无遮挡与两图一致。

下一笔实现正常可挡的额外刀与不反射毒的复制盾，再完成Aw580学习/实际900激活、六学习结果和原十二人镜隐板完整通路。P7黑市商人、P8–P10、64角色/22机制、长局/T6继续。
