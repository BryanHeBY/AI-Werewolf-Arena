/**
 * 负责公开猎魔板子原生 Hunter 枪库存的原捕获命令。输入为原 World、玩家和同一枪槽；
 * 输出为原权威的 current／consume 回执或 null，失败保持原撤权错误和已写前缀。
 * 本入口只直接绑定 authority，不经过请求／印记捕获的重端口，不创建库存、租约或审计镜像。
 * 捕获仍在死亡结算原角色／生命检查后、死因读取前；付款和审计验证唯一归原权威。
 */
export { openDemonHunterStockFrame } from "./authority";
