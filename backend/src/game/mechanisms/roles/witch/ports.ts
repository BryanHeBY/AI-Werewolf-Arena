/**
 * 提供女巫普通药剂状态命令的公开入口。输入是原规则检查之后选定的只读状态或能力引用；
 * 输出按原顺序写入夜间标记、药剂库存和回合关闭状态。行动权限与效果提交仍由调用方负责，
 * 失败不会回滚已写标记或已消费资源。独立审计账本和封印的猎魔人原生库存不使用这些命令。
 * 初始化具名绑定保留原输入复制契约，调用方模板不因此获得新的活跃库存写权限。
 */
export {
  getWitchState,
  resetWitchNightState,
  refreshWitchSelfHeal,
  closeWitchPotionTurn,
  consumeWitchHeal,
  consumeWitchPoison,
  consumeRecipientPoison,
} from "./state-slot";

export { setWitchState } from "./state-slot";

export { WITCH_STATE_SLOT } from "./state-slot";
