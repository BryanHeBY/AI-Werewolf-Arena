import { createAliveComponent } from "../core/domain/components/alive";
import { createBadgeComponent } from "../core/domain/components/badge";
import { createCampComponent } from "../core/domain/components/camp";
import { COMPONENT } from "../core/domain/components/names";
import { createRoleComponent } from "../core/domain/components/role";
import { createStatusMarksComponent } from "../core/domain/components/status_marks";
import { createVotingRightComponent } from "../core/domain/components/voting_right";
import { createIdentityComponent } from "../core/domain/entities/player";
import { BoardConfig, EntityId, Role } from "../core/domain/model";
import {
  getDefaultWinConditionRegistry,
  getDefaultRoleCampRegistry,
  getDefaultRoleRuntimeRegistry,
  getDefaultSheriffMechanism,
  RoleSpecRegistry,
} from "../game/mechanisms";
import { ConditionRegistry } from "../core/domain/registries/condition_registry";
import { RoleRegistry } from "../core/domain/registries/role_registry";
import { DamageResolutionSystem } from "../core/domain/systems/damage_resolution_system";
import { World } from "../core/domain/world";
import { PhaseManager } from "../game/engine/phase_manager";
import { ToolGateway } from "../game/gateway/tool_gateway";

/**
 * bootstrap 负责把“配置”装配成“可运行对局上下文”。
 * 这是服务层启动游戏引擎的唯一入口。
 */
export interface BootstrapResult {
  world: World;
  phaseManager: PhaseManager;
  playerIds: EntityId[];
}

/**
 * 按板子配置完成一次完整引擎装配，返回可直接运行的上下文对象。
 */
export function bootstrapGame(config: BoardConfig): BootstrapResult {
  const world = new World();
  // 先完成实体与组件初始化，再创建系统与管理器，避免空引用。
  const playerIds = createPlayers(world, config);
  getDefaultSheriffMechanism().assignInitialSheriff(world, config, playerIds);

  const roleRegistry = new RoleRegistry();
  const roleSpecRegistry = new RoleSpecRegistry();
  for (const spec of roleSpecRegistry.all()) {
    roleRegistry.registerAllowedTools(spec.role, spec.allowedTools);
  }
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
  );

  return {
    world,
    phaseManager,
    playerIds,
  };
}

function createPlayers(world: World, config: BoardConfig): EntityId[] {
  const roles = buildRoleDeck(config);
  const ids: EntityId[] = [];
  const roleRuntimeRegistry = getDefaultRoleRuntimeRegistry();
  const roleCampRegistry = getDefaultRoleCampRegistry();

  for (let seat = 1; seat <= config.boardSize; seat++) {
    const entityId = world.createEntity();
    const role = roles[seat - 1];
    const roleComp = createRoleComponent(role, roleCampRegistry.get(role));
    roleRuntimeRegistry.apply(roleComp, { boardConfig: config });

    world.addComponent(
      entityId,
      COMPONENT.Identity,
      createIdentityComponent(entityId, seat, `玩家${seat}`),
    );
    world.addComponent(entityId, COMPONENT.Role, roleComp);
    world.addComponent(entityId, COMPONENT.Camp, createCampComponent(roleComp.camp));
    world.addComponent(entityId, COMPONENT.Alive, createAliveComponent(true));
    world.addComponent(entityId, COMPONENT.StatusMarks, createStatusMarksComponent());
    world.addComponent(entityId, COMPONENT.VotingRight, createVotingRightComponent(1, true));
    world.addComponent(entityId, COMPONENT.Badge, createBadgeComponent(false, false));

    ids.push(entityId);
  }

  return ids;
}

function buildRoleDeck(config: BoardConfig): Role[] {
  const deck: Role[] = [];
  for (const setup of config.roleSetups) {
    for (let i = 0; i < setup.count; i++) {
      deck.push(setup.role);
    }
  }

  if (deck.length !== config.boardSize) {
    throw new Error(
      `Role setup mismatch: boardSize=${config.boardSize}, roles=${deck.length}`,
    );
  }

  // 开局角色牌堆随机洗牌，避免 seat 与角色配置顺序强绑定。
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}
