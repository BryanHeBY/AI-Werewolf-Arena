# P7：觉醒隐狼实现与资源边界

以[规则卡](rules/awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf)为准；角色已完成并登记 `verified`，见[完整验收](reviews/p7-awakened-hidden-wolf.md)。本笔包含原12人镜隐迷踪组合；先前Mirror单角色交付不作为原联合板证明。

## 状态与能力所有权

| 事实                                    | 唯一所有者                              | 公开范围                                     |
| --------------------------------------- | --------------------------------------- | -------------------------------------------- |
| 真Aw/Wolf/Victory与玩家身份             | RoleProfile、Role/Victory/Identity组件  | 本人；God完整底牌，普通查验只按授权label     |
| 模仿机会、本夜关闭、已学对象/真实role   | Aw typed private state                  | 仅本人及God，不给目标/小狼                   |
| actual activationNight与activeFromNight | Aw learned元数据                        | 本人；夜末900真实提交，不猜学习日+1          |
| Mirror报告/uses/closed/disabled         | 一个Aw原生role_check实例，mirror policy | 既有同实例私人投影；Aw元数据只保存ability ID |
| Poison/Guard/Hunter/Wolf复制库存及关闭  | Aw typed skill union                    | 只本人，明确空技能Villager，无机械mode       |
| 唯一活Wolf继承/固定首个可刀时点         | 装配/DeathResolution更新的Aw事实        | 本人，不补狼队知识；查询只读                 |
| 原life、提交owner与本夜效果提案         | per-World运行作用域/typed Damage输入    | 不落DTO/Tape对象ref；God可保结果因果         |
| 真实死亡、枪/徽/遗言与最后judge         | Damage/DeathResolution/PhaseManager     | 原职责不移到角色阶段                         |

声明独立的Aw状态与步骤，复用现有原life/时间约束/role_check/枪许可组合。不能把MechanicalState改role名字继续携带mode、反毒、穿盾刀、连续守护判离或全部nextNight语义，也不建通用复制/Agent基类。

## 需要具名实现的步骤

1. 580模仿：另一alive/self中立候选，一局一次任意夜、合法wait关本夜不耗；合法选择才冻结真role并立即更新具体role标签，六学习结果资源独立。目标没有库存或能力已经转出，也不能用源实例缺失拒绝真role学习。
2. 900夜末激活：沿现NightPipeline最后角色行动之后、Damage之前真实提交。Hunter此点armed；其它主动技能startsOnDay=actualActivationNight+1。900前中断后补激活也照真正时间，不把原mimicDay当完成事实。
3. Mirror实例：在Aw owner安装native mirror的新原生实例，空历史/资源独立并按下一夜有效；不要求原目标还拥有某个G02源ID。不能双存历史；转出/撤销/复活/reapply不补资源，沿已有RoleInspection原ID/source/policy终验。
4. Poison/Guard与额外刀：按本卡生成独立请求、消费/关闭及typed原life提案；基础刀仍经狼权限查询与kill_vote。guard禁相邻日次同非空ID，非法不耗/关夜；empty/skip打断。额外刀一次库存可留后夜，不取机械first-night-expiry逻辑。
5. 新刀毒盾：独立Damage字段，正常额外刀不穿Guard/Heal/Dream/复制盾；Aw盾优先吸收原始毒，其余毒才参与机械反射，反射毒可被Aw施者盾挡。双盾/多源/保护施者专项预期明确，非公开白名单只作受控机制判例。
6. 已付效果：复验原owner/learning/skill/phase/目标body，不能用闭夜/已耗库存撤合法效果。复制守护施者第一次真死保前缀；body替换/复活/role/private owner/learning/skill撤换取消未结旧提案。额外刀与毒的原目标life不杀新生body；普通已付毒不因caster死撤。
7. Hunter枪：复用resolveDeathShots/pendingShots和目标原生命直到实际追加死亡。nightend已armed才授权首夜刀死/Day1枪；forbidden compound沿卡，不按‘Night2’推断。中立玩家枪协议及档stage必须覆盖原生Hunter，God内部枪来源可不同。

## 玩家事件与记录

公开玩家枪只确认actorId/targetId，NativeHunter与Aw复制Hunter同 `player_shot` 字段、同公开档stage `death_shot`；原生自己的请求阶段可为hunter_shot，接收者本人已经知道身份。God `replay.json` 明示完整裁判视角，不能拿它的原hunter_shot或底牌声称玩家不可识别；玩家visible_events及player event档不得带原type/stage。

复制和继承事实只给本人，目标没有通知，小狼无授权历史；新state/报告/source/事件按声明字段白名单。结构化record保存actual夜末/语义资源、原真实底牌与中英机器ID，不把组件引用/Map/clock写入JSON。无scope所有权或source ID的异常不能由late response改新owner。所有已提交前缀可严格重放。

## 分笔与审查

- **规则冻结文档**：来源＋AWA差异、夜末/资源/保护/中立枪受众、原板/有限组合与完整gate，R/T核来源和独立判例，A核资源/时间/引用与typed proposal，L/D核i18n/记录/视角/原板承诺。冻结笔当时21 verified/43 planned；完整启用后22 verified/42 planned。
- **必要底座功能fix/feat**：中立玩家枪与记录stage、正常可挡额外刀/吸收毒盾、真实夜末激活时点等，按独立职责拆可运行提交；真实旧角色通路与Tape及中英/前端视角门槛。不能在这些笔启用半角色。
- **完整Aw启用**：一份原生角色/资源装配＋六类学习、实际刀/技能/枪，6人AWA与原12镜隐板；八种以上独立字面SDK/ACP/MCP/混合两语完整局、每板至少20受限seed和所有技能/继承/skip正分支、严格Tape、静态/前端/实际browser/双语PNG；独立交叉审查、修正复查后才verified。
- **P7结束**：黑市商人随后完成，再全已支持release与阶段矩阵。不是拿本角色或原板通过代替P8–P10、64角色/22机制组合、长局与外部模型T6。

初批时序、同时伤亡、枪之后末Wolf死亡/小狼复活、模仿前后/中断补激活、库存不继承、模板缺G02能力、原body变更/双盾、多源毒与中立协议无旁路都须有手写预期，不能由执行结果或全知机器人算‘正确答案’。
