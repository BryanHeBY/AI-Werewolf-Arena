# P4 G02：类型化查验结果

当前 P6 [石像鬼](gargoyle.md)已接入独立 `inspect_role` 与 typed `role_inspected`，P7[通灵师](psychic.md)以同工具的实例policy允许重复/skip并在女巫后执行；原生预言家仍只查 camp；具体 role 标签尊重[隐狼](hidden-wolf.md)的明确伪装。以下 P4 计数和“本子批”范围为当时证据。

## 当前子批范围

共享InspectionResult区分`camp`、`role`与`combined`；结果是规则揭示的标签，不等同于真实阵营或底牌。生产预言家仍只执行阵营查验，具体身份/组合查验的角色继续P5–P9；能力资源及动态调度基础已交付G02。没有因此启用计划角色，M05/M07/M08也未整项标完成。

| 结果 | 内容 | 不得隐式包含 |
| --- | --- | --- |
| camp | good / wolf / third_party | 真实role、资源或其他玩家知识 |
| role | 目录稳定role ID | 阵营或能力集合 |
| combined | 明确的camp与role标签 | 未列入该结果的真实状态 |

RoleProfile可提供静态或按本角色状态计算的inspectionLabels。共享`resolveInspection`纯查询把目标投影成指定类型，返回新对象；它不授权行动、不消费资源、不转阵营、不改变狼队权限，也不自动执行查验触发伤害。缺目标返回null。具体行动先由规则/网关校验目标与资格；未来守墓等死亡查询不能把该helper的读取能力当成玩家公开API。

目标自定标签不因角色是狼而自动改其Camp或刀权。特殊狼、第三方、伪装与反查的确切标签仍由对应已冻结规则卡决定；本批仅用合成profile检验分离，不将其列成可配置的新玩法。

## 预言家实际链路

seer_checked的领域payload新增必填result；领域事件及SeerCheckResult的类型明确收窄为camp，不允许用该原生事件夹带role模式。SeerCheckResult、私有最新结果和history保存同一结果的独立副本。兼容isWerewolf保留，但只由本次揭示的camp==wolf派生；false不代表结果必然是good，third_party必须看完整result。

普通狼与好人的既有规则/资源/流程不变，原工具输入仍为check_identity(target_id)，没有给模型增加任意选择查验类型的参数。不同类型必须由机制明确授权，不能让模型自行请求更多信息。序号和受众不变，seer_checked仍只进入行动者玩家投影；投影的嵌套payload脱离领域事件，只有请求DTO的决策实现不能改写权威结果或票据。观战god replay继续保存事件事实。未加入重复查验禁用、死亡目标查询或咒狐反伤等特殊规则。

共同system提示明确result.kind及旧bool兼容边界，不把false推成good或把伪装标签当真实阵营；板子具体规则仍控制可揭示范围。共同Policy的本人状态可呈现完整最新结果，受限观察DTO保留typed history；其他玩家的输入不包含该结果。isWerewolf仅是历史兼容字段，展示与新机制使用result，不能用旧bool覆盖第三方或具体身份。

## 公开格式、旧档与展示

结果类型由game-catalog的稳定数据契约提供；replay-contract提供只读解码，game-text提供双语结果标签。前端没有导入后端引擎。终端/时间线/逐帧视频使用这些标签，字段机器ID不翻译，玩家原文不改写。具体身份仅显示role名，组合格式显示role与camp。

公开/私人播放器schema仍为2，内部Tape现为2（G04获胜归属升级，旧1明确拒绝）；本查验字段属于payload数据，不独立升级公开envelope。旧档没有result且isWerewolf是真正boolean时，恢复good/wolf标签；存在result时优先完整结果，未知类型/坏结构不能降级为good猜测。终端与浏览器保留并展示原未知result JSON，旧输入文件不修改。decoder只读own data descriptor快照，不执行getter、继承属性或用两次不同读取完成校验/返回；异常Proxy trap按未知处理。不合法bool或完全缺失结果显示未知标记。内部Tape仍严格检查source/lock/规则版本，不能把旧引擎结果按新标签静默复现。

现有SeerState.lastResult及history.result在私有状态API中可选，保留原手工/legacy状态兼容；生产初始化和完成查验都会写入。未来能力类型/资源迁移不得用旧bool替代完整结果。

## 判例与后续

人工判例覆盖三个结果类型、三个阵营、静态/动态伪装、独立真实身份/狼权、独立结果对象、实际Seer阶段、只有actor收到、私有history、终端开关、双语、旧boolean和未知typed结果。原六/十二人工整局仍按字面oracle核对真实目标/camp，新增字段没有改成仅检查自身生成值。完整双语SDK/ACP/混合对局与严格Tape继续回归。

能力来源/资源/调度已见[能力实例](night-abilities.md)，刀口和用药见[女巫结算](witch-resolution.md)，死亡与封盘见[死亡链](death-chain.md)和[胜利结果](victory-outcomes.md)。具体身份查询角色仍按P5–P9交付。
