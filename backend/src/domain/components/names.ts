export const COMPONENT = {
  Identity: "IdentityComponent",
  Role: "RoleComponent",
  Camp: "CampComponent",
  Alive: "AliveComponent",
  VotingRight: "VotingRightComponent",
  StatusMarks: "StatusMarksComponent",
  Badge: "BadgeComponent",
} as const;

export type ComponentName = (typeof COMPONENT)[keyof typeof COMPONENT];
