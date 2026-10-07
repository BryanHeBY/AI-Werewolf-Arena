import { renderMessage, text, type Locale } from "@ai-werewolf-arena/game-text";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, BoardConfig, Camp, EntityId, Role, ToolName } from "../../../core/domain"
import {
  getActionRequestDay,
  getActionRequestStage,
} from "../../../core/domain/action_request_context";
import { World } from "../../../core/domain/world";
import type { IdentityComponent } from "../../../core/domain/entities/player";
import {
  ConfigRenderRegistry,
  PhaseStageLocalizationRegistry,
  RoleCatalog,
  TargetHintRegistry,
  ToolSpecRegistry,
} from "../../../game/mechanisms";
import { getGuardState, getHunterState, getIdiotState, getSeerState, getWitchState } from "../../../game/mechanisms/roles/private_state";
import { freezeObservation, type PlayerObservation } from "./observation";
import { buildBoardInfoPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt_templates";
import { renderTurnConstraintUserHint, resolveTurnConstraints } from "./turn_constraints";

export interface PlayerPromptPolicyOptions {
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  toolSpecRegistry: ToolSpecRegistry;
  roleCatalog: RoleCatalog;
  targetHintRegistry: TargetHintRegistry;
  phaseStageLocalizationRegistry: PhaseStageLocalizationRegistry;
  configRenderRegistry: ConfigRenderRegistry;
  boardConfig?: BoardConfig;
}

/** Shared game prompt policy; SDK and ACP adapters only choose transport instructions. */
export class PlayerPromptPolicy {
  constructor(
    private readonly world: World,
    private readonly options: PlayerPromptPolicyOptions,
  ) {}

  get locale(): Locale { return this.world.locale; }

  /** Structured counterpart of the same identity/private-state/event prompt policy. */
  buildObservation(request: ActionRequest): PlayerObservation {
    const role = this.role(request.actorId);
    const dead = new Set<number>();
    for (const event of request.context.visible_events) {
      if (event.type === "night_resolved" && Array.isArray(event.payload.deaths)) {
        for (const id of event.payload.deaths) if (typeof id === "number") dead.add(id);
      }
      const target = event.type === "voted_out" ? event.payload.target
        : event.type === "wolf_self_destruct" ? event.payload.wolfId
        : event.type === "hunter_shot" ? event.payload.targetId : undefined;
      if (typeof target === "number") dead.add(target);
    }
    const ownState: PlayerObservation["ownState"] = {};
    if (role?.role === Role.Witch) ownState.witch = getWitchState(role);
    if (role?.role === Role.Guard) ownState.guard = getGuardState(role);
    if (role?.role === Role.Hunter) ownState.hunter = getHunterState(role);
    if (role?.role === Role.Idiot) ownState.idiot = getIdiotState(role);
    if (role?.role === Role.Seer) ownState.seer = getSeerState(role);
    return freezeObservation({ request, identity: {
      ...(role ? { role: role.role, camp: role.camp } : {}),
      name: this.world.getComponent<IdentityComponent>(request.actorId, COMPONENT.Identity)?.name,
    }, knownAliveIds: this.world.entityIds().filter(id => !dead.has(id)),
      teammateIds: this.wolfTeammates(request.actorId, role), ownState });
  }

  buildSystem(
    request: ActionRequest,
    options: { supportsDebugReporting: boolean; includeToolUseInstructions?: boolean },
  ) {
    const role = this.role(request.actorId);
    const boardInfoPrompt = this.buildBoardInfo();
    const configPrompt = this.options.boardConfig
      ? this.options.configRenderRegistry.renderBoardConfigPrompt(this.options.boardConfig, this.locale)
      : undefined;
    return {
      systemPrompt: buildSystemPrompt({
        locale: this.locale,
        actorId: request.actorId,
        role: role ? this.options.roleCatalog.label(role.role, this.locale) : "unknown",
        maxPlayerId: this.world.entityIds().length,
        teammateIds: this.wolfTeammates(request.actorId, role),
        boardInfoPrompt,
        configPrompt,
        personalityPrompt: this.options.personalityPromptResolver?.(request, role),
        playerName: this.world.getComponent<IdentityComponent>(request.actorId, COMPONENT.Identity)?.name,
        supportsDebugReporting: options.supportsDebugReporting,
        includeToolUseInstructions: options.includeToolUseInstructions,
      }),
      boardInfoPrompt,
      configPrompt,
    };
  }

  buildUser(
    request: ActionRequest,
    input: {
      turnId: string;
      allowedTools: ToolName[];
      effectiveActionTools?: ToolName[];
      actionSubmissionHint: string;
    },
  ): string {
    const role = this.role(request.actorId);
    const constraints = resolveTurnConstraints(request);
    const stage = getActionRequestStage(request);
    return buildUserPrompt({
      locale: this.locale,
      actorId: request.actorId,
      phase: this.options.phaseStageLocalizationRegistry.phaseName(String(request.phase), this.locale),
      stage: this.options.phaseStageLocalizationRegistry.stageName(stage, this.locale),
      isSpeechTurn: input.allowedTools.includes("speak") || input.allowedTools.includes("speak_to_wolves"),
      stageDirective: this.options.toolSpecRegistry.getStageDirective(request.allowedTools, this.locale) ??
        text(this.locale, "prompt.stage.default"),
      statusDirective: this.statusDirective(role),
      requiresAction: constraints.minValidActions > 0,
      turnConstraintHint: renderTurnConstraintUserHint(constraints, this.locale),
      allowedTools: input.allowedTools,
      effectiveActionTools: input.effectiveActionTools ?? input.allowedTools,
      toolArgHints: this.toolArgHints(input.allowedTools),
      toolUsageHints: this.options.toolSpecRegistry.getApplicableUserPromptHints(input.allowedTools, this.locale),
      stageContextHint: [this.stageContextHint(request), request.context.retry_notice !== undefined ? request.context.retry_notice : request.context.retry_notice_message ? renderMessage(this.locale, request.context.retry_notice_message) : undefined].filter(Boolean).join(" ") || undefined,
      actionableIdsHint: this.options.targetHintRegistry.buildActionableIdsHint({
        actorId: request.actorId,
        actorRole: role?.role,
        allowedTools: input.allowedTools,
        world: this.world,
      }),
      actionSubmissionHint: input.actionSubmissionHint,
    });
  }

  buildBoardInfo(): string {
    const counts = new Map<Role, number>();
    for (const id of this.world.entityIds()) {
      const role = this.role(id);
      if (role) counts.set(role.role, (counts.get(role.role) ?? 0) + 1);
    }
    return buildBoardInfoPrompt({
      locale: this.locale,
      totalPlayers: this.world.entityIds().length,
      roleCounts: counts,
      roleLabel: (role) => this.options.roleCatalog.label(role, this.locale),
      roleSkillBrief: (role) => this.options.roleCatalog.skillBrief(role, this.locale),
    });
  }

  private role(actorId: EntityId): RoleComponent | undefined {
    return this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
  }

  private wolfTeammates(actorId: EntityId, role?: RoleComponent): EntityId[] {
    if (role?.camp !== Camp.Wolf) return [];
    // Mutual recognition is identity knowledge; unannounced deaths cannot erase it.
    return this.world.entityIds()
      .filter((id) => id !== actorId && this.role(id)?.camp === Camp.Wolf)
      .sort((a, b) => a - b);
  }

  private statusDirective(role?: RoleComponent): string | undefined {
    const lines: string[] = [];
    const privateState = role?.renderPrompt?.(this.locale).trim();
    if (privateState) lines.push(text(this.locale, "prompt.status.private", { state: privateState }));
    if (role?.role === Role.Idiot && getIdiotState(role)?.revealed) {
      lines.push(text(this.locale, "prompt.status.idiot"));
    }
    return lines.length ? lines.join(" ") : undefined;
  }

  private stageContextHint(request: ActionRequest): string | undefined {
    const stage = getActionRequestStage(request);
    const day = getActionRequestDay(request);
    const firstDaySheriffTiming =
      day === 1 &&
      this.options.boardConfig?.enableSheriff === true &&
      [
        "sheriff_nomination",
        "sheriff_campaign_speech",
        "sheriff_withdraw",
        "sheriff_vote",
      ].includes(stage)
        ? text(this.locale, "prompt.stage.sheriff_timing")
        : undefined;
    if (stage === "sheriff_nomination") {
      return [
        text(this.locale, "prompt.stage.sheriff_nomination"),
        firstDaySheriffTiming,
      ].filter(Boolean).join(" ");
    }
    if (stage === "sheriff_campaign_speech") {
      return firstDaySheriffTiming;
    }
    if (stage === "sheriff_withdraw") {
      return [
        text(this.locale, "prompt.stage.sheriff_withdraw"),
        firstDaySheriffTiming,
      ].filter(Boolean).join(" ");
    }
    if (stage === "sheriff_vote") {
      return [
        text(this.locale, "prompt.stage.sheriff_vote"),
        firstDaySheriffTiming,
      ].filter(Boolean).join(" ");
    }
    if (stage !== "witch") {
      const onlySelfDestruct = stage === "on_pre_vote" && request.allowedTools.every(
        (tool) => tool === "self_destruct" || tool === "report_bug",
      );
      return onlySelfDestruct
        ? text(this.locale, "prompt.stage.blast_only")
        : undefined;
    }
    if (typeof request.context.wolf_target === "number") {
      return text(this.locale, "prompt.stage.wolf_target", { target: request.context.wolf_target });
    }
    return request.context.wolf_target === null
      ? text(this.locale, "prompt.stage.no_wolf_target")
      : text(this.locale, "prompt.stage.unknown_wolf_target");
  }

  private toolArgHints(allowedTools: ToolName[]): string {
    const hints = allowedTools
      .map((tool) => this.options.toolSpecRegistry.getArgHint(tool))
      .filter((hint): hint is string => Boolean(hint));
    return hints.join("; ") || text(this.locale, "common.none");
  }
}
