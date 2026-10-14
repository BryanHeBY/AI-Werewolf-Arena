/**
 * 负责完整捕获玩家可获知的身份、机制知识、已发表死亡、行动历史与能力／枪信息。
 * 输入为原请求与按原时点执行的窄查询；输出是原字段集合的脱离冻结 PlayerObservation。
 * World 仅在此游戏侧 adapter 读取，不交给策略；已知存活依发布事实计算，不替换为真实存活名单。
 * 角色和队友方法在 actor 参数之前查找；每个 World 读取保原位置，机制知识／权限仍归各原 owner。
 * 结构观察不提交行动、不克隆完整私有库存，也不提前执行自定义人设或角色展示回调；失败前缀保持。
 */
import { getWhiteWolfKingState } from "../mechanisms/roles/white_wolf_king/ports";
import { isAnimalDreamBoard } from "../mechanisms/roles/animal_dream/authority";
import {
  animalFoxKnowledge,
  animalPufferKnowledge,
  animalCatKnowledge,
  animalBeautyKnowledge,
  animalBearKnowledge,
} from "../mechanisms/roles/animal_dream/facts";
import {
  isNobleBodyBoard,
  getNobleBodyPlayerState,
} from "../mechanisms/roles/noble_secret_body/authority";
import {
  isFragrantPairBoard,
  fragrantPlayerKnowledge,
} from "../mechanisms/roles/fragrant_pair_seer/authority";
import { projectAlchemist, projectRaven } from "../mechanisms/roles/mist_raven/player_projection";
import { readModifierState } from "../mechanisms/roles/scholar_mentor/state";
import { scholarMentorStateForRole } from "../mechanisms/roles/scholar_mentor/night_frame";
import { projectTimeConsortState } from "../mechanisms/roles/time_wolf_consort/state";
import { projectWolfSorcererState } from "../mechanisms/roles/wolf_sorcerer/ports";
import { projectTricksterState } from "../mechanisms/roles/trickster/ports";
import { projectOrderPrinceState } from "../mechanisms/roles/order_prince/state";
import { projectMagicianState } from "../mechanisms/roles/magician/ports";
import { projectRedMoonState } from "../mechanisms/roles/red_moon_apostle/ports";
import { projectNightmareShadowState } from "../mechanisms/roles/nightmare_shadow/state";
import { projectEvilKnightState } from "../mechanisms/roles/evil_knight/state";
import { projectDemonHunter } from "../mechanisms/roles/demon_hunter/authority";
import { weddingActorView, weddingBrideState } from "../mechanisms/roles/ghost_bride/authority";
import { projectLonelyGirl } from "../mechanisms/roles/lonely_girl/lifecycle";
import { projectWildChild } from "../mechanisms/roles/wild_child/lifecycle";
import { projectShapeshifterState } from "../mechanisms/roles/shapeshifter/state";
import { projectShapeshifterChoices } from "../mechanisms/roles/shapeshifter/setup";
import { projectThiefState } from "../mechanisms/roles/thief/state";
import { projectThiefChoices } from "../mechanisms/roles/thief/setup";
import { projectWallNote } from "../mechanisms/events/wall_notes/authority";
import {
  projectBearState,
  projectDreamerState,
  projectGuardState,
  projectHunterState,
  projectIdiotState,
  projectKnightState,
  projectWhiteWolfKingState,
  projectWolfBeautyState,
  projectWolfKingState,
} from "../mechanisms/roles/player_state";
import { readGravekeeperReport } from "@ai-werewolf-arena/replay-contract";
import { getBearState } from "../mechanisms/roles/bear/ports";
import { getHiddenWolfState } from "../mechanisms/roles/hidden_wolf/ports";
import { canHiddenWolfKnife } from "../mechanisms/roles/hidden_wolf/inheritance";
import {
  projectRoleInspectionState,
  projectSeerState,
  projectWitchState,
} from "../mechanisms/roles/abilities";
import {
  getBlackMarketState,
  projectBlackMarketState,
} from "../mechanisms/roles/black_market_merchant/state";
import { allDeathGuns, projectDeathGun } from "../mechanisms/roles/death_abilities";
import { getGargoyleState } from "../mechanisms/roles/gargoyle/ports";
import { getRoleInspectionState } from "../mechanisms/roles/role_inspection/ports";
import { canGargoyleKnife } from "../mechanisms/roles/gargoyle/inheritance";
import {
  getMechanicalState,
  projectMechanicalState,
} from "../mechanisms/roles/mechanical_wolf/state";
import {
  getAwakenedState,
  projectAwakenedState,
} from "../mechanisms/roles/awakened_hidden_wolf/state";
import { ownNightActions } from "../mechanisms/roles/night_action_history";
import { getDebaterState, projectDebaterState } from "../mechanisms/roles/debater/state";
import { hasDebateCommit, debateVoteBlocked } from "../mechanisms/roles/debater/authority";
import { getCupidState, projectCupidState } from "../mechanisms/roles/cupid/state";
import { projectLover } from "../mechanisms/roles/cupid/relation";
import { getHybridState, projectHybridState } from "../mechanisms/roles/hybrid/state";
import { getMerchantState, projectMerchantState } from "../mechanisms/roles/miracle_merchant/state";
import { projectEclipseState } from "../mechanisms/roles/radiant_eclipse/ports";
import { COMPONENT } from "../../core/domain/components/names";
import { Camp, Role, type ActionRequest } from "@ai-werewolf-arena/game-contract";
import { allNightAbilities } from "../mechanisms";
import { projectNightAbility } from "./night-ability-projection";
import { getGuardState } from "../mechanisms/roles/guard/ports";
import { getHunterState } from "../mechanisms/roles/hunter/ports";
import { getWolfKingState } from "../mechanisms/roles/wolf_king/ports";
import { getKnightState } from "../mechanisms/roles/knight/ports";
import { getGravekeeperState } from "../mechanisms/roles/gravekeeper/ports";
import { getDreamerState } from "../mechanisms/roles/dreamer/ports";
import { getWolfBeautyState } from "../mechanisms/roles/wolf_beauty/ports";
import { getIdiotState } from "../mechanisms/roles/idiot/ports";
import { getWitchState } from "../mechanisms/roles/witch/ports";
import { getSeerState } from "../mechanisms/roles/seer/ports";
import { freezeObservation, type PlayerObservation } from "./player-observation";
import type { RoleComponent } from "../../core/domain/components/role";
import type { World } from "../../core/domain/world";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import type { RoleCatalog } from "../mechanisms/roles/catalog";
import { wolfTeamPermissions } from "../mechanisms/roles/wolf_team";

/** 只供捕获 owner 使用的原位读取端口；回调不进入观察 DTO 或玩家策略。 */
export interface PlayerObservationQueries {
  world(): World;
  role(actorId: () => EntityId): RoleComponent | undefined;
  wolfTeammates(actorId: () => EntityId): EntityId[];
  catalog(): RoleCatalog;
}

/**
 * F01：只捕获当前 actor 自己的狼队资格，不从历史队友或请求的旧工具名单推断。
 * 原政策可运行自定义 callback，因此先读结果，再核对自己的角色编号、阵营和存活量；
 * 这只是观察快照，不是原生命／请求租约；实际提交仍由原机制验证，不返回拒绝原因。
 */
function captureCurrentWolfActions(
  request: ActionRequest,
  queries: PlayerObservationQueries,
): PlayerObservation["currentWolfActions"] {
  const world = queries.world(),
    actorId = request.actorId,
    role = world.getComponent(actorId, COMPONENT.Role),
    roleId = role?.role,
    permissions = wolfTeamPermissions(role, queries.catalog(), world),
    canChat = permissions.canChat === true,
    canVoteForKill = permissions.canVoteForKill === true;
  const current =
    world.getComponent(actorId, COMPONENT.Role) === role &&
    role?.role === roleId &&
    role?.camp === Camp.Wolf &&
    world.getComponent(actorId, COMPONENT.Alive)?.alive === true;
  return current ? { canChat, canVoteForKill } : { canChat: false, canVoteForKill: false };
}

export function capturePlayerObservation(
  request: ActionRequest,
  queries: PlayerObservationQueries,
): PlayerObservation {
  const role = queries.role(() => request.actorId);
  const dead = new Set<number>();
  for (const event of request.context.visible_events) {
    if (
      (event.type === "night_resolved" || event.type === "additional_deaths") &&
      Array.isArray(event.payload.deaths)
    ) {
      for (const id of event.payload.deaths) if (typeof id === "number") dead.add(id);
    }
    const target =
      event.type === "voted_out"
        ? event.payload.target
        : event.type === "wolf_self_destruct"
          ? event.payload.wolfId
          : event.type === "player_shot" ||
              event.type === "hunter_shot" ||
              event.type === "wolf_king_shot" ||
              event.type === "mechanical_shot"
            ? event.payload.targetId
            : undefined;
    if (typeof target === "number") dead.add(target);
    if (event.type === "white_wolf_king_self_destruct") {
      if (typeof event.payload.actorId === "number") dead.add(event.payload.actorId);
      if (typeof event.payload.targetId === "number") dead.add(event.payload.targetId);
    }
    if (event.type === "knight_duel") {
      const victim =
        event.payload.result === "wolf"
          ? event.payload.targetId
          : event.payload.result === "not_wolf"
            ? event.payload.actorId
            : undefined;
      if (typeof victim === "number") dead.add(victim);
    }
  }
  const ownState: PlayerObservation["ownState"] = {};
  if (role?.role === Role.FragrantPhantom && isFragrantPairBoard(queries.world())) {
    const known = fragrantPlayerKnowledge(queries.world(), request.phase, request.context.day);
    if (known.actorId === request.actorId) ownState.fragrantPhantom = known;
  }
  if (isNobleBodyBoard(queries.world())) {
    const known = getNobleBodyPlayerState(queries.world(), request.actorId, request.phase);
    if (known?.kind === "night_noble") ownState.nightNoble = known.state;
    if (known?.kind === "secret_body") ownState.secretBody = known.state;
  }
  const alchemist = projectAlchemist(role),
    raven = projectRaven(role);
  if (alchemist) ownState.alchemist = alchemist;
  if (raven) ownState.ravenClaw = raven;
  const modifier = readModifierState(scholarMentorStateForRole(role));
  if (modifier) ownState.scholarMentor = modifier;
  const timeConsort = projectTimeConsortState(role, request.context.day);
  if (timeConsort) ownState.timeConsort = timeConsort;
  const wolfSorcerer = projectWolfSorcererState(role);
  if (wolfSorcerer) ownState.wolfSorcerer = wolfSorcerer;
  const trickster = projectTricksterState(role);
  if (trickster) ownState.trickster = trickster;
  const prince = projectOrderPrinceState(role);
  if (prince) ownState.orderPrince = prince;
  const magician = projectMagicianState(role);
  if (magician) ownState.magician = magician;
  // 各机制拥有字段裁剪；此处只按原顺序组装，末尾统一脱离并冻结整个观察。
  const redMoon = projectRedMoonState(role);
  if (redMoon) ownState.redMoon = redMoon;
  const nightmare = projectNightmareShadowState(role);
  if (nightmare) ownState.nightmare = nightmare;
  const evilKnight = projectEvilKnightState(role);
  if (evilKnight) ownState.evilKnight = evilKnight;
  const thief = projectThiefState(role, queries.world()),
    choices = projectThiefChoices(queries.world(), request.actorId);
  if (thief) ownState.thief = { ...thief, ...(choices ?? {}) };
  const shape = projectShapeshifterState(role, queries.world()),
    shapeChoices = projectShapeshifterChoices(queries.world(), request.actorId);
  if (shape) ownState.shapeshifter = { ...shape, ...(shapeChoices ?? {}) };
  const wallNote = projectWallNote(queries.world(), request.actorId);
  if (wallNote) ownState.wallNote = wallNote;
  if (debateVoteBlocked(queries.world(), request.actorId, request.context.day))
    ownState.debatePenalty = { day: request.context.day };
  if (role?.role === Role.Debater) {
    const state = getDebaterState(role);
    if (state)
      ownState.debater = projectDebaterState(
        state,
        hasDebateCommit(queries.world(), request.actorId),
      );
  }
  const lover = projectLover(queries.world(), request.actorId);
  if (lover) ownState.lover = lover;
  if (role?.role === Role.Cupid) {
    const state = getCupidState(role);
    if (state) ownState.cupid = projectCupidState(state);
  }
  if (role?.role === Role.BlackMarketMerchant) {
    const state = getBlackMarketState(role);
    if (state) ownState.blackMarket = projectBlackMarketState(state);
  }
  const wedding = weddingActorView(queries.world(), request.actorId);
  if (wedding) ownState.wedding = wedding;
  if (role?.role === Role.GhostBride) {
    const brideState = weddingBrideState(queries.world(), request.actorId);
    if (brideState) ownState.ghostBride = brideState;
  }
  if (role?.role === Role.DemonHunter)
    ownState.demonHunter = projectDemonHunter(queries.world(), role);
  if (role?.role === Role.LonelyGirl)
    ownState.lonelyGirl = projectLonelyGirl(queries.world(), role);
  if (role?.role === Role.WildChild) ownState.wildChild = projectWildChild(queries.world(), role);
  if (role?.role === Role.Hybrid) {
    const state = getHybridState(role);
    if (state) ownState.hybrid = projectHybridState(state);
  }
  if (role?.role === Role.MiracleMerchant) {
    const state = getMerchantState(role);
    if (state) ownState.merchant = projectMerchantState(state);
  }
  if (role?.role === Role.EclipseMaid) ownState.eclipse = projectEclipseState(role);
  const witch = role ? getWitchState(role, request.context.ability_id) : undefined;
  const guard = role ? getGuardState(role, request.context.ability_id) : undefined;
  if (witch) ownState.witch = projectWitchState(witch);
  if (guard) ownState.guard = projectGuardState(guard);
  if (role?.role === Role.Hunter) {
    const state = getHunterState(role);
    if (state) ownState.hunter = projectHunterState(state);
  }
  if (role?.role === Role.WolfBeauty) {
    if (isAnimalDreamBoard(queries.world()))
      ownState.wolfBeauty = animalBeautyKnowledge(queries.world(), request.actorId);
    else {
      const state = getWolfBeautyState(role);
      if (state) ownState.wolfBeauty = projectWolfBeautyState(state);
    }
  }
  if (role?.role === Role.Bear) {
    if (isAnimalDreamBoard(queries.world())) ownState.bear = animalBearKnowledge(queries.world());
    else {
      const state = getBearState(role);
      if (state) ownState.bear = projectBearState(state);
    }
  }
  if (role?.role === Role.FoxCub)
    ownState.foxCub = animalFoxKnowledge(queries.world(), request.actorId);
  if (role?.role === Role.WhiteCat)
    ownState.whiteCat = animalCatKnowledge(queries.world(), request.actorId);
  if (role?.role === Role.Pufferfish)
    ownState.pufferfish = animalPufferKnowledge(queries.world(), request.actorId);
  if (role?.role === Role.HiddenWolf) {
    const state = getHiddenWolfState(role);
    ownState.hiddenWolf = {
      hasInheritedKnife: state?.hasInheritedKnife === true,
      canVoteForKill: canHiddenWolfKnife(role, queries.world()),
      ...(state?.campInspection === "netease_2020_good_v1"
        ? { campInspection: state.campInspection }
        : {}),
    };
  }
  if (role?.role === Role.Gargoyle)
    ownState.gargoyle = {
      hasInheritedKnife: getGargoyleState(role)?.hasInheritedKnife === true,
      canVoteForKill: canGargoyleKnife(role, queries.world()),
    };
  if (role?.role === Role.MechanicalWolf) {
    const state = getMechanicalState(role);
    if (state) ownState.mechanical = projectMechanicalState(state);
  }
  if (role?.role === Role.AwakenedHiddenWolf) {
    const state = getAwakenedState(role);
    if (state) ownState.awakened = projectAwakenedState(state);
  }
  if (role) {
    const inspection = getRoleInspectionState(role, request.context.ability_id);
    if (inspection) ownState.roleInspection = projectRoleInspectionState(inspection);
  }
  if (role?.role === Role.WolfKing) {
    const state = getWolfKingState(role);
    if (state) ownState.wolfKing = projectWolfKingState(state);
  }
  if (role?.role === Role.WhiteWolfKing) {
    const state = getWhiteWolfKingState(role);
    if (state) ownState.whiteWolfKing = projectWhiteWolfKingState(state);
  }
  if (role?.role === Role.Knight) {
    const state = getKnightState(role);
    if (state) ownState.knight = projectKnightState(state);
  }
  if (role?.role === Role.Gravekeeper) {
    const history = getGravekeeperState(role)?.history;
    ownState.gravekeeper = {
      history: Array.isArray(history)
        ? history.flatMap((item) => {
            const report = readGravekeeperReport(item);
            return report ? [report] : [];
          })
        : [],
    };
  }
  if (role?.role === Role.Idiot) {
    const state = getIdiotState(role);
    if (state) ownState.idiot = projectIdiotState(state);
  }
  const seer = role ? getSeerState(role, request.context.ability_id) : undefined;
  if (seer) ownState.seer = projectSeerState(seer);
  const dreamer = role ? getDreamerState(role, request.context.ability_id) : undefined;
  if (dreamer) ownState.dreamer = projectDreamerState(dreamer);
  const {
    wall_id: _wallId,
    death_action_id: _deathActionId,
    debate_id: _debateId,
    ...context
  } = request.context;
  return freezeObservation({
    request: { ...request, context },
    identity: {
      ...(role ? { role: role.role, camp: role.camp } : {}),
      name: queries.world().getComponent(request.actorId, COMPONENT.Identity)?.name,
    },
    knownAliveIds: queries
      .world()
      .entityIds()
      .filter((id) => !dead.has(id)),
    teammateIds: queries.wolfTeammates(() => request.actorId),
    ownState,
    ownNightActions: ownNightActions(queries.world(), request.actorId, request.context.day),
    abilities: allNightAbilities(role).map((ability) =>
      projectNightAbility(ability, request.context.day),
    ),
    deathAbilities: allDeathGuns(role).map(projectDeathGun),
    // 原知识、能力和发布存活字段已在原位置读完；新的自身资格单独捕获，不改写它们。
    currentWolfActions: captureCurrentWolfActions(request, queries),
  });
}
