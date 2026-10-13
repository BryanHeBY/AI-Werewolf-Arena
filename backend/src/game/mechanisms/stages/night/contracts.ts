/**
 * Owns the contract data for night state and execution ports shared by the pipeline and handlers.
 * Inputs are captured phase operations, effects and bound actor queries; outputs
 * are typed handler contributions and night state references. Actor qualification
 * has a narrow query port; this contract never queries World or commits a resource.
 */
import { StatusMarksComponent } from "../../../../core/domain/components/status_marks";
import {
  ActionProvider,
  ActionRequest,
  ActionRequestExtras,
  ActionStage,
  EntityId,
  GameEvent,
  ExileFeedback,
  NightSummary,
  Role,
} from "../../../../core/domain/model";
import { World } from "../../../../core/domain/world";
import { ToolGateway } from "../../../gateway/tool_gateway";
import type { RoleCatalog } from "../../roles/catalog";
import type { DreamNightLink } from "../../roles/dreamer/night_frame";
import type { NightAbilityActorQuery } from "../../roles/night-ability-actors";
import type { AliveComponent } from "../../../../core/domain/components/alive";
import type { NativeNightFailurePolicy } from "../../../../rulesets/native-night-failure-policy";
import type { NativeNightTargetPolicy } from "../../../../rulesets/native-night-target-policy";
import type { NativeNightEffects } from "../../../../rulesets/native-night-effects";

import type {
  NightPoisonClaim,
  NightInspectionAttack,
  NightFoxInspectionClaim,
  NightMechanicalEffect,
  NightGuardClaim,
  NightMerchantBacklash,
  NightBlackMarketBacklash,
  NightAwakenedEffect,
} from "../../../../core/domain/night_effects";

export interface WolfKnifeTargetScope {
  targetId: EntityId;
  life: AliveComponent;
  version: number;
  marks: StatusMarksComponent;
}

/** 夜间阶段共享状态。 */
export interface NightStageState {
  modifierDeaths?: import("../../../../core/domain/night_effects").NightLifeScope[];
  modifierKnifeTargets?: EntityId[];
  modifierBonusEffects?: Array<{
    kind: import("../../roles/scholar_mentor/night_frame").ModifierBonusKind;
    receipt: import("../../roles/scholar_mentor/night_frame").ModifierBonusReceipt;
    marks?: ReturnType<NightStageContext["ensureMarks"]>;
  }>;
  wolfChatOrder: EntityId[];
  endedWolves: Set<EntityId>;
  wolfVotes: Record<number, number>;
  wolfTarget: EntityId | null;
  wolfTargetScope?: WolfKnifeTargetScope;
  /** Actual voters contributing to the selected ordinary knife, independent of target tally keys. */
  wolfTargetVoters?: EntityId[];
  seerChecks: NightSummary["seerChecks"];
  dreamLinks: DreamNightLink[];
  poisonClaims?: NightPoisonClaim[];
  inspectionAttacks?: NightInspectionAttack[];
  retaliationAttacks?: import("../../../../core/domain/night_effects").NightRetaliationAttack[];
  nightImmunities?: import("../../../../core/domain/night_effects").NightImmunityClaim[];
  evilKnightBindings?: Map<
    EntityId,
    NonNullable<ReturnType<typeof import("../../roles/evil_knight/state").captureEvilKnight>>
  >;
  foxInspections?: NightFoxInspectionClaim[];
  guardClaims?: NightGuardClaim[];
  merchantBacklashes?: NightMerchantBacklash[];
  blackMarketBacklashes?: NightBlackMarketBacklash[];
  mechanicalEffects?: {
    shields: NightMechanicalEffect[];
    attacks: NightMechanicalEffect[];
    failures: NightMechanicalEffect[];
  };
  awakenedEffects?: { shields: NightAwakenedEffect[]; attacks: NightAwakenedEffect[] };
}

/** 夜间阶段执行上下文。 */
export interface NightStageContext {
  isCurrent(): boolean;
  readonly previousExile: Readonly<ExileFeedback> | null;
  world: World;
  roleCatalog: RoleCatalog;
  readonly nightActors: NightAbilityActorQuery;
  readonly nativeNightFailure: NativeNightFailurePolicy;
  readonly nativeNightTargets: NativeNightTargetPolicy;
  readonly nativeNightEffects: NativeNightEffects;
  toolGateway: ToolGateway;
  events: GameEvent[];
  actionProvider: ActionProvider;
  currentDay(): number;
  makeRequest(
    actorId: EntityId,
    allowedTools: ActionRequest["allowedTools"],
    context: ActionRequestExtras & { stage: ActionStage; requiresAction?: boolean },
  ): ActionRequest;
  getAliveByRole(role: Role): EntityId[];
  ensureMarks(entityId: EntityId): StatusMarksComponent;
  pickMajorityTarget(votes: Record<number, number>): EntityId | null;
  /** Finite mist-board fallback after all voters explicitly passed; named reproducible stream. */
  pickMistKnife?(ids: readonly EntityId[]): EntityId | null;
  shuffleWolves(ids: EntityId[]): EntityId[];
  state: NightStageState;
}

/** 夜间阶段处理器定义。 */
export interface NightStageHandler {
  id: string;
  priority: number;
  execute(ctx: NightStageContext): Promise<void>;
}
