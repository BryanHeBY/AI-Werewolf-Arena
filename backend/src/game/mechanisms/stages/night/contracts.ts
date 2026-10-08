/** 文件说明：夜间阶段处理器契约。 */
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

/** 夜间阶段共享状态。 */
export interface NightStageState {
  wolfChatOrder: EntityId[];
  endedWolves: Set<EntityId>;
  wolfVotes: Record<number, number>;
  wolfTarget: EntityId | null;
  seerChecks: NightSummary["seerChecks"];
  dreamLinks: DreamNightLink[];
}

/** 夜间阶段执行上下文。 */
export interface NightStageContext {
  isCurrent(): boolean;
  readonly previousExile: Readonly<ExileFeedback> | null;
  world: World;
  roleCatalog: RoleCatalog;
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
  shuffleWolves(ids: EntityId[]): EntityId[];
  state: NightStageState;
}

/** 夜间阶段处理器定义。 */
export interface NightStageHandler {
  id: string;
  priority: number;
  execute(ctx: NightStageContext): Promise<void>;
}
