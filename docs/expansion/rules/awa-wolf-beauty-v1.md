# AWA Wolf Beauty 1.0.0 规则卡

awa_classic 1.0.0角色扩展，ID `wolf_beauty`，狼美人／Wolf Beauty；核验2026-10-08。普通与P9觉醒狼美人分别登记，不采用设计大赛投稿的双人互殉情。

## wolf_beauty

- 狼阵营/狼胜利归属；进入普通狼队互认、夜聊和刀票，互认仍只有授权ID，不额外揭特殊牌。本人不能自爆，不能提交刀自己的刀票。AWA将“不可自刀”限定本人行动，其他狼仍按原狼队规则；不通过对队友特殊牌的秘密目标校验泄露身份。
- 首夜起，狼刀后/女巫前可 `charm {target_id}` 其它当前存活玩家（可包括队友），`target_id:null`或可选无行动明确本夜不魅惑。每夜一次，连续两个相邻夜不能同目标；跳过/换目标打断此限制。合法null或可选无行动skip消费本夜机会、清当前关系、写本夜history null并打断邻接；非法不改旧关系，跨空夜按真实相邻day不构成重复。当前关系保至下一夜的新选择/跳过，旧已知历史不删除。
- 只有本人收到选择/状态，目标不获直接通知、标记、特殊行动或错误详情。非法/迟到/撤权不消费、不换掉已有效关系；当前clock/演员、目标生命与state引用在消费点再验。
- 实际被放逐或被毒杀时，当前魅惑目标牵连死亡，使用独立Charm死因；新增魅惑死亡无遗言/死亡枪，Night和Day均不受Guard/Heal挡住。若目标已经属于同波初批死亡，保留按原死因已经有效完成的遗言，补Charm原因只禁止尚未执行的死亡技能，不回滚已提交动作。骑士Duel、Dream、普通Shot、WolfKill、WhiteWolfBlast等非Exile/Poison原因不触发；包含Duel/Dream/Lovers的复合原因禁止魅惑（不以Poison混入绕过禁技能）。非本版本触发死因不借旧目标发动。
- 魅惑目标先已死亡则不重新杀、不牵连其新生命；死亡钩子先验原绑定生命/角色/state。多狼美人可分别选择/牵连，原因去重、循环终止，不重复授予死后行动。
- 夜源Poison触发的Charm属于夜间伤害，当前有效梦保护可阻止目标牵连，仍消费该关系；公开只显示实际死亡ID，阻止/关系详情为God信息。Day放逐牵连不受上一夜梦保护；Night Charm命中施梦者可继续触发其梦链。
- 整波先dead→初批遗言→警徽→技能/追加波次，PhaseManager最后judge。新增Charm死亡属于追加波次，无额外遗言；放逐/首夜毒死的狼美人自身按基础规则遗言。

## 判胜与所有权

只在exile_settled检查点的slaughter_side条目内部应用，仍按winConditions先命中顺序；例如[City,Side]先City普通Good胜，[Side,City]先Side特殊Wolf胜。真正放逐定案前只有此狼美人一名活狼、其当前魅惑最终实际带走最后一神或最后一民时，本次放逐结算的狼方优先胜利。候选信息由PhaseManager私有持有，不放进本人prompt/DTO泄露隐藏狼数量；实际牵连被保护/未生效/目标先死/未消灭整侧则仍按普通条件。非放逐、非末狼、非屠边不启此例外；胜者成员沿真实Victory归属，含已经死亡的狼。

角色拥有魅惑状态/机会，私有World绑定只保存实际生命快照；DeathResolution唯一提交死亡与公开匿名事实，不把role hook的提案当击杀。候选与最终判胜由PhaseManager处理，不增加通用投票或“角色直接封盘”框架。失败/取消保已提交前缀，phase revision覆盖消费/死后动作。

## 来源与AWA选择

[组织者狼美骑士板](https://melbournemasters.org/setups/lang-mei-qi-shi)明确狼队见面、刀后魅惑、放逐/毒触发、不能自刀/爆、骑士使魅惑失效及末狼连最后一侧判狼胜。该网页不是各平台统一规格；相邻夜禁止重复、可skip/null、本人自刀解释、复合Dream禁技能、生命绑定/夜梦保护与候选时点为AWA明确细则，必须各有判例。

[官方动物梦境说明](https://langrensha.com/news/official/20211025/26904_981415.html)确有子狐/河豚使魅惑失效的交互；对应角色未到阶段，不能本批声明已支持。[2023设计赛稿](https://langrensha.com/news/official/20230221/26904_1074195.html)不是本普通版或P9正式觉醒版的替代规则来源。

## 参数与验收

当前增加有限 `roles.wolf_beauty.deathLinkPolicy`，默认 awa_exile_poison_v1，历史 heroes_s7_2017_exile_hunter_v1；见[历史策略契约](../contracts/historical-night-role-policies.md)。本卡上文描述 AWA 默认，未声明双目标/自爆/全天无条件牵连参数拒绝。6/12公开板子必须完整配置并含已注册角色；支持范围由契约/实际矩阵列明，不凭目录开放未实现角色。

必验：互认/狼聊/刀权与无自爆、自刀；charm合法/self/null/重复/撤权/目标生命更换/换目标和过期；放逐/毒与其余死因矩阵、Duel/Dream复合禁技能、Guard/Heal/梦Night交互、多Charm/循环/同波；遗言/徽章/末狼特殊候选/普通Good胜与全部追加后judge；无目标通知/本人状态和隐藏狼数量不泄露、中英工具/错误/状态/结果；6/12字面完整局、SDK/ACP/混合/Tape、每板固定seed受限观察与分支、终端/前端/browser/实际frame、三路交叉审查。

P8情侣补充：所有deathLinkPolicy的Lovers死因均抑制魅惑发动，按殉情禁死亡能力作有限工程补全；这是新增跨角色交互，旧无情侣板子保持兼容。见[丘比特来源策略](sourced-cupid-v1.md)。
