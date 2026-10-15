# P7：觉醒隐狼刀毒盾伤害底座

落实[规则卡](../../rules/awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf)中的独立伤害语义。Aw仍planned，目录21 verified/43 planned；本笔没有注册角色、学习/库存、900激活或公开配置。

## 职责与实际行为

NightAwakenedEffects仅传递授权的shield/attack原目标life与只读isCurrent，NightPipeline创建空数组并透传。资源/paid原owner复验由后续Aw角色scope拥有；Damage不创建或恢复库存、不判断本夜工具窗口，也不移动真实死亡/最后judge职责。

普通额外刀按Guard/Heal恰有一种有效保护、Dream和独立Aw/机械盾判定；两种普通保护抵消时仍可被刀杀，Aw盾独立保留。基础刀与额外刀可不同目标，合并死亡但保不同死因。新`awakened_hidden_knife`沿普通刀的首夜遗言与严格全部来源枪许可，禁止复合原因仍禁枪。

Aw盾先吸收每个原始毒源，双盾同目标时不进入机械反射。其它原毒照原流程反射；返到有Aw盾的施者则吸收，仍可保存God“形成反射”的因果事实，不把因果当成死亡且不递归。旧未托管PoisonMark也被盾挡。施者死亡不撤普通已付毒，旧目标life不杀/护替换或复活body；取消提案不消掉独立普通刀毒。

Aw盾也挡机械额外刀，但不挡梦、商人反噬或机械连守自罚。没有将保护组件注入枪/白爆/魅惑流程，因此未给这些流程新的豁免。

## 手写判例与门槛

独立字面保护矩阵覆盖普通刀与额外刀同/异目标、Guard/Heal四组合、Dream/Aw/机械盾；双盾多毒、保护施毒者、其它目标反射、自己下毒、互毒、旧未托管毒、取消/target替换和同对象死活version、其它致死来源及forbidden compound。实际Damage仍只返回提案，Alive不改，Marks清理沿原行为。另有受控NightPipeline透传/summary不含scope引用判例；它不是新Aw完整对局。

根受影响engine731测试/9468断言/48文件全通过；随后新增一个受控pipeline测试，Aw＋旧Mechanical窄门槛48测试/107断言/2文件通过。最终production源码在两次门槛间保持，backend type/deps/boundaries/i18n57登记例外均通过。

旧机械reflection/extra/twelve×SDK/ACP/MCP/混合×zh-CN/en：9测试、每项2语共18实际本机完整局、4260断言、0失败；每局严格Tape、字面库存/死因/终局、玩家受众及ACP/MCP清理。为伤害相关旧通路验收，不冒新Aw角色对局或外部模型T6。

前端/文本/复盘输出格式没有新增呈现字段，未重复前笔已通过的browser/PNG；新cause使用已有DeathCause枚举录制校验，运行组件ref、Map、clock不进事件或summary。完整Aw启用仍须原十二人镜隐联合板、全部技能/owner/夜末与双语实际呈现门槛。

- A（review_arch_psychic）：设计六项边界全部落地，正式0残留；独立60测试/190断言/3文件覆盖Aw、旧Mechanical和poison life，支持独立底座提交。
- R/T（review_rules_psychic）：最终R0，独立Aw专项31测试/75断言含受控NightPipeline通过；逐源原毒/返毒因果、普通守救互消/独立盾、原target body和枪复合源符合卡。现有18旧局/Tape及engine/窄门槛足够，支持提交，不扩大无关测试；角色owner/库存/900仍下一笔。
- L/D（review_rules_gargoyle）：最终0具体阻断，可提交；life/owner引用只在夜间输入、不进event/summary/record，新cause沿现有z.enum(DeathCause)扩值；God反射只含标量、不授玩家。前端文案未变无需重复browser/PNG，Aw仍planned与21/43登记准确。

后续实际900激活与完整Aw唯一资源所有权另笔实现；黑市商人、P8–P10、64/22矩阵、长局/T6仍继续。
