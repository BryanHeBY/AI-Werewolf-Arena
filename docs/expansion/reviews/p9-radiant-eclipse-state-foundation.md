# P9d 猎日逐光：状态与借用快照基础

基线 `fbe40aa`，仅实现两个纯模块及维护测试；流光伯爵／蚀日侍女仍 **planned**，正式目录仍 **46/64**。规则契约见[猎日逐光规则卡](../rules/awa-radiant-eclipse-twelve-v1.md)。这是一笔可构建的前置提交，未注册角色、阶段、CLI 板子或新能力种类。

## 本切片边界

- `radiant_eclipse/state.ts`：第二夜起的庇护／吞噬选择，按真实夜序判断连续、明确 pass 与隔夜空档、同夜重复拒绝、精确五种好人目标角色；村民吞噬记录不产生假 ability。庇护状态只持有所需的上一目标／日期，吞噬历史用稳定当夜 copy ID。
- `borrowed_state.ts`：从 own data 字段构造 Seer／Potion／Dream／Shelter 当前状态白名单。查验重置旧结果和历史；药精确保留四种 0/1 库存、独立消费；梦只带必要上一目标／实际日期与明确保护政策，历史为空；庇护复制原主的连续限制。没有读取整个原主 state 后再删除历史，没有携带 uses／lastUsedDay／临时封禁字段。
- 选择函数接受调用方已经授权的合法目标集合，**不负责生命、阶段和原实例授权**。后续 Frame 必须落实这些校验、当夜临时封禁、借用授权关闭、独立有效伤害和严格账本，不能以纯函数通过替代运行闭环。

## 审查修正

A、T 独立用真实 `DREAMER_ROLE_PROFILE.init` 发现：默认 AWA 梦保护在原生 state 中省略 policy，初版白名单把这个缺省升级成 NetEase 强保护。现要求 Dream 原状态明确为 `netease_2026_night_immunity_v1`，默认／其它政策拒绝。Witch 的既有必填 selfHealRule 同样要求明确 Disabled；合法的可省刀口／用药政策仍按既有默认处理。原 A／T 反例输入未修改，分别 **4/17**、**4/24** 通过，红／绿日志均保留于 `/tmp/awa-radiant-state-a-review-*.log`、`/tmp/awa-radiant-borrowed-state-delivery-review-*.log`。

R 复验原伯爵 N2 护 4、侍女 N3 借护 5、原伯爵 N4 护 5 合法；连续限制按当前能力保留／继承的记录，不按全局上一夜目标。原主记录不写回。R 最终维护 **8 项／48 次断言**通过。三路审查在本切片范围没有剩余可复现 P1／P2；不扩大为角色交付。

## 实际门禁与接续

新增维护 **8 项**，包含真实 Dream／Witch 初始化、四库存、历史与生命周期 getter 零读取、代理／访问器拒绝、原主资源不写回以及卡 16。相关 Dream／NightAbility 回归合计 **61 pass／0 fail、669 次断言、3 文件**，日志 `/tmp/awa-radiant-eclipse-foundation-compat-final-fixed.log`。初次批量改测试时误把 Dream policy 放入 Count 期望，60/1 的日志保留；移除错误期望后原规则未变，完整三文件重新通过。

backend source／tests 类型检查、root lint、目标文件格式与 diff 检查通过。该纯基础没有运行行为或前端变更，不重跑上一板的完整 5559／666／274 门禁，也不把它冒称已执行猎日逐光真实对局。下一笔直接接原生能力与租约，随后夜伤／梦链、DTO／双语、独立 Tape、公开配置、实际 SDK／ACP／MCP、固定种子及帧／浏览器；空借药零请求仍须在真实阶段另验。
