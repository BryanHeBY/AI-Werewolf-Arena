/**
 * 提供猎魔人与夜之贵族／秘密之身协作的原阵容复验、权威快照和清除契约的公共绑定。
 * 输入为原 World、日次、目标与关闭回执；输出保持原检查、快照或必需记录载荷，完整实现仍归 authority／facts。
 * clear 只提交原契约终态，必需录制随后由调用方在原时点调用；记录失败保已写前缀，不退款或重做猎魔付款。
 * 本入口只加载原两个 owner，不装配 NightUnit、请求或其它阶段；快照及查询不授予原体、库存或猎魔许可。
 */
export {
  assertNobleBodyRosterCurrent,
  checkpointNobleBodyAuthority,
  clearServantFromHunt,
  isNobleBodyBoard,
} from "./authority";

/** 同一已关闭契约回执仍由 facts 重验后必需录制；不在出口提前取快照、日次或录制器。 */
export { recordNobleContractClosure } from "./facts";
