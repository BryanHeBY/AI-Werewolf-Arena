/**
 * 提供秘密之身放逐翻牌与必需发言的具名公开交接端口，直接绑定同族唯一实现和输入类型。
 * 输入为原运行查询及映射目标；输出原请求／处理结果，端口不复制库存、scope或结算代码。
 * 此入口只加载该交接所需的原闭包，不装配其它夜间生命周期；付款、复验、失败与关闭仍归实现。
 */
export { revealSecretBodyExile } from "./exile-reveal";
export type { SecretBodyExileRevealQueries } from "./exile-reveal";
