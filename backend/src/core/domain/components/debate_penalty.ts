/**
 * 负责公开杠精辩论禁票处罚的数据结构；输入为处罚日次、来源编号和捕获的生命版本，
 * 输出为保留原可写字段的组件接口，不创建或安装运行对象。
 * 实际 record 引用与原 NightLifeScope 另由辩论 authority 保存并查询；这些数字不能重建其许可。
 * 接口字段保持可写，不冻结、安装、撤销或执行处罚；缺省日次和生命复验沿原运行查询。
 */
export interface DebatePenaltyComponent {
  /** 处罚所属日次；运行查询的 day 缺省接受面由 authority 决定，不在字段定义中统一到期。 */
  day: number;
  /** 原处罚来源的实体编号；不是请求 token，也不独立证明该来源当前存活或有权提交。 */
  sourceId: number;
  /** 记录捕获时的生命版本；真实当前性还依赖 authority 保存的原生命对象与组件引用。 */
  lifeVersion: number;
}
