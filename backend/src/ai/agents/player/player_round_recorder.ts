import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, EntityId } from "../../../core/domain"
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../core/domain/action_request_context";
import { World } from "../../../core/domain/world";
import { getSessionRecorder } from "../../../recording/recording_context";
import { BuiltPlayerPrompt, PlayerRoundOutcome } from "./contracts";

/** Adapter that projects one completed agent turn into the replay protocol. */
export class PlayerRoundRecorder {
  private readonly roundCounters = new Map<EntityId, number>();

  constructor(
    private readonly world: World,
  ) {}

  record(
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    outcome: PlayerRoundOutcome,
  ): void {
    const recorder = getSessionRecorder();
    if (!recorder) return;
    const role = this.world.getComponent<RoleComponent>(request.actorId, COMPONENT.Role);
    const round = (this.roundCounters.get(request.actorId) ?? 0) + 1;
    this.roundCounters.set(request.actorId, round);
    const day = getActionRequestDay(request);
    const phase = String(request.phase);
    const stage = getActionRequestStage(request);
    recorder.recordPlayerRound({
      playerId: request.actorId,
      role: role?.role ?? "unknown",
      camp: role?.camp ?? "unknown",
      day,
      phase,
      stage,
      requestId: `${day}-${phase}-${request.actorId}-${round}`,
      timestampMs: Date.now(),
      llmRequestMessages: [{ role: "user", content: prompt.userPrompt }],
      promptSystem: prompt.systemPrompt,
      ...(round === 1
        ? {
            initialPromptSystem: prompt.systemPrompt,
            initialBoardInfo: prompt.boardInfoPrompt,
          }
        : {}),
      promptUserDelta: prompt.auditMetadata ?? [
        `context_window=${prompt.contextWindowStart}-${prompt.contextWindowEnd}/${prompt.contextWindowTotal};event_cursor=${prompt.eventCursorBefore}->${prompt.eventCursorAfter}`,
      ],
      retryTrace: outcome.retryTrace,
      thinkingText: outcome.thinkingText,
      actionMode: outcome.actionMode,
      toolCalls: outcome.toolCalls,
      finalAction: outcome.finalAction ?? null,
      fallback: outcome.fallback,
    });
  }
}
