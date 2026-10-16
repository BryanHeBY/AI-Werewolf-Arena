/**
 * 负责 SDK／Pi／ACP 共用系统／回合模板、人设、工具协议提示与公开开局配比缓存的组织。
 * 输入为原 World、请求与提示选项；输出为模板组合文本，机制状态／阶段说明交游戏观察 owner。
 * 查询 thunk 保留每次 World／语言／Catalog／板子 getter 时点，不提前调用人设或角色 renderer。
 * 开局人数先按原顺序写入，公开配比缓存仍唯一归此；来源选择与聚合交游戏观察 owner 直接填入。
 * 查询或聚合失败保留原 size／Map 已写前缀，不回滚，也不把身份候选当作当前权限。
 * 候选仅作提示，不授予行动许可；本模块不提交资源、变更阶段或复制新的私有库存。
 */

import { bindTargetHintContext } from "../tool-repair/target-hint-registry";
import {
  buildPlayerStatusDirective,
  buildPlayerStageContextHint,
  resolvePlayerPromptAbility,
  playerPromptRoleSkillBrief,
  appendPlayerPromptInitialIdentity,
} from "../observation/player-prompt-directives";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { collectPlayerInitialPublicCounts } from "../observation/player-initial-public-counts";

import { renderMessage, text, type Locale } from "@ai-werewolf-arena/game-text";

import { COMPONENT } from "../../domain/components/names";
import { publicPlayerRoster } from "../../domain/public-player-roster";
import { RoleComponent } from "../../domain/components/role";
import { ActionRequest, EntityId, Role, ToolName } from "../../domain";
import { getActionRequestStage } from "../../domain/action-request-context";
import { World } from "../../domain/world";

import {
  ConfigRenderRegistry,
  PhaseStageLocalizationRegistry,
  RoleCatalog,
  TargetHintRegistry,
  ToolSpecRegistry,
  knownWolfTeammates,
} from "../../rulesets/mechanism-api";

import type { PlayerObservation } from "../observation/player-observation";
import { capturePlayerObservation } from "../observation/player-observation-projector";
import { buildBoardInfoPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt-templates";
import { renderTurnConstraintUserHint } from "./turn-constraints";
import { resolveTurnConstraints } from "../../engine/actions/turn-constraints";

/** 装配对象与 registry 保原引用；人设回调收到原 request/role，不能把这个类型契约称作脱离数据或隔离沙箱。 */
export interface PlayerPromptPolicyOptions {
  personalityPromptResolver?: (request: ActionRequest, role?: RoleComponent) => string | undefined;
  toolSpecRegistry: ToolSpecRegistry;
  roleCatalog: RoleCatalog;
  targetHintRegistry: TargetHintRegistry;
  phaseStageLocalizationRegistry: PhaseStageLocalizationRegistry;
  configRenderRegistry: ConfigRenderRegistry;
  boardConfig?: ReadonlyBoardConfig;
}

/** SDK／Pi／ACP 共用提示策略；传输适配器只选择其协议提示。 */
export class PlayerPromptPolicy {
  // 这里只缓存构造时公开配比与人数，不把其当作当前存活、已觉醒或可用库存；后续展示 callback 仍晚读。
  private readonly publicRoleCounts = new Map<Role, number>();
  private readonly publicBoardSize: number;

  constructor(
    private readonly world: World,
    private readonly options: PlayerPromptPolicyOptions,
  ) {
    // size 在初发牌查询和计数之前提交；观察 owner 只填入本实例原 Map，不另建镜像。
    this.publicBoardSize = options.boardConfig?.boardSize ?? world.entityIds().length;
    collectPlayerInitialPublicCounts({
      world: () => world,
      boardConfig: () => options.boardConfig,
      role: (actorId) => this.role(actorId),
      counts: () => this.publicRoleCounts,
    });
  }

  get locale(): Locale {
    return this.world.locale;
  }

  /** 真实策略入口委托完整观察捕获，不在提示层重建库存或改变冻结时点。 */
  buildObservation(request: ActionRequest): PlayerObservation {
    return capturePlayerObservation(request, {
      world: () => this.world,
      role: (actorId) => this.role(actorId()),
      wolfTeammates: (actorId) => this.wolfTeammates(actorId()),
      catalog: () => this.options.roleCatalog,
    });
  }

  buildSystem(
    request: ActionRequest,
    options: { supportsDebugReporting: boolean; includeToolUseInstructions?: boolean },
  ) {
    // role→开局配比展示→可选板配置→模板参数依序求值；后续 renderer/回调抛错不回滚已发生副作用。
    const role = this.role(request.actorId);
    const boardInfoPrompt = this.buildBoardInfo();
    const configPrompt = this.options.boardConfig
      ? this.options.configRenderRegistry.renderBoardConfigPrompt(
          this.options.boardConfig,
          this.locale,
        )
      : undefined;
    return {
      systemPrompt: buildSystemPrompt({
        players: publicPlayerRoster(this.world),
        locale: this.locale,
        actorId: request.actorId,
        role: role ? this.options.roleCatalog.label(role.role, this.locale) : "unknown",
        maxPlayerId: this.world.entityIds().length,
        teammateIds: this.wolfTeammates(request.actorId),
        boardInfoPrompt,
        configPrompt,
        personalityPrompt: this.options.personalityPromptResolver?.(request, role),
        playerName: this.world.getComponent(request.actorId, COMPONENT.Identity)?.name,
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
    // 解析实例只为提示与目标标签选择；min/effective tools/candidates 仍是知识，提交要走实际规则与原体复验。
    const { bound, targetRuleRole } = resolvePlayerPromptAbility(request, role);
    const constraints = resolveTurnConstraints(request);
    const stage = getActionRequestStage(request);
    // 交流动作的受众不同；识别可交流轮次不扩大实际工具或消息可见性。
    const speechChannel = input.allowedTools.includes("speak_to_partner")
      ? "partner"
      : input.allowedTools.includes("brew_discuss")
        ? "brew"
        : input.allowedTools.includes("speak_to_wolves")
          ? "wolves"
          : input.allowedTools.includes("speak")
            ? "public"
            : undefined;
    return buildUserPrompt({
      locale: this.locale,
      actorId: request.actorId,
      phase: this.options.phaseStageLocalizationRegistry.phaseName(
        String(request.phase),
        this.locale,
      ),
      stage: this.options.phaseStageLocalizationRegistry.stageName(stage, this.locale),
      isSpeechTurn: speechChannel !== undefined,
      speechChannel,
      stageDirective:
        bound?.activation === "black_market"
          ? text(this.locale, "action.black_market_recipient.directive")
          : bound?.activation === "lucky"
            ? text(this.locale, "action.lucky.directive")
            : (this.options.toolSpecRegistry.getStageDirective(request.allowedTools, this.locale) ??
              text(this.locale, "prompt.stage.default")),
      statusDirective: buildPlayerStatusDirective(request, role, {
        world: () => this.world,
        locale: () => this.locale,
        catalog: () => this.options.roleCatalog,
        wolfTeammates: (actorId) => this.wolfTeammates(actorId()),
      }),
      requiresAction: constraints.minValidActions > 0,
      turnConstraintHint: renderTurnConstraintUserHint(constraints, this.locale),
      allowedTools: input.allowedTools,
      effectiveActionTools: input.effectiveActionTools ?? input.allowedTools,
      toolArgHints: this.toolArgHints(input.allowedTools),
      toolUsageHints: this.options.toolSpecRegistry.getApplicableUserPromptHints(
        input.allowedTools,
        this.locale,
      ),
      stageContextHint:
        [
          buildPlayerStageContextHint(request, {
            locale: () => this.locale,
            boardConfig: () => this.options.boardConfig,
          }),
          request.context.modifier_poison_blocked === true
            ? text(this.locale, "prompt.stage.modifier_poison_blocked")
            : undefined,
          // 原 retry_notice 即便空串也优先；只有 undefined 才渲染引用，随后 filter(Boolean) 不会重新回退。
          request.context.retry_notice !== undefined
            ? request.context.retry_notice
            : request.context.retry_notice_message
              ? renderMessage(this.locale, request.context.retry_notice_message)
              : undefined,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      actionableIdsHint: this.options.targetHintRegistry.buildActionableIdsHint(
        bindTargetHintContext({
          modifierCandidates: request.context.modifier_candidates,
          modifierBonusCandidates: request.context.modifier_bonus_candidates,
          actorId: request.actorId,
          day: request.context.day,
          actorRole: targetRuleRole,
          abilityId: request.context.ability_id,
          debateTargetId: request.context.debate_target_id,
          allowedTools: input.allowedTools,
          world: this.world,
          roleCatalog: this.options.roleCatalog,
          sheriffCandidates: request.context.sheriff_candidates,
          exileCandidates: request.context.exile_candidates,
          badgeCandidates: request.context.badge_candidates,
          wardenForcedTarget: request.context.warden_forced_target,
        }),
      ),
      actionSubmissionHint: input.actionSubmissionHint,
    });
  }

  /** 静态配比先形成文本，再追加当前板子说明与初始身份知识；追加失败不撤销 此前回调，函数不返回部分文本。 */
  buildBoardInfo(): string {
    let info = buildBoardInfoPrompt({
      locale: this.locale,
      totalPlayers: this.publicBoardSize,
      roleCounts: this.publicRoleCounts,
      roleLabel: (role) => this.options.roleCatalog.label(role, this.locale),
      roleSkillBrief: (role) =>
        playerPromptRoleSkillBrief(role, {
          world: () => this.world,
          locale: () => this.locale,
          catalog: () => this.options.roleCatalog,
        }),
    });
    if (this.options.boardConfig?.pureWhite) {
      info +=
        "\n" +
        text(
          this.locale,
          this.options.boardConfig.pureWhite.eliminationPriority === "awa_wolf_priority_v1"
            ? "prompt.board.pure_white.wolf_priority"
            : "prompt.board.pure_white.good_priority",
        );
    }
    return appendPlayerPromptInitialIdentity(info, {
      world: () => this.world,
      locale: () => this.locale,
    });
  }

  private role(actorId: EntityId): RoleComponent | undefined {
    return this.world.getComponent(actorId, COMPONENT.Role);
  }

  private wolfTeammates(actorId: EntityId): EntityId[] {
    return knownWolfTeammates(this.world, actorId, this.options.roleCatalog);
  }

  /** registry 提示按输入工具顺序取得并去掉假值；文本不是工具注册、schema 校验或现场许可。 */
  private toolArgHints(allowedTools: ToolName[]): string {
    const hints = allowedTools
      .map((tool) => this.options.toolSpecRegistry.getArgHint(tool))
      .filter((hint): hint is string => Boolean(hint));
    return hints.join("; ") || text(this.locale, "common.none");
  }
}
