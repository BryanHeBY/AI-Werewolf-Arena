/**
 * Owns the existing ordered identifiers for the eleven domain component slots.
 * Inputs are the established ECS names; output is the unchanged runtime object
 * and closed ComponentName union consumed by World and the typed component map.
 * This registry never creates components, validates values or writes World state.
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
