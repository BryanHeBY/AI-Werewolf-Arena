/**
 * 公开身份查验原本夜提交记账与石像鬼完成查询，分别供纯白之女阶段和石像鬼刀权继承消费。
 * 输入为原 World、夜号、当前性回调或角色引用；输出保留原记账写入及完成查询的布尔结果，不创建新回执。
 * 完成查询仍晚核原角色、实例、来源、payload 与生命；它只是原刀权判断的一项，不能单独授予刀或查验许可。
 * 直接绑定唯一 night_scope owner，不加载阶段／规则聚合、不重建账本；原回调、错误与已写前缀保持。
 */
export { completedGargoyleInspection, recordRoleInspectionNightCommit } from "./night-scope";
