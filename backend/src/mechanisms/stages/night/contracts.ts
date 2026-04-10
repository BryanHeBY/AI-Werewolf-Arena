import { StatusMarksComponent } from "../../../domain/components/status_marks";
import {
  ActionProvider,
  ActionRequest,
  EntityId,
  NightSummary,
  Role,
} from "../../../domain/model";
import { World } from "../../../domain/world";
import { ToolGateway } from "../../../gateway/tool_gateway";

export interface NightStageState {
  wolfIds: EntityId[];
  endedWolves: Set<EntityId>;
  wolfVotes: Record<number, number>;
  wolfTarget: EntityId | null;
  seerChecks: NightSummary["seerChecks"];
}

export interface NightStageContext {
  world: World;
  toolGateway: ToolGateway;
  events: Array<{ timestamp: number; type: string; payload: Record<string, unknown> }>;
  actionProvider: ActionProvider;
  currentDay(): number;
  makeRequest(
    actorId: EntityId,
    allowedTools: ActionRequest["allowedTools"],
    context: ActionRequest["context"],
  ): ActionRequest;
  getAliveByRole(role: Role): EntityId[];
  ensureMarks(entityId: EntityId): StatusMarksComponent;
  pickMajorityTarget(votes: Record<number, number>): EntityId | null;
  shuffleWolves(ids: EntityId[]): EntityId[];
  state: NightStageState;
}

export interface NightStageHandler {
  id: string;
  priority: number;
  execute(ctx: NightStageContext): Promise<void>;
}
