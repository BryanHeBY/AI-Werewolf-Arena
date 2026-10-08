import { renderMessage, text, term, type Locale } from "@ai-werewolf-arena/game-text";
import { COMPONENT } from "../../../core/domain/components/names";
import { RoleComponent } from "../../../core/domain/components/role";
import { ActionRequest, ActionWindow, BoardConfig, EntityId, Role, ToolName } from "../../../core/domain"
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
  knownWolfTeammates,
  allNightAbilities, abilityStatus, projectNightAbility,
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
  private readonly publicRoleCounts = new Map<Role, number>();
  private readonly publicBoardSize: number;

  constructor(
    private readonly world: World,
    private readonly options: PlayerPromptPolicyOptions,
  ) {
    this.publicBoardSize = options.boardConfig?.boardSize ?? world.entityIds().length;
    if (options.boardConfig) {
      for (const { role, count } of options.boardConfig.roleSetups) {
        this.publicRoleCounts.set(role, (this.publicRoleCounts.get(role) ?? 0) + count);
      }
    } else {
      // Compatibility for callers constructed at opening without a board input.
      for (const id of world.entityIds()) {
        const role = this.role(id);
        if (role) this.publicRoleCounts.set(role.role, (this.publicRoleCounts.get(role.role) ?? 0) + 1);
      }
    }
  }

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
    const witch = role ? getWitchState(role, request.context.ability_id) : undefined;
    const guard = role ? getGuardState(role, request.context.ability_id) : undefined;
    if (witch) ownState.witch = witch;
    if (guard) ownState.guard = guard;
    if (role?.role === Role.Hunter) ownState.hunter = getHunterState(role);
    if (role?.role === Role.Idiot) ownState.idiot = getIdiotState(role);
    const seer = role ? getSeerState(role, request.context.ability_id) : undefined;
    if (seer) ownState.seer = seer;
    const { death_action_id: _deathActionId, ...context } = request.context;
    return freezeObservation({ request: { ...request, context }, identity: {
      ...(role ? { role: role.role, camp: role.camp } : {}),
      name: this.world.getComponent<IdentityComponent>(request.actorId, COMPONENT.Identity)?.name,
    }, knownAliveIds: this.world.entityIds().filter(id => !dead.has(id)),
      teammateIds: this.wolfTeammates(request.actorId), ownState,
      abilities: allNightAbilities(role).map(ability => projectNightAbility(ability, request.context.day)) });
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
        teammateIds: this.wolfTeammates(request.actorId),
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
    const bound = request.context.ability_id ? allNightAbilities(role).find(ability => ability.id === request.context.ability_id) : undefined;
    const targetRuleRole = bound?.kind === "guard" ? Role.Guard : bound?.kind === "potion" ? Role.Witch : bound?.kind === "seer_check" ? Role.Seer : role?.role;
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
      statusDirective: this.statusDirective(request, role),
      requiresAction: constraints.minValidActions > 0,
      turnConstraintHint: renderTurnConstraintUserHint(constraints, this.locale),
      allowedTools: input.allowedTools,
      effectiveActionTools: input.effectiveActionTools ?? input.allowedTools,
      toolArgHints: this.toolArgHints(input.allowedTools),
      toolUsageHints: this.options.toolSpecRegistry.getApplicableUserPromptHints(input.allowedTools, this.locale),
      stageContextHint: [this.stageContextHint(request), request.context.retry_notice !== undefined ? request.context.retry_notice : request.context.retry_notice_message ? renderMessage(this.locale, request.context.retry_notice_message) : undefined].filter(Boolean).join(" ") || undefined,
      actionableIdsHint: this.options.targetHintRegistry.buildActionableIdsHint({
        actorId: request.actorId,
        actorRole: targetRuleRole,
        allowedTools: input.allowedTools,
        world: this.world,
        roleCatalog: this.options.roleCatalog,
        sheriffCandidates: request.context.sheriff_candidates,
      }),
      actionSubmissionHint: input.actionSubmissionHint,
    });
  }

  buildBoardInfo(): string {
    return buildBoardInfoPrompt({
      locale: this.locale,
      totalPlayers: this.publicBoardSize,
      roleCounts: this.publicRoleCounts,
      roleLabel: (role) => this.options.roleCatalog.label(role, this.locale),
      roleSkillBrief: (role) => this.options.roleCatalog.skillBrief(role, this.locale),
    });
  }

  private role(actorId: EntityId): RoleComponent | undefined {
    return this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role);
  }

  private wolfTeammates(actorId: EntityId): EntityId[] {
    return knownWolfTeammates(this.world, actorId, this.options.roleCatalog);
  }

  private statusDirective(request: ActionRequest, role?: RoleComponent): string | undefined {
    const lines: string[] = [];
    lines.push(text(this.locale, "prompt.status.wolf_teammates", { teammates: this.wolfTeammates(request.actorId).join(", ") || text(this.locale, "common.none") }));
    if (role) lines.push(text(this.locale, "ability.identity", { role: this.options.roleCatalog.label(role.role, this.locale), camp: term("camp", role.camp, this.locale) }));
    for (const ability of allNightAbilities(role)) {
      const status = text(this.locale, `ability.status.${abilityStatus(ability, request.context.day)}`);
      const state = ability.kind === "seer_check" ? { lastTarget: ability.state.lastTarget, lastResult: ability.state.lastResult ?? null } : ability.state;
      lines.push(text(this.locale, "ability.summary", { id: ability.id, kind: text(this.locale, `ability.kind.${ability.kind}`), status, uses: ability.maxUses === null ? text(this.locale, "ability.unlimited") : ability.maxUses - ability.uses, state: JSON.stringify(state) }));
    }
    if (request.context.ability_id) lines.push(text(this.locale, "ability.bound_turn", { id: request.context.ability_id }));
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
      const onlySelfDestruct = Object.values(ActionWindow).includes(stage as ActionWindow) && request.allowedTools.every(
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
