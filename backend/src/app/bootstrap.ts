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
} from "../agents/observation/component-presentation";
import { installNobleBodyAuthority } from "../features/noble-secret-body/authority";
import { installAnimalAuthority } from "../features/animal-dream/authority";
import { buildSupportedRoleDeck } from "../rulesets/supported-role-deck";
import { BoardParameters, bindBoardParameters } from "../rulesets/board-parameters";
import type { RulePlan } from "../rulesets/rule-plan";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { installRadiantEclipseBoard } from "../features/radiant-eclipse/night-frame";
import { installMistRavenBoard } from "../features/mist-raven/night-frame";
import { installScholarMentorBoard } from "../features/scholar-mentor/night-frame";
import { installTimeConsortBoard } from "../features/time-wolf-consort/night-frame";
import { installWolfSorcererBoard } from "../features/wolf-sorcerer/night-frame";
import { installTricksterBoard } from "../features/trickster/night-frame";
import { installOrderPrinceBoard } from "../features/order-prince/authority";
import { installMagicianBoard } from "../features/magician/night-frame";
import { installNightmareBoard } from "../features/nightmare/night-frame";
import { installEvilKnightBoard } from "../features/evil-knight/night-frame";
import { installDemonHunter } from "../features/demon-hunter/authority";
import { WinConditionRegistry as PureWhiteWinRegistry } from "../engine/victory/condition-registry";
import { createEliminationWinConditionSpecs } from "../rulesets/victory/default-specs";
import { installGhostBride } from "../features/ghost-bride/authority";
import { installLonelyGirl } from "../features/lonely-girl/lifecycle";
import { installWildChild } from "../features/wild-child/lifecycle";
import { installInitialRoster } from "../domain/initial-roster";
import { installShapeshifterDeal } from "../features/shapeshifter/deal";
import { installThiefDeal } from "../features/thief/deal";
import { supportsWallRoles } from "../features/wall-notes/authority";
import { text } from "@ai-werewolf-arena/game-text";

import { COMPONENT } from "../domain/components/names";
import type { RoleComponent } from "../domain/components/role";
import { createRoleComponent } from "../agents/observation/role-presentation";

import { createVictoryComponent } from "../domain/components/victory";
import { createIdentityComponent } from "../domain/entities/player";
import { BoardConfig, EntityId, Role } from "../domain/model";
import {
  getDefaultWinConditionRegistry,
  getDefaultRoleCatalog,
  assignInitialSheriff,
  createDefaultRoleRegistry,
} from "../rulesets/mechanism-api";
import { ConditionRegistry } from "../domain/registries/condition-registry";
import { DamageResolutionSystem } from "../domain/systems/damage-resolution-system";
import { World } from "../domain/world";
import { PhaseManager } from "../engine/phase-manager";
import { ToolGateway } from "../engine/actions/tool-gateway";
import { createRandom, shuffled, type RandomSource } from "../domain/random";
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
    // 初始 Camp 是唯一待安装对象；init 可改它，运行 source 则只查询实际 World，不回退 draft。
    const initialCamp = createCampComponent(roleCatalog.getCamp(role), world.locale);
    const roleComp = createRoleComponent(role, world.locale);
    const currentCamp = () => world.getComponent(entityId, COMPONENT.Camp);
    roleCatalog.applyRuntime(roleComp, {
      boardConfig: config,
      locale: world.locale,
      world,
      initialCamp,
      currentCamp,
    });

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
    world.addComponent(entityId, COMPONENT.Camp, initialCamp);
    const membership = roleCatalog.requireRuntime(role).initialVictoryAffiliations;
    world.addComponent(
      entityId,
      COMPONENT.Victory,
      createVictoryComponent(
        typeof membership === "function"
          ? membership(roleComp, {
              boardConfig: config,
              locale: world.locale,
              initialCamp,
              currentCamp,
            })
          : (membership ?? [
              {
                kind: "faction",
                faction: (() => {
                  // 仅默认分支在原字段点晚查；自定义 membership 仍持独立无 World 的上下文。
                  const camp = currentCamp();
                  if (!camp) throw new Error("role_current_camp_missing");
                  return camp.camp;
                })(),
              },
            ]),
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
