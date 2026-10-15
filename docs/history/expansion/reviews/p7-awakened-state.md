# P7：觉醒隐狼独立资源状态

范围：[规则卡](../../rules/awa-awakened-hidden-wolf-v1.md#awakened_hidden_wolf)与[实现边界](../awakened-hidden-wolf.md)中的纯状态操作。没有注册Role/Profile、公开export、请求、阶段或配置；角色仍planned，21 verified/43 planned保持。

## 已实现边界

- 六学习结果有独立初态；只记录目标ID与冻结真role，不接收或复制目标库存/历史/人格。
- 学习不猜技能有效日。实际夜末提交函数接收actual activationNight，主动技能从该夜+1起，Hunter同次提交armed。夜末前中断不激活；后夜补提交按真正夜次计算，已完成激活不可重置或补资源。
- Mirror仅保存安装后的abilityId，不在角色学习状态复制报告/uses或第二个闭夜窗口。只有Poison/Guard/Wolf有原生主动窗口；Hunter被动枪与Villager不占该窗口。
- 接刀事实、固定最早可刀夜与技能独立，状态操作不授予真实World/soleWolf权限。额外刀可晚学、留后夜，null/wait关本夜不耗，非空合法状态操作才耗一次；没有mode/expired/机械首刀夜期限。
- 相邻实际夜同非空稳定Guard ID拒绝且不改已付前缀；空守/无工具wait打断连续。毒wait不耗瓶，真实use耗瓶且不补。
- 存储只接受JSON语义事实并深拷贝；projection显式裁剪state/learning/六skill的未知字段。没有组件ref、Map/clock；Mirror资源唯一所有者仍是后续安装的G02实例。

## 验证与独立审查

根受影响Aw状态/伤害、旧Mechanical状态、Mirror实例和G02能力门槛116测试/672断言/5文件通过；backend type/deps/boundaries/i18n扫描通过，57项兼容登记文字不变。没有业务入口导入本模块，因此本笔没有假称实际900流水线、真正Aw对局/Tape或前端呈现已通过；那些仍为完整启用必需门槛。

- A（review_arch_psychic）：独立27测试/190断言，0阻断。后续scope负责真实Role/Camp、原Life/phase、learning/skill元数据与唯一活Wolf终验；Mirror先完成自己的实例安装，再同步提交actual ID/ready，不能转出/撤销后重安装补资源。
- R/T（review_rules_psychic）：最终R0，独立27测试/190断言；耗空不再active、无继承不闭攻击夜、六初态/actual激活/Mirror单ID/连续Guard/wait与once库存均符合卡，无具体遗漏。支持纯数据层提交，真实owner/900/原十二人和呈现验证仍后续；116/672/5受影响范围合理。
- L/D（review_rules_gargoyle）：最终0具体阻断，Deep JSON与六kind裁剪正确、Mirror仅ID无双history/ref；当前未接Role/Profile/DTO/record/presentation，测试明示内部载体而非Aw启用，21/43登记准确。

下一批把原owner作用域和学习/技能/实际900流程接到真实角色；完整原十二人镜隐板、六学习结果、全部权限反例及双语SDK/ACP/MCP/混合/Tape/seed/呈现gate后才verified。黑市商人与P8–P10、64角色/22机制、长局/T6持续。
