/**
 * 提供黑市商人的只读原生资源与已获知识出口。原状态 getter 保留能力库存引用，玩家投影只
 * 暴露原可见交易信息；展示在原调用点消费它们，不安装、补发或转移赠予资源。接受、
 * 付款、反噬及失败后的已付费前缀仍由黑市机制所有者负责，出口不渲染或授予行动权限。
 */

export { projectBlackMarketState } from "./state";

export { getBlackMarketState } from "./state";
