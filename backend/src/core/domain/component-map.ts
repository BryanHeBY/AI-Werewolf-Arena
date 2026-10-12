/**
 * Owns the domain-only type relation between component names and stored objects.
 * Input is the existing eleven slot IDs and component interfaces; output types
 * give World callers the original mutable component references without casts.
 * This map never creates storage, copies values, grants authority or serializes
 * runtime handles. Component factories and lifecycle owners retain validation.
 */
import type { COMPONENT, ComponentName } from "./components/names";
import type { IdentityComponent } from "./entities/player";
import type { RoleComponent } from "./components/role";
import type { CampComponent } from "./components/camp";
import type { AliveComponent } from "./components/alive";
import type { VotingRightComponent } from "./components/voting_right";
import type { StatusMarksComponent } from "./components/status_marks";
import type { BadgeComponent } from "./components/badge";
import type { VictoryComponent } from "./components/victory";
import type { LoversComponent } from "./components/lovers";
import type { WallNoteComponent } from "./components/wall_note";
import type { DebatePenaltyComponent } from "./components/debate_penalty";

export interface ComponentMap {
  [COMPONENT.Identity]: IdentityComponent;
  [COMPONENT.Role]: RoleComponent;
  [COMPONENT.Camp]: CampComponent;
  [COMPONENT.Alive]: AliveComponent;
  [COMPONENT.VotingRight]: VotingRightComponent;
  [COMPONENT.StatusMarks]: StatusMarksComponent;
  [COMPONENT.Badge]: BadgeComponent;
  [COMPONENT.Victory]: VictoryComponent;
  [COMPONENT.Lovers]: LoversComponent;
  [COMPONENT.WallNote]: WallNoteComponent;
  [COMPONENT.DebatePenalty]: DebatePenaltyComponent;
}

type ComponentFields = {
  [K in ComponentName]: keyof ComponentMap[K];
}[ComponentName];

/**
 * Keep arbitrary custom fields, while rejecting another slot's exclusive public
 * fields. Role structurally contains Camp; role/privateState cannot occupy Camp.
 * Shared fields such as renderPrompt remain valid. This is type-only, never a
 * runtime shape check or an exact-object policy.
 */
export type ComponentWrite<K extends ComponentName> = K extends ComponentName
  ? ComponentMap[K] & {
      [P in Exclude<ComponentFields, keyof ComponentMap[K]>]?: never;
    }
  : never;
