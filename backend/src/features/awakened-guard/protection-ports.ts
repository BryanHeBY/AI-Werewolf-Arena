/**
 * 负责公开已付全天盾的只读致死预检端口。输入为原World、日次及候选原生命，输出是否由本单位盾阻挡。
 * 时点在真实标死之前；权限仅查询本族已付frame，不提供窗口、资源或Alive写权，真日终后固定失效。
 * 具名重导同一声明，不包装、复制保护或改变读取次序；无本族原窗口时不查询World新字段。
 */
export { shieldForDeath, hasAwakenedGuardFrame, prepareProtectionBlock } from "./authority";
