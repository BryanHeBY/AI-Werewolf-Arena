# Mechanical Wolf 接入契约

本版以 [AWA 机械狼 1.0.0 规则卡](rules/awa-mechanical-wolf-v1.md) 为准。六人示例采用屠城；十二人标准机械通灵示例采用屠边并开启警长。两者均只允许 Mechanical/Wolf/Psychic/Witch/Hunter/Guard/Villager；其它底牌组合在公开解析及直接装配入口均拒绝，不通过隐藏身份过滤学习目标。

## 身份、状态及行动

真实 role/camp/victory 始终为 Mechanical/Wolf/Wolf。一次学习保存真实学习目标的身份事实及独立库存；具体角色查验立即显示该角色，阵营查验仍 Wolf。学习目标后来死亡或变化不回写已知事实。机械原生能力不装成普通 G02 gift/copy，不复制目标资源及历史。外部已支持 G02 能力仍按其绑定实例规则独立运行。

| 阶段 | 优先级 | 接收与状态 |
| --- | --- | --- |
| mechanical_mode | 250 | 第二夜起选择 kill/skill，null 回复默认 skill；每夜只接受一次。进入实际夜晚时更新被动枪就绪及额外刀过期。 |
| 既有狼票 | 400 | 唯一活真 Wolf、已继承、达到固定刀夜且原 mode 范围仍有效才有 kill_vote；不授狼聊或历史。 |
| mechanical_mimic | 580 | 女巫后、通灵查验前，一局一次 mimic_role；合法等待只关闭本夜，任意 mode 可晚学，所有技能次夜起。 |
| mechanical_skill | 650 | skill 模式按实际已学库存生成 mechanical_inspect/poison/guard；合法 skip 关闭机会但不消费瓶数。 |
| mechanical_attack | 660 | 仅已学 Wolf 的固定首次可刀夜 kill 模式；单次独立目标或 null，不改基础刀及女巫刀口。 |

学习、每夜模式和机械技能机会由一个 typed MechanicalState owner 持有。mode 权限额外保存原 World/role/state/life/phase 与已接受种类快照；序列化 mode 或复活后的旧 mode 不恢复行动权限。主动效果绑定原学习、技能种类和模式，消费自身资源不撤已提交效果。

库存提交前重验：毒瓶在 await 及 gateway 后仍须大于零；枪绑定原 role/camp/privateState/MechanicalState/learning/gun；刀绑定固定窗口与原目标生命。撤权不能消费新 owner 资源，已实际消费的前缀保留。

## 结算与信息权限

机械盾、额外刀、自罚进入本夜 typed effects；毒药保留每个原 caster/target 生命。Damage 一次计算伤害和反射因果，NightPipeline 只将反射事实写成 God-only mechanical_poison_reflected，玩家 summary/DTO/state/history 无毒手身份。盾不递归反毒，反射绕过施毒者的机械盾，Dream 仍挡反射；普通 Guard/Heal 同守同救对两种刀均抵消，独立机械盾保留。

PM 装配及 DeathResolution 完整实际提案 mark 后才能写一次继承事实，首刀夜固定 max(2, factDay+1)。同批自身和末其它 Wolf 死亡不假继承；先独立批获得后再被 Hunter 枪杀保留事实历史。遗言、警徽、全部枪/追加死亡后才判胜。

模式、学习、机械技能选择和继承事件仅本人；反射因果所有玩家不可见。机械枪是本 AWA 明确授权的公开披露：公开机械枪类型、机械狼身份及实际命中目标，不公布学习对象 ID 或其它库存。事件 `mechanical_shot` 只在实际死亡提交后发布，前端由该事件更新生命；学习、选择、反射及判离选择本身均不改席位。

中英文共享稳定工具名/key/role ID。完整规则及库存提示、拒绝原因、目标提示、终端/时间线/视频标签均本地化；机械事件 wire 标签严格验证数字、角色、模式与布尔值，畸形数据显示 Unknown，读取不执行 accessor。God 复盘保持真实 Mechanical 席位，具体查验标签不改底牌。

## 验证与交付

九类字面完整场景覆盖民/重复查验/单毒/反毒/连守判离/被动枪/额外刀/晚学默认 skill/十二人继承枪连锁，三通路两语言共 54 局，逐局严格 Tape、私有视图、实际模型提示与资源回收。六人和十二人各 20 个受限观察种子另做自然结束、技能/skip/继承/刀票正分支及全 Tape。

十二人初探 0–19 未覆盖继承，20–39 仍无；40–59 有继承但无实际刀票，60–79 的 79 有两次机械刀票。采用固定 60–79，不改公开牌池、策略或断言。功能提交前最终结果及修复链见 [审查记录](reviews/p7-mechanical-wolf.md)。P7 整阶段结束仍须全部已支持矩阵回归；T6 真实外部模型及 P10 长局/发布验收继续保持。
