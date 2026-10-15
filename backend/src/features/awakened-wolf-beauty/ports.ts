/**
 * 负责向具名死亡准备组合导出觉醒替死付款与原目标末核。输入为真实提案／原体和内存receipt，
 * 输出一次替换或失效；时点在实际标死之前，不提供revive、任意Alive写权或库存镜像。
 * 失败传播原异常，已付机会不退款；证据读器不等于目标仍可标死的权限查询。
 */
export {
  payAwakenedBeautyReplacement,
  readPaidBeautyReplacement,
  beautyReplacementTargetCurrent,
  type PaidBeautyReplacement,
  hasAwakenedBeautyFrame,
} from "./authority";
