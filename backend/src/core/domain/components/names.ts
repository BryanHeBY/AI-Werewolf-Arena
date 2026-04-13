/**
 * ECS 组件名称统一常量，避免字符串硬编码导致拼写错误。
 */
export const COMPONENT = {
  Identity: "IdentityComponent",
  Role: "RoleComponent",
  Camp: "CampComponent",
  Alive: "AliveComponent",
  VotingRight: "VotingRightComponent",
  StatusMarks: "StatusMarksComponent",
  Badge: "BadgeComponent",
} as const;

/**
 * ECS 组件名联合类型。
 */
export type ComponentName = (typeof COMPONENT)[keyof typeof COMPONENT];
