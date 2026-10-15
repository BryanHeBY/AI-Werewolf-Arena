/**
 * 提供定序王子实际玩家知识与原状态读取的具名公开入口。输入为原角色，输出同一原状态或脱离可写副本。
 * 读取在原观察／校验时点执行；数据不授予pending、付款或重投许可，具体提交／关闭仍归authority。
 * 本入口只重导原get／project绑定，不公开写者、初始化或expected句柄；读取异常按原路径传播。
 */
export { getOrderPrinceState, projectOrderPrinceState } from "./state-slot";
