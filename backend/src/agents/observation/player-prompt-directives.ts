/**
 * 负责玩家提示中的机制知识、能力／资源摘要、关系、自定义角色原文与阶段规则说明。
 * 输入为原请求、原角色和按原时点读取的查询 thunk；输出为状态／阶段文案、绑定能力的提示
 * 角色及板子特殊说明。已知日志不替代真实库存，提示候选也不是行动许可，权限仍归各机制。
 * 每次 World／语言／Catalog／板子读取保留位置，不建立新状态镜像；角色 renderer 晚调用，
 * 失败保留原回调和读取前缀。模板、人设、传输提示及实际行动提交由各自所有者负责。
 */
import { projectAwakenedClaws } from "../../features/awakened-wolf-king/observation-ports";
import { awakenedClawPromptState } from "../../features/awakened-wolf-king/presentation";
import { COMPONENT } from "../../domain/components/names";
import { roleInspectionPolicy } from "@ai-werewolf-arena/game-contract/role-inspection-policy";
import { rolePresentationRenderer } from "./role-presentation";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { isAnimalDreamBoard } from "../../features/animal-dream/authority";
import {
  animalFoxKnowledge,
  animalPufferKnowledge,
  animalCatKnowledge,
} from "../../features/animal-dream/facts";
import {
  isNobleBodyBoard,
  getNobleBodyPlayerState,
} from "../../features/noble-secret-body/authority";
import {
  isFragrantPairBoard,
  fragrantPlayerKnowledge,
} from "../../features/fragrant-pair-seer/authority";
import { settlesNightBeforeDay } from "../../rulesets/night-death-timing";
import { projectAlchemist, projectRaven } from "../../features/mist-raven/player-projection";
import { weddingActorView } from "../../features/ghost-bride/authority";
import { projectLonelyGirl } from "../../features/lonely-girl/lifecycle";
import { projectWildChild } from "../../features/wild-child/lifecycle";
import { initialIdentityCandidateCounts } from "../../features/initial-identity/deal";
import { projectShapeshifterState } from "../../features/shapeshifter/state-ports";
import { projectShapeshifterChoices } from "../../features/shapeshifter/setup";
import { initialIdentityKind } from "../../features/initial-identity/deal";
import { projectThiefState } from "../../features/thief/state-ports";
import { projectThiefChoices } from "../../features/thief/setup";
import { projectWallNote } from "../../features/wall-notes/authority";
import { renderInspectionPolicy } from "../../features/role-inspection/policy-ports";
import { text, term, type Locale } from "@ai-werewolf-arena/game-text";
import { ROLE_INSPECTION_POLICY_ROLES } from "../../features/night-abilities/abilities";
import { projectNightState } from "./night-ability-projection";
import { allDeathGuns, projectDeathGun } from "../../features/death-actions/death-abilities";
import { getRoleInspectionState } from "../../features/role-inspection/ports";
import { ownNightActions } from "../../features/night-abilities/night-action-history";
import { debateVoteBlocked } from "../../features/debater/authority";
import { projectLover } from "../../features/cupid/relation";
import { projectEclipseState } from "../../features/radiant-eclipse/ports";
import { RoleComponent } from "../../domain/components/role";
import { ActionRequest, ActionWindow, EntityId, Role } from "../../domain";
import { getActionRequestDay, getActionRequestStage } from "../../domain/action-request-context";
import { World } from "../../domain/world";
import { RoleCatalog, allNightAbilities, abilityStatus } from "../../rulesets/mechanism-api";
import { getDreamerState } from "../../features/dreamer/ports";
import { getIdiotState } from "../../features/idiot/ports";

/** 查询只在原表达式处执行；尤其队友方法先查找原 callee，再读取 actorId。 */
export interface PlayerPromptDirectiveQueries {
  world(): World;
  locale(): Locale;
  catalog(): RoleCatalog;
  boardConfig(): ReadonlyBoardConfig | undefined;
  wolfTeammates(actorId: () => EntityId): EntityId[];
}

/** 映射的是提示所使用的规则角色，不启用技能、刷新库存或重检生命资格。 */
export function resolvePlayerPromptAbility(request: ActionRequest, role?: RoleComponent) {
  const bound = request.context.ability_id
    ? allNightAbilities(role).find((ability) => ability.id === request.context.ability_id)
    : undefined;
  const targetRuleRole =
    bound?.kind === "shelter"
      ? Role.RadiantCount
      : bound?.kind === "role_check"
        ? ROLE_INSPECTION_POLICY_ROLES[roleInspectionPolicy(bound.state)]
        : bound?.kind === "guard"
          ? Role.Guard
          : bound?.kind === "potion"
            ? Role.Witch
            : bound?.kind === "seer_check"
              ? Role.Seer
              : bound?.kind === "dream"
                ? Role.Dreamer
                : role?.role;
  return { bound, targetRuleRole };
}

/** 原角色技能简介只对动物板子的熊使用晨报说明；其它简介依当前 Catalog 与语言读取。 */
export function playerPromptRoleSkillBrief(
  role: Role,
  queries: Pick<PlayerPromptDirectiveQueries, "world" | "locale" | "catalog">,
): string {
  return role === Role.Bear && isAnimalDreamBoard(queries.world())
    ? text(queries.locale(), "role.bear.dawn_brief")
    : queries.catalog().skillBrief(role, queries.locale());
}

/** N+2 身份说明仍在模板／政策附注之后查询，不把构造时的公开配比当作当前库存。 */
export function appendPlayerPromptInitialIdentity(
  info: string,
  queries: Pick<PlayerPromptDirectiveQueries, "world" | "locale">,
): string {
  return initialIdentityCandidateCounts(queries.world())
    ? info +
        "\n" +
        text(
          queries.locale(),
          initialIdentityKind(queries.world()) === "shapeshifter"
            ? "prompt.board.shapeshifter"
            : "prompt.board.thief",
        )
    : info;
}

/** 各机制给出的已知视图分别读取，库存摘要保原来源，不能为缩短流程合并成真实全局状态。 */
export function buildPlayerStatusDirective(
  request: ActionRequest,
  role: RoleComponent | undefined,
  queries: Pick<PlayerPromptDirectiveQueries, "world" | "locale" | "catalog" | "wolfTeammates">,
): string | undefined {
  const lines: string[] = [];
  // 受传者保持原身份；只渲染本人的已付爪槽，不通过狼王或别人的库存补全。
  if (role?.role !== Role.AwakenedWolfKing) {
    const claws = projectAwakenedClaws(role);
    if (claws) lines.push(awakenedClawPromptState(claws, queries.locale()));
  }
  // 动物与专属板子读取已发表的玩家知识；不能用当前真实库存补造尚未通知的结果。
  if (isAnimalDreamBoard(queries.world())) {
    const state =
      role?.role === Role.FoxCub
        ? animalFoxKnowledge(queries.world(), request.actorId)
        : role?.role === Role.Pufferfish
          ? animalPufferKnowledge(queries.world(), request.actorId)
          : role?.role === Role.WhiteCat
            ? animalCatKnowledge(queries.world(), request.actorId)
            : null;
    if (state)
      lines.push(text(queries.locale(), "prompt.status.animal", { state: JSON.stringify(state) }));
  }
  if (role?.role === Role.FragrantPhantom && isFragrantPairBoard(queries.world())) {
    const known = fragrantPlayerKnowledge(queries.world(), request.phase, request.context.day);
    if (known.actorId === request.actorId)
      lines.push(
        text(queries.locale(), "prompt.status.fragrant", { state: JSON.stringify(known) }),
      );
  }
  if (isNobleBodyBoard(queries.world())) {
    const known = getNobleBodyPlayerState(queries.world(), request.actorId, request.phase);
    if (known)
      lines.push(
        text(
          queries.locale(),
          known.kind === "night_noble" ? "prompt.status.noble" : "prompt.status.secret_body",
          { state: JSON.stringify(known.state) },
        ),
      );
  }
  if (role?.role === Role.EclipseMaid) {
    const state = projectEclipseState(role);
    if (state)
      lines.push(text(queries.locale(), "prompt.status.eclipse", { state: JSON.stringify(state) }));
  }
  const alchemist = projectAlchemist(role),
    raven = projectRaven(role);
  if (alchemist)
    lines.push(
      text(queries.locale(), "prompt.status.alchemist", { state: JSON.stringify(alchemist) }),
    );
  if (raven)
    lines.push(text(queries.locale(), "prompt.status.raven", { state: JSON.stringify(raven) }));
  const weddingView = weddingActorView(queries.world(), request.actorId);
  if (weddingView)
    lines.push(
      text(queries.locale(), "prompt.status.wedding", { state: JSON.stringify(weddingView) }),
    );
  if (role?.role === Role.LonelyGirl)
    lines.push(
      text(queries.locale(), "prompt.status.lonely_girl", {
        state: JSON.stringify(projectLonelyGirl(queries.world(), role)),
      }),
    );
  if (role?.role === Role.WildChild)
    lines.push(
      text(queries.locale(), "prompt.status.wild_child", {
        state: JSON.stringify(projectWildChild(queries.world(), role)),
      }),
    );
  const thief = projectThiefState(role, queries.world()),
    choices = projectThiefChoices(queries.world(), request.actorId);
  const shape = projectShapeshifterState(role, queries.world()),
    shapeChoices = projectShapeshifterChoices(queries.world(), request.actorId);
  if (shape)
    lines.push(
      text(queries.locale(), "prompt.status.shapeshifter", {
        state: JSON.stringify({ ...shape, ...(shapeChoices ?? {}) }),
      }),
    );
  if (thief)
    lines.push(
      text(queries.locale(), "prompt.status.thief", {
        state: JSON.stringify({ ...thief, ...(choices ?? {}) }),
      }),
    );
  const wallNote = projectWallNote(queries.world(), request.actorId);
  if (wallNote)
    lines.push(
      text(queries.locale(), "prompt.status.wall_note", { state: JSON.stringify(wallNote) }),
    );
  lines.push(text(queries.locale(), "prompt.status.day", { day: getActionRequestDay(request) }));
  lines.push(
    text(queries.locale(), "prompt.status.wolf_teammates", {
      teammates:
        queries.wolfTeammates(() => request.actorId).join(", ") ||
        text(queries.locale(), "common.none"),
    }),
  );
  // 身份文字仍先取角色标签；阵营到原字段点才读实际Camp，不授予新行动资格。
  if (role)
    lines.push(
      text(queries.locale(), "ability.identity", {
        role: queries.catalog().label(role.role, queries.locale()),
        camp: term(
          "camp",
          queries.world().getComponent(request.actorId, COMPONENT.Camp)!.camp,
          queries.locale(),
        ),
      }),
    );
  // 自持能力仍用原实例／日期计算摘要；库存可见不等于本次行动可提交。
  for (const ability of allNightAbilities(role)) {
    const status = text(
      queries.locale(),
      `ability.status.${abilityStatus(ability, request.context.day)}`,
    );
    const state = projectNightState(ability);
    lines.push(
      text(queries.locale(), "ability.summary", {
        id: ability.id,
        kind: text(queries.locale(), `ability.kind.${ability.kind}`),
        status,
        uses:
          ability.maxUses === null
            ? text(queries.locale(), "ability.unlimited")
            : ability.maxUses - ability.uses,
        state: JSON.stringify(state),
      }),
    );
  }
  if (request.context.ability_id)
    lines.push(text(queries.locale(), "ability.bound_turn", { id: request.context.ability_id }));
  for (const gun of allDeathGuns(role)) {
    const projected = projectDeathGun(gun);
    lines.push(
      text(queries.locale(), "ability.death_gun.summary", {
        id: projected.id,
        status: text(queries.locale(), `ability.status.${projected.status}`),
        remaining: projected.remaining,
        granted: projected.grantedNight,
        armed: projected.armedOnNight ?? text(queries.locale(), "common.none"),
      }),
    );
  }
  // 历史及两次当前库存查询各保原位置，不能缓存一份清单来掩盖 caller getter 或生命周期变化。
  const history = ownNightActions(queries.world(), request.actorId, request.context.day);
  const hasLucky =
    allNightAbilities(role).some((ability) => ability.activation === "lucky") ||
    history.some((row) => row.lucky && (row.recipientPolicy ?? "lucky") === "lucky");
  const hasBlack =
    allNightAbilities(role).some((ability) => ability.activation === "black_market") ||
    history.some((row) => row.recipientPolicy === "black_market");
  if (hasLucky) lines.push(text(queries.locale(), "ability.lucky.rules"));
  if (hasBlack) lines.push(text(queries.locale(), "ability.black_market.rules"));
  if (hasLucky || hasBlack)
    lines.push(
      text(queries.locale(), "ability.lucky.history", { actions: JSON.stringify(history) }),
    );
  if (
    request.allowedTools.includes("dream") &&
    allNightAbilities(role).some((ability) => ability.kind === "dream")
  ) {
    lines.push(text(queries.locale(), "ability.dream.rules"));
    const state = getDreamerState(role!, request.context.ability_id);
    lines.push(
      text(
        queries.locale(),
        state?.protectionPolicy === "netease_2026_night_immunity_v1"
          ? "role.dreamer.protection_netease"
          : "role.dreamer.protection_awa",
      ),
    );
  }
  if (role && request.allowedTools.includes("inspect_role")) {
    const inspection = getRoleInspectionState(role, request.context.ability_id);
    if (inspection)
      lines.push(
        inspection.inspectionPolicy
          ? renderInspectionPolicy(inspection, queries.locale())
          : text(
              queries.locale(),
              roleInspectionPolicy(inspection) === "psychic"
                ? "ability.role_check.psychic_rules"
                : roleInspectionPolicy(inspection) === "mirror"
                  ? "ability.role_check.mirror_rules"
                  : "ability.role_check.rules",
            ),
      );
  }
  if (debateVoteBlocked(queries.world(), request.actorId, request.context.day))
    lines.push(text(queries.locale(), "prompt.status.debate_penalty"));
  const lover = projectLover(queries.world(), request.actorId);
  if (lover) {
    lines.push(text(queries.locale(), "prompt.status.lover", { partner: lover.partnerId }));
    if (lover.mayNotVotePartner) lines.push(text(queries.locale(), "prompt.status.lovers_vote"));
  }
  // 原文最后调用；optional-call 在没有 renderer 时不读取语言，不提前捕获自定义回调结果。
  const privateState = rolePresentationRenderer(role)?.(queries.locale()).trim();
  if (privateState)
    lines.push(text(queries.locale(), "prompt.status.private", { state: privateState }));
  if (role?.role === Role.Idiot && getIdiotState(role)?.revealed) {
    lines.push(text(queries.locale(), "prompt.status.idiot"));
  }
  return lines.length ? lines.join(" ") : undefined;
}

/** 说明原请求候选与首日警长时序；这里不重新推导合法目标、不授予窗口或改变失败政策。 */
export function buildPlayerStageContextHint(
  request: ActionRequest,
  queries: Pick<PlayerPromptDirectiveQueries, "locale" | "boardConfig">,
): string | undefined {
  // 新族先用稳定工具数组筛选；不向旧请求增加context/getter查询，保原目标提示的读取顺序。
  if (request.allowedTools.includes("awakened_brew") && request.context.awakened_brew_options) {
    const o = request.context.awakened_brew_options,
      locale = queries.locale(),
      none = text(locale, "common.none");
    return text(locale, "prompt.stage.awakened_brew", {
      assistants: o.assistantIds.join(", ") || none,
      brews: o.brewRemaining,
      canHeal: text(locale, o.canHeal ? "common.yes" : "common.no"),
      canPoison: text(locale, o.canPoison ? "common.yes" : "common.no"),
      heal: o.healRemaining,
      knife: o.wolfTarget ?? none,
      required: o.requiredAssistants,
      targets: o.targetIds.join(", ") || none,
    });
  }
  if (
    request.allowedTools.some((t) => t === "brew_discuss" || t === "brew_approve") &&
    request.context.brew_collaboration
  ) {
    const g = request.context.brew_collaboration;
    return text(queries.locale(), "prompt.stage.brew_group", {
      assistants: g.assistantIds.join(", "),
      ordinal: g.ordinal,
      target: g.targetId,
    });
  }
  if (
    request.allowedTools.includes("warden_pair") &&
    request.context.warden_candidates !== undefined
  )
    return text(queries.locale(), "prompt.stage.warden_candidates", {
      ids: request.context.warden_candidates.join(", "),
    });
  if (
    request.allowedTools.includes("warden_decide") &&
    request.context.warden_partner_id !== undefined
  )
    return text(queries.locale(), "prompt.stage.warden_partner", {
      partner: request.context.warden_partner_id,
    });
  if (
    request.allowedTools.some((t) => ["check_identity", "use_potion", "dream"].includes(t)) &&
    request.context.warden_forced_target !== undefined
  )
    return text(queries.locale(), "prompt.stage.warden_forced", {
      target: request.context.warden_forced_target,
    });
  // 按原字段优先级展示请求已带来的候选，不据这些文字重新授权目标。
  if (
    request.allowedTools.includes("bequeath_claw") &&
    request.context.claw_bequest_candidates !== undefined
  )
    return text(queries.locale(), "prompt.stage.claw_bequest_candidates", {
      ids: request.context.claw_bequest_candidates.join(", "),
    });
  if (request.allowedTools.includes("silence") && request.context.silence_candidates !== undefined)
    return text(queries.locale(), "prompt.stage.silence_candidates", {
      ids: request.context.silence_candidates.join(", "),
    });
  if (
    request.allowedTools.includes("gesture") &&
    request.context.stage === "silence_gesture" &&
    request.context.silence_target_id !== undefined
  )
    return text(queries.locale(), "prompt.stage.silence_gesture", {
      target: request.context.silence_target_id,
      round: text(
        queries.locale(),
        request.context.silence_round === "pk" ? "silence.round.pk" : "silence.round.day",
      ),
    });
  if (
    request.allowedTools.includes("translate_silence") &&
    request.context.stage === "silence_translation" &&
    request.context.silence_target_id !== undefined &&
    request.context.silence_gesture_description !== undefined
  )
    return text(queries.locale(), "prompt.stage.silence_translation", {
      target: request.context.silence_target_id,
      round: text(
        queries.locale(),
        request.context.silence_round === "pk" ? "silence.round.pk" : "silence.round.day",
      ),
      description: request.context.silence_gesture_description,
    });
  if (
    request.allowedTools.includes("curse_exile") &&
    request.context.crow_candidates !== undefined
  ) {
    const ids = request.context.crow_candidates;
    return ids.length
      ? text(
          queries.locale(),
          ids.includes(request.actorId) ? "prompt.targets.self" : "prompt.targets.others",
          { ids: ids.join(", ") },
        )
      : text(queries.locale(), "prompt.targets.none");
  }
  if (request.context.fox_candidates)
    return text(queries.locale(), "prompt.stage.fox_candidates", {
      ids: request.context.fox_candidates.join(", "),
    });
  const pairCandidates =
    request.context.fragrant_pair_candidates ?? request.context.pair_check_candidates;
  if (pairCandidates)
    return text(queries.locale(), "prompt.stage.fragrant_pair_candidates", {
      ids: pairCandidates.join(", "),
    });
  if (request.context.wolf_kill_candidates !== undefined)
    return text(queries.locale(), "prompt.stage.wolf_kill_candidates", {
      candidates:
        request.context.wolf_kill_candidates.join(", ") || text(queries.locale(), "common.none"),
    });
  if (request.context.stage === "alchemist_snake")
    return text(queries.locale(), "prompt.stage.snake", {
      target: request.context.snake_target ?? text(queries.locale(), "common.none"),
      candidates:
        (request.context.snake_candidates ?? []).join(", ") ||
        text(queries.locale(), "common.none"),
    });
  if (request.context.stage === "alchemist_mist")
    return text(queries.locale(), "prompt.stage.mist", {
      candidates: (request.context.mist_candidates ?? []).join(", "),
    });
  if (request.context.stage === "raven_knife")
    return text(queries.locale(), "prompt.stage.raven_knife", {
      candidates: (request.context.raven_candidates ?? []).join(", "),
    });
  const stage = getActionRequestStage(request);
  const day = getActionRequestDay(request);
  // 板子 getter 在原两个表达式分别读取；! 仅消除类型缩窄丢失，不缓存或新增运行时拒绝。
  const firstDaySheriffTiming =
    day === 1 &&
    queries.boardConfig()?.enableSheriff === true &&
    !settlesNightBeforeDay(queries.boardConfig()!) &&
    ["sheriff_nomination", "sheriff_campaign_speech", "sheriff_withdraw", "sheriff_vote"].includes(
      stage,
    )
      ? text(queries.locale(), "prompt.stage.sheriff_timing")
      : undefined;
  if (stage === "sheriff_nomination") {
    return [text(queries.locale(), "prompt.stage.sheriff_nomination"), firstDaySheriffTiming]
      .filter(Boolean)
      .join(" ");
  }
  if (stage === "sheriff_campaign_speech") {
    return firstDaySheriffTiming;
  }
  if (stage === "sheriff_withdraw") {
    return [text(queries.locale(), "prompt.stage.sheriff_withdraw"), firstDaySheriffTiming]
      .filter(Boolean)
      .join(" ");
  }
  if (stage === "sheriff_vote") {
    return [text(queries.locale(), "prompt.stage.sheriff_vote"), firstDaySheriffTiming]
      .filter(Boolean)
      .join(" ");
  }
  if (stage === "scholar_mentor_choice")
    return text(queries.locale(), "prompt.stage.modifier_choice", {
      modes: (request.context.modifier_modes ?? []).join(", "),
    });
  if (stage === "scholar_mentor_bonus")
    return text(queries.locale(), "prompt.stage.modifier_bonus", {
      kind: request.context.modifier_bonus_kind ?? "",
    });
  if (stage !== "witch") {
    const onlySelfDestruct =
      Object.values(ActionWindow).includes(stage as ActionWindow) &&
      request.allowedTools.every(
        (tool) =>
          tool === "self_destruct" || tool === "self_destruct_with_target" || tool === "report_bug",
      );
    return onlySelfDestruct
      ? text(queries.locale(), "prompt.stage.blast_only", {
          tool: request.allowedTools.includes("self_destruct_with_target")
            ? "self_destruct_with_target"
            : "self_destruct",
        })
      : undefined;
  }
  if (request.context.wolf_targets !== undefined)
    return request.context.wolf_targets.length
      ? text(queries.locale(), "prompt.stage.wolf_targets", {
          targets: request.context.wolf_targets.join(", "),
        })
      : text(queries.locale(), "prompt.stage.no_wolf_target");
  if (typeof request.context.wolf_target === "number") {
    return text(queries.locale(), "prompt.stage.wolf_target", {
      target: request.context.wolf_target,
    });
  }
  return request.context.wolf_target === null
    ? text(queries.locale(), "prompt.stage.no_wolf_target")
    : text(queries.locale(), "prompt.stage.unknown_wolf_target");
}
