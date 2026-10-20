/**
 * 负责维护 World 与组件类型表消费的十一种有序 ECS 槽名。输入为现有机器名称，输出原运行对象及 ComponentName 联合。
 * 这里只定义槽名，不构造组件、验证槽值或写入 World；as const 限制类型写法，并未冻结运行对象。
 */
export const COMPONENT = {
  Identity: "IdentityComponent",
  Role: "RoleComponent",
  Camp: "CampComponent",
  Alive: "AliveComponent",
  VotingRight: "VotingRightComponent",
  StatusMarks: "StatusMarksComponent",
  Badge: "BadgeComponent",
  Victory: "VictoryComponent",
  Lovers: "LoversComponent",
  WallNote: "WallNoteComponent",
  DebatePenalty: "DebatePenaltyComponent",
} as const;

/**
 * ECS 组件名联合类型。
 */
export type ComponentName = (typeof COMPONENT)[keyof typeof COMPONENT];
