/**
 * 向普通预言家与受赠查验阶段公开原目标身份捕获和咒狐延迟查验提案写命令。
 * 输入为原 World、目标生命、运行状态与来源当前性回调；输出保留原身份闭包、提案追加及本夜提交记账。
 * 回调仍在原效果查询时才求值；提案不立即标死、付款或把查验知识变成死亡许可，资源与请求准入仍归调用方。
 * 直接绑定唯一 inspection_effect owner，不聚合胜利规则、重建状态或提前执行捕获，错误保原写入前缀。
 */
export { captureInspectionIdentity, commitFoxInspection } from "./inspection_effect";
