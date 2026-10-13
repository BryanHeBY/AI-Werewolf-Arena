/**
 * 提供奇迹商人的原生库存与已获交易知识出口。展示按原顺序读取 getter 和玩家投影，
 * 不把赠予技能的库存并入商人原生文案。交易接受、资源转移、反噬与关闭仍归具体
 * 所有者，本出口保留原函数绑定，不补充库存、授予租约或执行归档。
 */

export { projectMerchantState } from "./state";

export { getMerchantState } from "./state";
