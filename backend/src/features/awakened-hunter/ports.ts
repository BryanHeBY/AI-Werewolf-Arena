/**
 * 负责向具名死亡准备组合提供已付巡猎的窄读端口。输入为原World／日次和不透明提案，
 * 输出原体范围及根来源，JSON或副本无权恢复提案；读取时点在标死之前，失效返回null／false。
 * 此端口不创建许可、不扣库存、不标死；失败与请求关闭由原owner保留，Night属性不依显示Day推断。
 */
export {
  paidAwakenedPatrol,
  nightPatrolSuppressesBeauty,
  type PaidPatrolProposal,
  type PatrolQualification,
} from "./authority";
