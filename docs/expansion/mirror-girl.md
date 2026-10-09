# P7：魔镜少女实现边界

规则以[冻结卡](rules/awa-mirror-girl-v1.md#mirror_girl)为准。角色实现与[功能验收](reviews/p7-mirror-girl.md)分别记录当前有限组合；觉醒隐狼的原镜隐迷踪联合板仍需其后续独立交付。

## 继续使用的职责

| 事实                   | 唯一负责人                                    | 边界                                                                                |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| 身份/Good神职/胜利成员 | RoleProfile与既有Role/Victory组件             | 能力变化不改实体身份、Agent/人格或胜利归属                                          |
| 禁重复的个人报告与库存 | 绑定的role_check能力实例                      | 明确mirror policy，完整history按稳定ID，不按其它实例/玩家聚合                       |
| 本夜资格与消费         | shared RoleInspection执行器                   | native、gift/copy、transfer按当前绑定实例规则；original ID/state/life与最终历史复验 |
| Garg原生查后刀         | 专属Completion作用域                          | 支付后的原native ID/owner仍有效才能授权；Mirror/Psychic不得代替                     |
| 玩家提示/DTO与目标提示 | 既有PlayerPromptPolicy/TargetHint/Baseline    | 依据绑定policy，不拿actor真实底牌猜能力；本人仅报告/自己的资源                      |
| 事件/录制/播放         | actor-only投影、God replay与共享reader/labels | no字段改名或新视角，机器role/stage/key不本地化；画面由frame决定                     |

无需增加统一Agent、事件总线或角色生命周期框架。扩现有policy闭合联合即可：旧缺省/gargoyle、psychic、mirror；旧未知policy拒绝行为保持。

## 时序与规则映射

原生Mirror独立600阶段；Garg180、Psychic600保持各自规则与stage ID。registry在配置贡献/实例grant的role_check出现时预收所有实际已交付policy处理器并去重，按显式priority及稳定ID排序。每个处理器只接收自身policy实例；没有Mirror实体也能运行明确授予的Mirror实例，future源码不得仅按角色数量判断存在能力。

合法skip/无目标关闭本夜不花uses，持续非法三次明确失败；optional分支不得只识别Psychic。禁重复只对gargoyle/mirror，psychic唯一可跨夜repeat。Prompt/Baseline的现有二分映射改为显式三项，并分别给每种绑定实例完整规则提示；ObservedBot需真实查验和conservative合法skip两分支。

role/state/ID/policy/来源/生命与时钟在await、gateway与应用点复验。原来源分类、owner与copy/transfer源能力ID不能在等待中变更而伪造原生权限或裁掉gift abilityId。gateway或查验标签回调之后的同引用历史新增也必须重新排除旧目标；保存已存在前缀，只花本次实际合法消费。Garg的已付Completion不能依赖activeNightAbility（成功后已闭夜），须独立检查原stable actor/native身份/ID/owner与生命，不能在标used之后错误撤其合法刀权。

## 转移与双语接入

原生与本卡授权的新gift/copy：mirror、空history、lastTarget/lastDay/lastUsedDay null、uses0、disabled:false，生效/期限/次数由具体来源卡另冻。transfer完整保policy/history/闭夜/库存，不重发旧报告。实例跟随复活仍保原历史。其它公开角色的来源白名单与该卡共同验证，低层G02例子不称真实联合板。

本人知道报告，不得到真camp、对象能力或无权历史。Garg/Psychic/Mirror同时持有时的规则提示与schema、SDK/ACP/MCP回执、DTO和事件由同一实例数据驱动。复盘God合法保完整事件；普通公开事件和其它玩家档不得接收本人查验。中英工具/规则/错误/角色标签/skip及历史展示均须完整。

能力DTO元数据、role-check状态/history/result，以及来源/ability_changed玩家事件均为显式字段白名单；disclosed source只授已声明的kind字段，不自动授未来内部字段，God原对象仍完整保留。fresh Mirror赠予/复制强制四state key和真正空数组（非length仿对象或带附加字段数组）；transfer的合法非空完整历史保留。native reapply只认真正原生，不借唯一gift冒原生，retired原生不会被补发。

## 当前示例

- [六人板](../../configs.example/boards/six_player_mirror_girl.json)与[对局](../../configs.example/games/six_player_mirror_girl.json)：两普通狼、Mirror/Witch、两民，屠边、无警长。
- [十二人板](../../configs.example/boards/twelve_player_mirror_girl.json)与[对局](../../configs.example/games/twelve_player_mirror_girl.json)：四普通狼、Mirror/Witch/Hunter/Guard、四民，屠边、警长。

`roles.mirror_girl`接受有限`inspectionPolicy`，默认`awa_unique_optional_v1`，另有`awa_unique_required_v1`/`awa_repeat_optional_v1`；[策略契约](contracts/role-policy-configuration.md)记录AWA配置与原生身份policy的边界；游戏locale支持zh-CN/en，沿原agent/名字/人格绑定，不覆写用户配置。查验不造成死亡；没有未查存活目标的skip label明确表示“没有可查验的存活目标”，不误称场上无活人。

## 实施与提交

1. 规则冻结历史笔 `889bfc6` 经R/A/L/D独立审查；当时Mirror不可选择、目录20 verified/44 planned。当前完整功能与21/43状态见[验收](reviews/p7-mirror-girl.md)。
2. 已有RoleInspection作用域缺口的独立fix：原ID与最终历史；Garg付费Completion原ID/native/private owner。反例先复现，旧Garg/Psychic真实局/seed/Tape回归；此笔不注册Mirror。
3. 完整Mirror启用：policy、profile/阶段、规则/目标/Baseline/观察机器人、所有权/转移、两语、有限6/12配置、核心与跨角色/多policy判例、字面完整SDK/ACP/混合两语局与严格Tape、每板20seed正分支、unit/type/build/actual browser与PNG，独立审查闭环后标verified并提交。
4. 觉醒隐狼后续启用笔交付原镜隐迷踪板的真实组合，冻结其当夜role伪装、夜末能力和复制资源，另做联合矩阵。不能提前用机械狼替代或把4普通狼的AWA样例称完整原板。

支持范围、R/A/T/L/D分工和最终门槛见[规则卡](rules/awa-mirror-girl-v1.md)与[delivery](delivery.md)。P7余觉醒隐狼/黑市商人、P8–P10、64/22、长局与T6目标持续。
