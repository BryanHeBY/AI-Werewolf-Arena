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
import { BoardConfig, EntityId, Role } from "../core/domain/model";
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
}

/**
 * 按板子配置完成一次完整引擎装配，返回可直接运行的上下文对象。
 */
export function bootstrapGame(config: BoardConfig, options: BootstrapOptions = {}): BootstrapResult {
  const world = new World(options.locale);
  const random = options.random ?? createRandom();
  // 先完成实体与组件初始化，再创建系统与管理器，避免空引用。
  const playerIds = createPlayers(world, config, options, random);
  assignInitialSheriff(world, config, playerIds);

  const roleRegistry = createDefaultRoleRegistry();
  const damageResolutionSystem = new DamageResolutionSystem();
  const conditionRegistry = new ConditionRegistry(getDefaultWinConditionRegistry());
  const toolGateway = new ToolGateway();

  const phaseManager = new PhaseManager(
    world,
    config,
    toolGateway,
    roleRegistry,
    conditionRegistry,
    damageResolutionSystem,
    random,
  );

  return {
    world,
    phaseManager,
    playerIds,
    random,
    dealMode: options.fixedRoles ? "fixed" : "random",
  };
}

function createPlayers(world: World, config: BoardConfig, options: BootstrapOptions, random: RandomSource): EntityId[] {
  const roles = buildRoleDeck(config, options.fixedRoles, random.fork("deal"));
  const ids: EntityId[] = [];
  const roleCatalog = getDefaultRoleCatalog();

  for (let seat = 1; seat <= config.boardSize; seat++) {
    const entityId = world.createEntity();
    const role = roles[seat - 1];
    const roleComp = createRoleComponent(role, roleCatalog.getCamp(role), world.locale);
    roleCatalog.applyRuntime(roleComp, { boardConfig: config, locale: world.locale });

    world.addComponent(
      entityId,
      COMPONENT.Identity,
      createIdentityComponent(entityId, seat, options.playerNames?.[String(seat)] ?? text(world.locale, "common.player_name", { id: seat })),
    );
    world.addComponent(entityId, COMPONENT.Role, roleComp);
    world.addComponent(entityId, COMPONENT.Camp, createCampComponent(roleComp.camp, world.locale));
    const membership = roleCatalog.require(role).initialVictoryAffiliations;
    world.addComponent(entityId, COMPONENT.Victory, createVictoryComponent(typeof membership === "function" ? membership(roleComp, { boardConfig: config, locale: world.locale }) : membership ?? [{ kind: "faction", faction: roleComp.camp }]));
    world.addComponent(entityId, COMPONENT.Alive, createAliveComponent(true, world.locale));
    world.addComponent(entityId, COMPONENT.StatusMarks, createStatusMarksComponent(world.locale));
    world.addComponent(entityId, COMPONENT.VotingRight, createVotingRightComponent(1, true, world.locale));
    world.addComponent(entityId, COMPONENT.Badge, createBadgeComponent(false, false, world.locale));
    ids.push(entityId);
  }

  return ids;
}

function buildRoleDeck(config: BoardConfig, fixedRoles: readonly Role[] | undefined, random: RandomSource): Role[] {
  const deck: Role[] = [];
  for (const setup of config.roleSetups) {
    for (let i = 0; i < setup.count; i++) {
      deck.push(setup.role);
    }
  }

  const counts=new Map<Role,number>();
  for(const role of deck)counts.set(role,(counts.get(role)??0)+1);
  for(const [role,count] of counts){const maximum=getDefaultRoleCatalog().require(role).maxCount;if(maximum!==undefined&&count>maximum)throw new Error(`role_count_exceeds_limit: ${role}`);}

  if (deck.length !== config.boardSize) {
    throw new Error(
      `Role setup mismatch: boardSize=${config.boardSize}, roles=${deck.length}`,
    );
  }

  if (fixedRoles) {
    if (fixedRoles.length !== deck.length || [...fixedRoles].sort().join(",") !== [...deck].sort().join(",")) throw new Error("fixed_role_deck_mismatch");
    return [...fixedRoles];
  }
  return shuffled(deck, random);
}
