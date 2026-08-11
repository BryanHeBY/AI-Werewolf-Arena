import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, EntityId } from "../../../core/domain/model";
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../core/domain/action_request_context";
import { World } from "../../../core/domain/world";
import { PhaseStageLocalizationRegistry } from "../../../game/mechanisms";
import { SessionRecordHub } from "../../../observability";
import { BuiltPlayerPrompt, PlayerRoundOutcome } from "./model_client";

/** Adapter that projects one completed agent turn into the replay protocol. */
export class PlayerRoundRecorder {
  private readonly roundCounters = new Map<EntityId, number>();

  constructor(
    private readonly world: World,
    private readonly localization: PhaseStageLocalizationRegistry,
  ) {}

  record(
    request: ActionRequest,
    prompt: BuiltPlayerPrompt,
    outcome: PlayerRoundOutcome,
  ): void {
    const recorder = SessionRecordHub.getActive();
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
      phase: this.localization.phaseName(phase),
      stage: this.localization.stageName(stage),
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
      textAction: outcome.textAction,
      finalAction: outcome.finalAction ?? null,
      fallback: outcome.fallback,
    });
  }
}
