# P6：摄梦人接入与契约

第十二项原生角色`dreamer`／摄梦人／Dreamer，[冻结卡](rules/awa-dreamer-v1.md)选择普通必选/夜间免伤版本。觉醒摄梦人仍是长期候选，不并入64目标。

## 能力、信息与消费

`dream {target_id}`必须其它当前存活玩家，没有self/null/pass。原生及低层grant/copy的梦能力沿现有G02实例，独立id/资源/lastTarget/lastDay/history；每夜一次，相邻夜同一实例同目标判连续。真实stage先后与生命/版本、组件/能力/state引用在await/gateway后再验，最终才写状态/消费/私有dream_applied。

有效资格/clock/稳定合法目标存在时，三次无行动或无效梦会明确throw `dream_required_action_missing`，不静默跑成无梦局；撤权/取消不消费。已经有效提交的前缀保留。

Night关系/原生命引用保存在DreamNightFrame，不放进目标的StatusMarks、privateState、DTO或record op。梦游者无直接通知/预检差异，仍可能从合法公开夜枪保护结果推断。Witch拿原狼票刀口，可对梦目标合法耗药后落空；不提前把shield当空刀给她。

`dream_applied`仅actor，`dream_death`God-only（禁止首日竞选前泄露待夜死关系/原因），公共`death_shot_blocked`只有actor/target/night_protection，没有具体role/ability；公共`additional_deaths`只匿名实际新死IDs，玩家观察与前端同步。operator诊断flags按[日志矩阵](runtime-display.md#p4-m21sdk--acp-日志开关)，事件private开关不屏蔽另开的本人IO/思考。

## 伤害、关系和夜枪

NightPipeline在所有能力后，让core Damage吃已验证的保护/连续梦亡ID；普通WolfKill/Poison被梦阻止，同守同救不击穿梦，连续Dream不能由梦/Guard/Heal阻止。DreamNightFrame按关系固定点追加Night梦亡提案，去重并保复合原因，不写Alive。

DeathResolution唯一写整波死亡、初批遗言/警徽/角色技能/追加波次，PhaseManager最后judge。首夜初批Dream可遗言、额外波次不增遗言；Dream或复合Dream禁Hunter/WolfKing枪。Night死亡的施梦者牵连当夜目标，普通Day死亡不延续保护或关系。

夜源Root以原NightDamage.deaths逐actor决定，首日White/普通自爆Day根不共享Night许可；同体Night+Day复合仍保原Night来源。NightRoot死亡枪即使请求phase为Day，其Shot后代继承梦效果范围；保持既有action phase/death_phase。Night枪打梦目标照常消费，写blocked而不伪造hunter_shot/wolf_king_shot；打施梦者时补梦亡/公共匿名死亡。Day枪无Night关系效果。

同波已标死的梦目标仍补Dream原因，在其未执行钩子之前禁枪；不重复mark/publicdeath。已在当时有效原因下完成的行动不回滚。所有补因绑定原死亡生命，复活/组件替换不借旧关系。

夜源resolve接manager的phaseRevision/current clock；同phase或离开再返回撤权后，旧遗言/枪/gateway结果及连锁不晚写，permit覆盖到最终提交再验并关闭。已实际初波保留，不伪造回滚。

## 生命周期与程序接口

- 新增NightAbilityKind与tool名为`dream`、ActionStage为`dreamer`（handler ID为`dreamer_action`），同步闭合枚举；原生/额外实例共享模板，实际获赠者有完整中英规则/绑定历史，仍保本来身份，不冒称摄梦人。
- World为key的私有WeakMap在同步dream commit时记本日。已提交后同World/day重建NightPipeline或再次执行都抛`dream_night_reentry_after_commit`，避免资源已耗却丢关系；正常下一夜不受影响。失败World不支持同夜“重新跑”，从完整录制/新World重建；不提供没有恢复本夜快照的假继续。
- `NightPipelineResult`成功分支新增内部dreamFrame，只给引擎结算，不是序列化DTO。`DeathResolution.resolve`最后可选nightEffects（dreams/nightOriginIds/isCurrent）供正常manager调用；旧低层无参不获Night梦效果。
- DeathHook额外可选context控制nightEffect/blocksNightShot/isCurrent，结果可选nightEffectTargets传播来源；默认旧调用兼容。扩展hook必须明确来源，不靠当前phase猜Night。
- transfer保lastTarget/lastDay/uses/本夜标记，不能清空连续历史换保护；已生效关系属于原提交者。本批低层grant/copy有显式状态政策，真实商人/机械狼角色继续对应阶段另验。

schema2/Tape2保留，source/lock/rules/RNG门槛覆盖新代码；Frame引用与函数不落盘。公开档保God信息，玩家档按明确受众；原始名字、发言和旧记录不重写。

## 配置与实际门槛

`roles.dreamer`仅{}，未声明免毒/可弃权/全天牵连字段拒绝。公开[六人](../../configs.example/boards/six_player_dreamer.json)为一狼/摄梦/女巫/猎人/两民（AWA演示非竞技配比）；[十二人](../../configs.example/boards/twelve_player_dreamer.json)为4狼/预女猎梦/4民。均屠边、关闭自爆以聚焦梦，12有警长；混合早爆与双梦是明确人工交互变体。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_dreamer
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_dreamer
```

[人工core](../../backend/tests/engine/rules/dreamer.test.ts)覆盖保护/获救/夜死/连续/禁枪、夜/Day枪、双梦固定点、混波/同体来源、已死补因、World重入/mandatory失败、cancel/gateway撤权及获赠身份。9[字面场景](../../backend/tests/support/dreamer_scenarios.ts)×SDK/ACP/混合×两语＝54 actual本机完整局，逐turn验证真实身份/历史/规则、拒绝纠正、资源、God/私人受众、匿名死亡/胜负与全部严格Tape；演员只本人literal计划，不查World生成决策。

另无原生Dreamer板子中获赠梦能力的4次真实factory SDK/ACP/MCP任务验证完整规则/真实Villager/只读接收与进程ESRCH；不是4个额外完整局。两个公开板各20seed受限观察自然终局/零拒绝回退/实际梦分支及全部Tape补覆盖。实际前端God档/browser/Remotion、最后全量与三路闭环见[验收记录](reviews/p6-dreamer.md)。P6其余四角色、后续阶段与T6/发布矩阵不据本角色提前关闭。
