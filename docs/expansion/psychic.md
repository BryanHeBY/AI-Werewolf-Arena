# P7：通灵师与具体查验实例规则

第17项 `psychic`／通灵师／Spirit Seer，采用[AWA冻结卡](rules/awa-psychic-v1.md)。普通通灵师、魔镜少女、石像鬼及机械/觉醒的复制者分别冻结，AWA 机械狼有限白名单板已独立交付，见[机械接入契约](mechanical-wolf.md)。

## 共用能力，分开的规则

具体角色查验继续使用 `role_check`、numeric `inspect_role` 与 typed `role_inspected`；工具名/schema保持中性。每实例state新增可选 `policy:"gargoyle"|"psychic"`：旧缺省明确兼容Garg，新原生Psychic显式写psychic，未知值在原生/授予安装前拒绝。policy不是任意priority/规则开关。

| policy | 时点 | 重复/必须 | 跳过与刀权 |
| --- | --- | --- | --- |
| gargoyle | 180，刀前 | 不自验、不重复；有目标必须完成 | 无目标不伪造报告/消费；只原生Garg能形成查后刀完成范围 |
| psychic | 600，女巫后 | 不自验，允许跨夜重复 | 可不调用工具/null决策跳过；无原生狼权限，不形成Garg完成范围 |

两个具名handler按实例policy筛选。同一个Villager可以分别拥有early/late能力，真实身份不变；不能根据持有者底牌或来源猜规则。ToolSpec与validator只有一份，各profile引用相同对象/函数，避免同名工具被注册顺序覆盖。Baseline、目标提示、受限观察策略及SDK/ACP共同policy使用本轮bound实例，角色背景明确原生能力与获赠规则区别。

通灵的skip/noTargets关闭lastUsedDay、本次uses不增加，旧查验lastDay/lastTarget/history不改。合法skip是无工具决策，`target_id:null`仍非法；三次非法回复不是合法跳过。无目标无请求/假报告；私有`role_inspection_skipped {actorId,abilityId?,day,reason:passed|no_targets}`可追踪已关闭机会，公共终端/chat不展示。

查验结果仅为规则role标签，尊重隐狼明确伪装，过去typed报告不因后来接刀回写。获得Wolf知识不授予阵营/狼队关系/聊天/刀。actor/target原生命、role/state/ability/policy与phase最终复验；gateway ok不是迟到提交授权，取消null不当合法skip。

成功/合法skip/noTargets记本World/day ledger，完整夜流水线已提交重入拒绝；另World独立。私有引用不进入DTO/事件/Tape。受控transfer保完整语义policy/history/资源及lastUsedDay，JSON规范化可选undefined等同缺键，拒绝清空或改变policy；显式授权旧知识、不重发旧事件。copy/gift新实例必须声明初态资源，history与资源独立。

## 配置与接口

`roles.psychic`仅{}、maxCount1，公共parse和bootstrap同限。新ActionStage `psychic`、私有skip事件及state.policy是本笔数据变化，原工具参数不加nullable或可切policy字段；公开schema2/Tape2保留，source/lock/RNG严格兼容不放宽。旧Garg缺policy行为一致，旧source的内部Tape仍拒当前引擎静默复现。

[六人](../../configs.example/boards/six_player_psychic.json)是两狼／通灵女巫／两民；[十二人](../../configs.example/boards/twelve_player_psychic.json)是四普通狼／通灵女巫猎人守卫／四民，有警长。均AWA已实现角色改编，关闭自爆、屠边；这两例不含机械狼；另有独立已验[机械板](mechanical-wolf.md)，镜隐迷踪及任意组合仍未声明支持。

```sh
bun run --cwd backend run --configs-dir ../configs.example --game-config-name six_player_psychic
bun run --cwd backend run --configs-dir ../configs.example --game-config-name twelve_player_psychic
```

[6字面场景](../../backend/tests/support/psychic_scenarios.ts)×SDK/ACP/混合×两语=36本机完整局及全部严格Tape，覆盖首夜刀通灵又救、次夜repeat/skip、Good/Wolf末边、王枪报告前缀与完整流程、隐狼接前/后重验、十二人三夜及真实竞选/毒枪/警徽。演员只持本人静态计划；机械原生查验为另一个独立技能，时点以[机械卡](rules/awa-mechanical-wolf-v1.md)为准。两公开板各20受限seed自然终局、0拒绝/回退、实际查验/重验/skip正覆盖并全部重放。

另四个真实factory双policy赠予任务验证Garg重复拒绝后纠正、Psychic允许重复、身份/完整规则/接收只读及MCP/Agent回收，不算完整局。核心固定gateway后撤权、同refpolicy改变、null取消、copy独立账本、同World完整pipeline重入、跨World、梦保护/连续梦死/魅惑实际结算后报告保留。前端从实际God档验证skip/role信息不改seat、后续真实死亡及胜者独立，纯frame/原文/locale不变；证据见[三路审查](reviews/p7-psychic.md)。

P7其它6角色及P8–P10继续，未把本角色交付当整阶段或64角色全部完成；T6外部模型与发布长局保持目标。
