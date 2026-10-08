# P4 G02 夜间能力实例

本批把原生/授予/复制的阵营查验、守护与用药迁入能力实例；死亡技能见已交付的[死亡链](death-chain.md)，具体商人/机械狼等角色和继承规则继续各自角色阶段。没有注册新角色，也不宣称所有未来M07能力变体已完成。

当前 P6 已增加[摄梦](dreamer.md)与[石像鬼 role_check](gargoyle.md)，P7增加[通灵policy](psychic.md)实例，以下 P4 验证计数保留历史。gargoyle policy的每实例禁重复与完整知识转移是明确规则；psychic policy允许跨夜重复；转移必须保完整 history/lastTarget/lastDay，不沿预言家可重置知识的政策。

## 所有权与来源

每个玩家的privateState.abilities按实例ID存储，实例拥有唯一state、source、startsOnDay、可选expiresAfterDay、maxUses、uses、lastUsedDay和disabled。原生状态不再同时放在privateState.seer/guard/witch；getter签名新增可选ID，缺ID优先原生或唯一实例，多个非原生实例不猜。setter保持两参数，只安装/替换原生状态并脱离输入模板，返回实际owned state；不是通用实例写入API。

native来源保存本人的底牌；gift保存赠予者，copy/transfer保存原持有者和实例ID。复制/转移引用必须存在且种类匹配；gift不要求赠予者本身拥有该技能。角色规则调用grant时必须明确提供初始化/继承state、次数与时点，不隐式复制其他玩家的查验历史。

来源是引擎事实，不是默认玩家知识。实例ID也是玩家可见信息，角色贡献不得把隐藏的来源玩家/原实例编码进ID；这由角色规则与测试审查，不另造ID映射层。非原生sourceDisclosed默认false；玩家事件及观察DTO只保来源kind，规则明确选true后才显示来源玩家/原实例。领域事件、内部Tape及god观战保留完整来源，玩家提示只提供本人资源及记录。具体秘密交易/复制版本仍由角色规则卡选择披露。

公开grant只接受gift/copy；transfer来源只能由专用转移路径创建，不能伪装成授予刷新机会。转移必须显式提供种类匹配的statePolicy，规则决定是否移交查验知识；默认隐藏source并不隐藏state中的历史，不能将完整state当成自动授权。转移保留uses/lastUsedDay/disabled，不能补瓶或清空守护历史，旧持有者失去状态。旧ID进入retiredAbilityIds防重用，避免迟到动作命中新实例；重新初始化被转出的原生能力使用新ID。转移不刷新次数或给予同夜第二次机会。

## 生效、使用与真实调度

能力从startsOnDay起，到expiresAfterDay含当日；disabled阻止使用，maxUses耗尽停止，lastUsedDay挡住同夜再次使用。合法不使用/空守不扣总次数，但结束本夜该实例的机会；查验/有效守护/实际用药增加uses，瓶数仍只在同一实例state里消费。晚于reset阶段收到的用药能力，也按当前真实day推导自救规则，不能继承过时的canSelfHeal缓存。无效或撤权动作不扣次数。

NightPipeline按能力实例而非底牌角色收集各类夜间能力，允许一人拥有多个同种实例。行动请求context.ability_id由引擎绑定，模型工具参数仍只传原有行动参数，不允许自行切换实例。接收及最终网关检查同一个玩家/实例、日期、权限与Night阶段；每次请求前与使用前重新核对存活/资格。

NightStageRegistry保留原阶段收集/去重/排序。起局已持有的实例，以及RoleProfile.possibleNightAbilities声明的可能授予种类，都会预留原生处理阶段。阶段前授予可当夜执行，已经过去的阶段不倒退；下夜再执行。startsOnDay可明确延迟到下一夜，不从角色身份或查验标签猜。

默认Baseline按本轮绑定实例选择技能贡献，守护遇到旧目标会空守，避免无效回退。共享Policy每轮呈现本人能力状态、资源与绑定实例；目标编号提示按绑定能力的规则选择，获赠守护/用药仍包含合法自目标，不改写真实身份。观察DTO包含脱离并冻结的本人实例，名字/模型/人格及历史仍跟随玩家。数据和展示语言逐局独立。

## 记录、格式与边界

ability_changed领域事件提供来源、时点和变更，玩家只接收本人事件且按sourceDisclosed投影。授予的具体技能事件额外含abilityId；原生事件保留既有payload，行动Tape的context仍记录绑定ID。公开/私有播放器schema2保持；内部Tape已随G04升2，旧1拒版，内部source兼容严格，不把旧privateState结构自动转成当前引擎。

三类旧拒绝code保留，双语解释改为能力当前不可用；ability_phase新增两语，避免把“非本角色”当成复制能力的失败原因。终端/时间线/视频的能力变化标签共用game-text。

本能力子批复用当时用药/伤害流程；相关正确性已由[女巫结算](witch-resolution.md)、[死因](death-causes.md)与[死亡授权](death-action-authority.md)独立修正并验收，不单凭能力数据结构宣称正确。

程序化PlayerObservation构造者须新增abilities数组；私有旧档仍按原数据读取。低层ToolGateway/ActionValidator的day与abilityId保持可选签名兼容，但调用能力必须传真实day，多实例必须传明确abilityId；省略day仅兼容第一日，不适用于第二夜起的期限/次数判断。

能力state与可选元数据在安装时规范成脱离的JSON数据，显式undefined可选属性按缺省缺键保存；非有限数、循环与非JSON状态拒绝。不能为安装兼容而放宽严格Tape。


## 验证证据与未交付部分

最终release:check通过476测试/30135断言，包含34实际双语SDK/ACP/混合基础整局及严格Tape。新增四项两語真实SDK HTTP/ACP进程和注入MCP测试，从Factory经过NightPipeline把平民的赠予查验实际生效，正确消费单一实例并确认Agent/MCP退出；没有把模拟AcpSession当作进程证据。

夜间能力人工判例23项/181断言覆盖两个同种赠予、复制守护、用药不使用/消费、生效/过期/封锁/转移、空缺原生角色的预留阶段、阶段前/后授予、模型请求前死亡/撤权、来源隐藏、模板别名、伪转移拒绝、转移知识策略、晚到自救的真实日期以及strict CP/Tape可序列化。前端54/365、类型和构建通过；未重复浏览器E2E或视频渲染。

原生/赠予的能力记录和完整基础对局可正常录制。合成赠予规则仅作为NightPipeline/接入判例，本批没有为任意外部回调或预注入状态提供跨引擎重放；具体赠予角色的完整决策/效果/Tape在对应P7角色阶段验证。source/lock门槛与旧状态政策没有放宽。

P7 role_check.policy是实例规则标识：旧undefined等价gargoyle，原生psychic显式标记；中性同名工具与validator按bound实例选择stage/repeat/必须，不看真实底牌。合法Psychic skip/noTargets只关本夜lastUsedDay、uses不增，完整转移保关闭与policy/history，返回值先JSON规范化。gift/copy不改变身份、狼权限或Garg原生查后刀范围；详情见[通灵契约](psychic.md)。
