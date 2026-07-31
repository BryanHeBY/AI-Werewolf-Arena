import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, EntityId } from "../../../core/domain/model";
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
    const day = Number(request.context.day ?? request.context.current_day ?? 0);
    const phase = String(request.phase);
    const stage = String(
      request.context.phase ?? request.actionWindow ?? request.context.window ?? request.phase,
    );
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
      ...(prompt.isInitialRound
        ? {
            initialPromptSystem: prompt.systemPrompt,
            initialBoardInfo: prompt.boardInfoPrompt,
          }
        : {}),
      promptUserDelta: [
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
