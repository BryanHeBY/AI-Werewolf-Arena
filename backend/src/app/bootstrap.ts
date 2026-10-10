import { isNightmarePreset } from "@ai-werewolf-arena/game-text";
import { installNightmareBoard } from "../game/mechanisms/roles/nightmare_shadow/night_frame";
import { isEvilKnightPreset } from "@ai-werewolf-arena/game-text";
import { installEvilKnightBoard } from "../game/mechanisms/roles/evil_knight/night_frame";
import { installDemonHunter } from "../game/mechanisms/roles/demon_hunter/authority";
import { isPureWhitePreset } from "@ai-werewolf-arena/game-text";
import { WinConditionRegistry as PureWhiteWinRegistry } from "../game/mechanisms/registries/win_condition_registry";
import { createEliminationWinConditionSpecs } from "../game/mechanisms/win_conditions/default_specs";
import { assertDemonHunterPreset } from "../game/mechanisms/roles/demon_hunter/preset";
import { installGhostBride } from "../game/mechanisms/roles/ghost_bride/authority";
import { assertGhostBridePreset } from "../game/mechanisms/roles/ghost_bride/preset";
import { installLonelyGirl } from "../game/mechanisms/roles/lonely_girl/lifecycle";
import { installWildChild } from "../game/mechanisms/roles/wild_child/lifecycle";
import { installInitialRoster } from "../core/domain/initial_roster";
import { installShapeshifterDeal } from "../game/mechanisms/roles/shapeshifter/deal";
import { installThiefDeal } from "../game/mechanisms/roles/thief/deal";
import { supportsWallRoles } from "../game/mechanisms/events/wall_notes/authority";
import { text } from "@ai-werewolf-arena/game-text";
import { createAliveComponent } from "../core/domain/components/alive";
import { createBadgeComponent } from "../core/domain/components/badge";
import { createCampComponent } from "../core/domain/components/camp";
import { COMPONENT } from "../core/domain/components/names";
import { createRoleComponent } from "../core/domain/components/role";
import { createStatusMarksComponent } from "../core/domain/components/status_marks";
import { createVotingRightComponent } from "../core/domain/components/voting_right";
import { createVictoryComponent } from "../core/domain/components/victory";
import { createIdentityComponent } from "../core/domain/entities/player";
import { BoardConfig, EntityId, Role, Camp, WinCondition } from "../core/domain/model";
import {
  getDefaultWinConditionRegistry,
  getDefaultRoleCatalog,
  assignInitialSheriff,
  createDefaultRoleRegistry,
} from "../game/mechanisms";
import { ConditionRegistry } from "../core/domain/registries/condition_registry";
import { DamageResolutionSystem } from "../core/domain/systems/damage_resolution_system";
import { World } from "../core/domain/world";
import { PhaseManager } from "../game/engine/phase_manager";
import { ToolGateway } from "../game/gateway/tool_gateway";
import { createRandom, shuffled, type RandomSource } from "../core/domain/random";
import type { Locale } from "@ai-werewolf-arena/game-catalog";

/**
 * bootstrap 负责把“配置”装配成“可运行对局上下文”。
 * 这是服务层启动游戏引擎的唯一入口。
 */
export interface BootstrapResult {
  world: World;
  phaseManager: PhaseManager;
  playerIds: EntityId[];
  random: RandomSource;
  dealMode: "random" | "fixed";
}

export interface BootstrapOptions {
  locale?: Locale;
  playerNames?: Readonly<Record<string, string>>;
  random?: RandomSource;
  /** Controller fixture only: exact deck multiplicities are still validated. */
  fixedRoles?: readonly Role[];
  /** Explicit offline causal test input, never a board or model parameter. */
  faultPlan?: unknown;
}

/**
 * 按板子配置完成一次完整引擎装配，返回可直接运行的上下文对象。
 */
export function bootstrapGame(
  config: BoardConfig,
  options: BootstrapOptions = {},
): BootstrapResult {
  const world = new World(options.locale);
  const random = options.random ?? createRandom();
  // 先完成实体与组件初始化，再创建系统与管理器，避免空引用。
  const playerIds = createPlayers(world, config, options, random);
  assignInitialSheriff(world, config, playerIds);

  const roleRegistry = createDefaultRoleRegistry();
  const damageResolutionSystem = new DamageResolutionSystem();
  const conditionRegistry = new ConditionRegistry(
    config.pureWhite
      ? new PureWhiteWinRegistry(
          createEliminationWinConditionSpecs(config.pureWhite.eliminationPriority),
        )
      : getDefaultWinConditionRegistry(),
  );
  const toolGateway = new ToolGateway();

  const phaseManager = new PhaseManager(
    world,
    config,
    toolGateway,
    roleRegistry,
    conditionRegistry,
    damageResolutionSystem,
    random,
    { faultPlan: options.faultPlan },
  );

  return {
    world,
    phaseManager,
    playerIds,
    random,
    dealMode: options.fixedRoles ? "fixed" : "random",
  };
}

function createPlayers(
  world: World,
  config: BoardConfig,
  options: BootstrapOptions,
  random: RandomSource,
): EntityId[] {
  const roles = buildRoleDeck(config, options.fixedRoles, random.fork("deal"));
  const ids: EntityId[] = [];
  const roleCatalog = getDefaultRoleCatalog();

  for (let seat = 1; seat <= config.boardSize; seat++) {
    const entityId = world.createEntity();
    const role = roles[seat - 1];
    const roleComp = createRoleComponent(role, roleCatalog.getCamp(role), world.locale);
    roleCatalog.applyRuntime(roleComp, { boardConfig: config, locale: world.locale, world });

    world.addComponent(
      entityId,
      COMPONENT.Identity,
      createIdentityComponent(
        entityId,
        seat,
        options.playerNames?.[String(seat)] ??
          text(world.locale, "common.player_name", { id: seat }),
      ),
    );
    world.addComponent(entityId, COMPONENT.Role, roleComp);
    world.addComponent(entityId, COMPONENT.Camp, createCampComponent(roleComp.camp, world.locale));
    const membership = roleCatalog.require(role).initialVictoryAffiliations;
    world.addComponent(
      entityId,
      COMPONENT.Victory,
      createVictoryComponent(
        typeof membership === "function"
          ? membership(roleComp, { boardConfig: config, locale: world.locale })
          : (membership ?? [{ kind: "faction", faction: roleComp.camp }]),
      ),
    );
    world.addComponent(entityId, COMPONENT.Alive, createAliveComponent(true, world.locale));
    world.addComponent(entityId, COMPONENT.StatusMarks, createStatusMarksComponent(world.locale));
    world.addComponent(
      entityId,
      COMPONENT.VotingRight,
      createVotingRightComponent(1, true, world.locale),
    );
    world.addComponent(entityId, COMPONENT.Badge, createBadgeComponent(false, false, world.locale));
    ids.push(entityId);
  }

  if (config.roleSetups.some((row) => row.role === Role.Thief && row.count === 1))
    installThiefDeal(world, roles, ids);
  if (config.roleSetups.some((row) => row.role === Role.Shapeshifter && row.count === 1))
    installShapeshifterDeal(world, roles, ids);
  installInitialRoster(world);
  if (roles.includes(Role.EvilKnight)) installEvilKnightBoard(world);
  if (roles.includes(Role.NightmareShadow)) installNightmareBoard(world);
  if (roles.includes(Role.DemonHunter)) installDemonHunter(world, config);
  if (roles.includes(Role.GhostBride)) installGhostBride(world, config);
  installWildChild(world, config);
  installLonelyGirl(world, config);
  return ids;
}

function buildRoleDeck(
  config: BoardConfig,
  fixedRoles: readonly Role[] | undefined,
  random: RandomSource,
): Role[] {
  if (
    (config.nightmareShadow ||
      config.roleSetups.some((row) => row.role === Role.NightmareShadow && row.count > 0)) &&
    !isNightmarePreset(config)
  )
    throw new Error("nightmare_preset_invalid");
  if (
    (config.evilKnight ||
      config.roleSetups.some((row) => row.role === Role.EvilKnight && row.count > 0)) &&
    !isEvilKnightPreset(config)
  )
    throw new Error("evil_knight_preset_invalid");
  if (
    (config.pureWhite ||
      config.wolfWitch ||
      config.roleSetups.some(
        (row) => (row.role === Role.PureWhiteGirl || row.role === Role.WolfWitch) && row.count > 0,
      )) &&
    !isPureWhitePreset(config)
  )
    throw new Error("pure_white_preset_invalid");
  if (
    config.roleSetups.some((row) => row.role === Role.DemonHunter && row.count > 0) ||
    config.demonHunter
  )
    assertDemonHunterPreset(config);
  const ownsGhost = config.roleSetups.some((row) => row.role === Role.GhostBride && row.count > 0);
  if (
    ownsGhost ||
    config.ghostBride ||
    config.winConditions?.includes(WinCondition.ThreeFactionsElimination) ||
    config.winCondition === WinCondition.ThreeFactionsElimination
  )
    assertGhostBridePreset(config);
  const deck: Role[] = [];
  for (const setup of config.roleSetups) {
    for (let i = 0; i < setup.count; i++) {
      deck.push(setup.role);
    }
  }

  if (
    config.events &&
    (!supportsWallRoles(deck) || config.events.pack !== "awa_wall_notes_once_v1")
  )
    throw new Error("event_pack_combination_not_supported");
  const counts = new Map<Role, number>();
  for (const role of deck) counts.set(role, (counts.get(role) ?? 0) + 1);
  for (const [role, count] of counts) {
    const maximum = getDefaultRoleCatalog().require(role).maxCount;
    if (maximum !== undefined && count > maximum)
      throw new Error(`role_count_exceeds_limit: ${role}`);
  }
  for (const role of counts.keys()) {
    const profile = getDefaultRoleCatalog().require(role);
    const conditions = config.winConditions?.length
      ? config.winConditions
      : [config.winCondition ?? WinCondition.SlaughterCity];
    if (
      profile.supportedWinConditions &&
      (new Set(conditions).size !== conditions.length ||
        conditions.some((condition) => !profile.supportedWinConditions!.includes(condition)))
    )
      throw new Error(`role_win_condition_not_supported: ${role}`);
    const supported = profile.supportedBoardRoles;
    if (supported && [...counts.keys()].some((candidate) => !supported.includes(candidate)))
      throw new Error(`role_combination_not_supported: ${role}`);
  }

  if (deck.length !== config.boardSize) {
    throw new Error(`Role setup mismatch: boardSize=${config.boardSize}, roles=${deck.length}`);
  }

  if (
    config.thief &&
    (!counts.has(Role.Thief) || config.thief.policy !== "lui_meme_thief_two_extra_villagers_v1")
  )
    throw new Error("thief_policy_invalid");
  if (
    config.lonelyGirl &&
    (!counts.has(Role.LonelyGirl) || config.lonelyGirl.policy !== "awa_netease_lonely_girl_v1")
  )
    throw new Error("lonely_girl_policy_invalid");
  if (
    counts.has(Role.LonelyGirl) &&
    (config.boardSize < 6 ||
      !counts.has(Role.Wolf) ||
      ![...counts.keys()].some(
        (role) => role !== Role.LonelyGirl && getDefaultRoleCatalog().getCamp(role) === Camp.Good,
      ))
  )
    throw new Error("lonely_girl_finite_composition_required");
  if (
    config.wildChild &&
    (!counts.has(Role.WildChild) || config.wildChild.policy !== "awa_lui_meme_wild_child_v1")
  )
    throw new Error("wild_child_policy_invalid");
  if (
    counts.has(Role.WildChild) &&
    ((counts.get(Role.Wolf) ?? 0) < 1 ||
      [...counts]
        .filter(
          ([role]) =>
            role !== Role.WildChild && getDefaultRoleCatalog().getCamp(role) === Camp.Good,
        )
        .reduce((n, [, count]) => n + count, 0) < 1)
  )
    throw new Error("wild_child_finite_composition_required");
  if (
    config.shapeshifter &&
    (!counts.has(Role.Shapeshifter) ||
      config.shapeshifter.policy !== "awa_netease_shapeshifter_two_extra_villagers_v1")
  )
    throw new Error("shapeshifter_policy_invalid");
  if (counts.has(Role.Shapeshifter)) {
    if (
      config.boardSize < 6 ||
      (counts.get(Role.Wolf) ?? 0) < 2 ||
      [...counts]
        .filter(
          ([role]) =>
            role !== Role.Shapeshifter && getDefaultRoleCatalog().getCamp(role) === Camp.Good,
        )
        .reduce((n, [, count]) => n + count, 0) < 1
    )
      throw new Error("shapeshifter_finite_composition_required");
    deck.push(Role.Villager, Role.Villager);
  }
  if (counts.has(Role.Thief)) {
    if (
      (counts.get(Role.Wolf) ?? 0) < 2 ||
      [...counts]
        .filter(
          ([role]) => role !== Role.Thief && getDefaultRoleCatalog().getCamp(role) === Camp.Good,
        )
        .reduce((n, [, count]) => n + count, 0) < 2
    )
      throw new Error("thief_finite_composition_required");
    deck.push(Role.Villager, Role.Villager);
  }
  if (fixedRoles) {
    if (
      fixedRoles.length !== deck.length ||
      [...fixedRoles].sort().join(",") !== [...deck].sort().join(",")
    )
      throw new Error("fixed_role_deck_mismatch");
    return [...fixedRoles];
  }
  return shuffled(deck, random);
}
