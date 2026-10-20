/**
 * 负责向魔术师公开原无序交换对的完整匹配查询，直接绑定 exile_mapping 的唯一函数。
 * 输入保原两对号码或 null，输出为原匹配布尔值；先规范化 a 再规范化 b，校验异常原样传播。
 * 本入口不打开夜窗口、创建状态或读取原体；匹配不取消效果、退还已用号码或授予放逐权限。
 */
export { matchingExchangePairs } from "./exile-mapping";
