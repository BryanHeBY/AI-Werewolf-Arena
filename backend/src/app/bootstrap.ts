import { createAliveComponent } from "../domain/components/alive";
import { createBadgeComponent } from "../domain/components/badge";
import { createCampComponent } from "../domain/components/camp";
import { COMPONENT } from "../domain/components/names";
import { createRoleComponent } from "../domain/components/role";
import { createStatusMarksComponent } from "../domain/components/status_marks";
import { createVotingRightComponent } from "../domain/components/voting_right";
import { createIdentityComponent } from "../domain/entities/player";
import { BoardConfig, EntityId, Role } from "../domain/model";
import { ConditionRegistry } from "../domain/registries/condition_registry";
import { RoleRegistry } from "../domain/registries/role_registry";
import { DamageResolutionSystem } from "../domain/systems/damage_resolution_system";
import { WinConditionSystem } from "../domain/systems/win_condition_system";
import { World } from "../domain/world";
import { PhaseManager } from "../engine/phase_manager";
import { ToolGateway } from "../gateway/tool_gateway";

/**
 * bootstrap 负责把“配置”装配成“可运行对局上下文”。
 * 这是服务层启动 V3 引擎的唯一入口。
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
  assignInitialSheriff(world, config, playerIds);

  const roleRegistry = new RoleRegistry();
  const damageResolutionSystem = new DamageResolutionSystem();
  const winSystem = new WinConditionSystem();
  const conditionRegistry = new ConditionRegistry(winSystem);
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

  for (let seat = 1; seat <= config.boardSize; seat++) {
    const entityId = world.createEntity();
    const role = roles[seat - 1];
    const roleComp = createRoleComponent(role);

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

function assignInitialSheriff(
  world: World,
  config: BoardConfig,
  playerIds: EntityId[],
): void {
  if (!config.enableSheriff || config.initialSheriffSeat === undefined) {
    return;
  }

  const sheriffId = playerIds.find((id) => {
    const identity = world.getComponent<{ seat: number }>(id, COMPONENT.Identity);
    return identity?.seat === config.initialSheriffSeat;
  });
  if (!sheriffId) {
    return;
  }

  const badge = world.getComponent<{ isSheriff: boolean; destroyed: boolean }>(
    sheriffId,
    COMPONENT.Badge,
  );
  if (badge) {
    badge.isSheriff = true;
    badge.destroyed = false;
  }

  const voting = world.getComponent<{ weight: number; canVote: boolean }>(
    sheriffId,
    COMPONENT.VotingRight,
  );
  if (voting && voting.canVote) {
    // 警长票权固定提升为 1.5，后续放逐投票直接读取该权重。
    voting.weight = 1.5;
  }
}
