/**
 * 负责：从原配置与显式选项装配 World、角色组件、机制和真实游戏运行时。
 * 输入：BoardConfig、角色与随机源选项；输出：原初始化对象及同一参数和 RulePlan owner。
 * 先在原 deal fork 后验证支持范围并洗牌，再初始化实体；不读取模型认证或选择玩家动作。
 * 校验后的配置克隆在角色初始化前冻结，原 World、actor、RNG 和调用方均不冻结。
 * PhaseManager 创建规则计划，流水线、开局上下文和记录入口消费同一引用。
 */
import {
  createAliveComponent,
  createBadgeComponent,
  createCampComponent,
  createStatusMarksComponent,
  createVotingRightComponent,
} from "../game/observation/component-presentation";
import { installNobleBodyAuthority } from "../game/mechanisms/roles/noble_secret_body/authority";
import { installAnimalAuthority } from "../game/mechanisms/roles/animal_dream/authority";
import { buildSupportedRoleDeck } from "../rulesets/supported-role-deck";
import { BoardParameters, bindBoardParameters } from "../rulesets/board-parameters";
import type { RulePlan } from "../rulesets/rule-plan";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { installRadiantEclipseBoard } from "../game/mechanisms/roles/radiant_eclipse/night_frame";
import { installMistRavenBoard } from "../game/mechanisms/roles/mist_raven/night_frame";
import { installScholarMentorBoard } from "../game/mechanisms/roles/scholar_mentor/night_frame";
import { installTimeConsortBoard } from "../game/mechanisms/roles/time_wolf_consort/night_frame";
import { installWolfSorcererBoard } from "../game/mechanisms/roles/wolf_sorcerer/night_frame";
import { installTricksterBoard } from "../game/mechanisms/roles/trickster/night_frame";
import { installOrderPrinceBoard } from "../game/mechanisms/roles/order_prince/authority";
import { installMagicianBoard } from "../game/mechanisms/roles/magician/night_frame";
import { installNightmareBoard } from "../game/mechanisms/roles/nightmare_shadow/night_frame";
import { installEvilKnightBoard } from "../game/mechanisms/roles/evil_knight/night_frame";
import { installDemonHunter } from "../game/mechanisms/roles/demon_hunter/authority";
import { WinConditionRegistry as PureWhiteWinRegistry } from "../game/mechanisms/registries/win_condition_registry";
import { createEliminationWinConditionSpecs } from "../game/mechanisms/win_conditions/default_specs";
import { installGhostBride } from "../game/mechanisms/roles/ghost_bride/authority";
import { installLonelyGirl } from "../game/mechanisms/roles/lonely_girl/lifecycle";
import { installWildChild } from "../game/mechanisms/roles/wild_child/lifecycle";
import { installInitialRoster } from "../core/domain/initial_roster";
import { installShapeshifterDeal } from "../game/mechanisms/roles/shapeshifter/deal";
import { installThiefDeal } from "../game/mechanisms/roles/thief/deal";
import { supportsWallRoles } from "../game/mechanisms/events/wall_notes/authority";
import { text } from "@ai-werewolf-arena/game-text";

import { COMPONENT } from "../core/domain/components/names";
import type { RoleComponent } from "../core/domain/components/role";
import { createRoleComponent } from "../game/observation/role-presentation";

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
import type { Locale } from "@ai-werewolf-arena/game-contract";

/**
 * bootstrap 负责把“配置”装配成“可运行对局上下文”。
 * 这是服务层启动游戏引擎的唯一入口。
 */
export interface BootstrapResult {
  world: World;
  readonly boardConfig: ReadonlyBoardConfig;
  readonly parameters: BoardParameters;
  readonly rulePlan: RulePlan;
  phaseManager: PhaseManager;
  playerIds: EntityId[];
  random: RandomSource;
  dealMode: "random" | "fixed";
}

export interface BootstrapOptions {
  locale?: Locale;
  playerNames?: Readonly<Record<string, string>>;
  random?: RandomSource;
  /** 仅供 controller fixture：明确牌堆仍按原数量严格验证。 */
  fixedRoles?: readonly Role[];
  /** 显式离线因果测试输入，不是板子或模型参数。 */
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
  const initialized = createPlayers(world, config, options, random);
  const playerIds = initialized.playerIds;
  const parameters = initialized.parameters;
  const boardConfig = parameters.board;
  assignInitialSheriff(world, boardConfig, playerIds);

  const roleRegistry = createDefaultRoleRegistry();
  const damageResolutionSystem = new DamageResolutionSystem();
  const conditionRegistry = new ConditionRegistry(
    boardConfig.pureWhite || boardConfig.animalDream
      ? new PureWhiteWinRegistry(
          createEliminationWinConditionSpecs(
            boardConfig.pureWhite?.eliminationPriority ?? "awa_wolf_priority_v1",
          ),
        )
      : getDefaultWinConditionRegistry(),
  );
  const toolGateway = new ToolGateway();

  const phaseManager = new PhaseManager(
    world,
    boardConfig,
    toolGateway,
    roleRegistry,
    conditionRegistry,
    damageResolutionSystem,
    random,
    { faultPlan: options.faultPlan },
  );

  return Object.freeze({
    world,
    boardConfig,
    parameters,
    rulePlan: phaseManager.getRulePlan(),
    phaseManager,
    playerIds,
    random,
    dealMode: options.fixedRoles ? "fixed" : "random",
  });
}

function createPlayers(
  world: World,
  inputConfig: BoardConfig,
  options: BootstrapOptions,
  random: RandomSource,
): { playerIds: EntityId[]; parameters: BoardParameters } {
  const fixedRoles = options.fixedRoles;
  const dealRandom = random.fork("deal");
  const candidateParameters = BoardParameters.compile(inputConfig);
  const config = candidateParameters.board;
  const roles = buildRoleDeck(config, fixedRoles, dealRandom);
  const parameters = bindBoardParameters(world, candidateParameters);
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
    const membership = roleCatalog.requireRuntime(role).initialVictoryAffiliations;
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
  if (config.animalDream) installAnimalAuthority(world, config);
  if (roles.includes(Role.Alchemist) || roles.includes(Role.RavenClawWolf))
    installMistRavenBoard(world);
  if (config.radiantEclipse) installRadiantEclipseBoard(world);
  if (roles.includes(Role.DayScholar) || roles.includes(Role.NightMentor))
    installScholarMentorBoard(world);
  if (roles.includes(Role.TimeWolfConsort)) installTimeConsortBoard(world);
  if (roles.includes(Role.Trickster)) installTricksterBoard(world);
  if (roles.includes(Role.Magician)) installMagicianBoard(world);
  if (roles.includes(Role.WolfSorcerer)) installWolfSorcererBoard(world);
  if (roles.includes(Role.OrderPrince)) installOrderPrinceBoard(world);
  if (roles.includes(Role.EvilKnight)) installEvilKnightBoard(world);
  if (roles.includes(Role.NightmareShadow)) installNightmareBoard(world);
  if (config.nobleSecretBody)
    installNobleBodyAuthority(
      world,
      ids.find((id) => world.getComponent(id, COMPONENT.Role)?.role === Role.NightNoble)!,
      ids.find((id) => world.getComponent(id, COMPONENT.Role)?.role === Role.AwakenedIdiot)!,
    );
  if (roles.includes(Role.DemonHunter)) installDemonHunter(world, config);
  if (roles.includes(Role.GhostBride)) installGhostBride(world, config);
  installWildChild(world, config);
  installLonelyGirl(world, config);
  return { playerIds: ids, parameters };
}

function buildRoleDeck(
  config: ReadonlyBoardConfig,
  fixedRoles: readonly Role[] | undefined,
  random: RandomSource,
): Role[] {
  const deck = buildSupportedRoleDeck(config, fixedRoles, getDefaultRoleCatalog, supportsWallRoles);
  return fixedRoles ? deck : shuffled(deck, random);
}
