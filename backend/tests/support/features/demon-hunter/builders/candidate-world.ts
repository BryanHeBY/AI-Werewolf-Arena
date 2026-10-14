/**
 * 负责构造猎魔人测试的候选、固定板子及显式玩家／标记数据。输入为变体、语言和种子选择；输出保留原数组、库存参数与配置身份。发牌可构造输入身份，期望结果仍为外部手写数据，不运行对局／模型或改变 oracle 算法。
 */
import {
  createCampComponent,
  createAliveComponent,
  createStatusMarksComponent,
  createVotingRightComponent,
  createBadgeComponent,
} from "../../../../../src/game/observation/component-presentation";
import "../../../../../src/app/bootstrap";
import { Role } from "../../../../../src/core";
import { DEMON_HUNTER_ROLE } from "../../../../../src/game/mechanisms/roles/demon_hunter/state-slot";
import { WinCondition } from "../../../../../src/core";
import { ActionWindow } from "../../../../../src/core";
import { WitchSelfHealRule } from "../../../../../src/core";
import type { BoardConfig } from "../../../../../src/core";
import { DEMON_HUNTER_POLICY } from "../../../../../src/game/mechanisms/roles/demon_hunter/state-slot";
import { World } from "../../../../../src/core";
import { Camp } from "../../../../../src/core";
import { COMPONENT } from "../../../../../src/core";
import { createRoleComponent } from "../../../../../src/game/observation/role-presentation";

import { createVictoryComponent } from "../../../../../src/core";

import { createRandom } from "../../../../../src/core";
import type { ToolName } from "../../../../../src/core";
import { createIdentityComponent } from "../../../../../src/core/domain/entities/player";
import { installInitialRoster } from "../../../../../src/core/domain/initial_roster";
import { ConditionRegistry } from "../../../../../src/core/domain/registries/condition_registry";
import { DamageResolutionSystem } from "../../../../../src/core/domain/systems/damage_resolution_system";
import { PhaseManager } from "../../../../../src/game/engine/phase_manager";
import { ToolGateway } from "../../../../../src/game/gateway/tool_gateway";
import { ActionValidator } from "../../../../../src/game/gateway/action_validator";
import { RoleCatalog } from "../../../../../src/game/mechanisms/roles/catalog";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
  createRoleCatalog,
} from "../../../../../src/game/mechanisms/roles/role-catalog-assembly";
import { createDefaultRoleRegistry } from "../../../../../src/game/mechanisms/roles/permissions";
import { getDefaultWinConditionRegistry } from "../../../../../src/game/mechanisms";
import { ToolValidationRuleRegistry } from "../../../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import { installDemonHunter } from "../../../../../src/game/mechanisms/roles/demon_hunter/authority";
import { freshDemonHunterState } from "../../../../../src/game/mechanisms/roles/demon_hunter/state-slot";
import { DEMON_HUNTER_TOOL_RULE } from "../../../../../src/game/mechanisms/roles/demon_hunter/validation_rules";

export function demonHunterDeck(size: 6 | 12): Role[] {
  return size === 6
    ? [Role.Wolf, Role.Wolf, Role.Villager, Role.Seer, Role.Witch, DEMON_HUNTER_ROLE as Role]
    : [
        Role.Wolf,
        Role.Wolf,
        Role.Wolf,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Villager,
        Role.Seer,
        Role.Witch,
        Role.Hunter,
        Role.Guard,
        DEMON_HUNTER_ROLE as Role,
      ];
}

export function demonHunterBoard(size: 6 | 12, goal = WinCondition.SlaughterCity): BoardConfig {
  const deck = demonHunterDeck(size);
  return {
    boardSize: size,
    enableSheriff: size === 12,
    winConditions: [goal],
    roleSetups: [...new Set(deck)].map((role) => ({
      role,
      count: deck.filter((r) => r === role).length,
    })),
    hooks: { onPreElection: true, onPreVote: true, onDaybreak: false, onPerSpeechGap: false },
    selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
    seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
    witch: {
      canSelfHeal: WitchSelfHealRule.Disabled,
      knifeVisibility: "awa_with_heal_v1",
      potionPolicy: "awa_one_native_v1",
    },
    tieBreaker: {
      wolfKillVote: "min_id",
      exileVote: "min_id",
      ...(size === 12 ? { sheriffVote: "min_seat" as const } : {}),
    },
    voting: { exilePolicy: "awa_direct_v1" },
    disclosure: { deathRevealPolicy: "awa_hidden_v1" },
    lastWords: { policy: "awa_initial_wave_v1" },
    ...(size === 12
      ? {
          guard: { repeatPolicy: "netease_consecutive_nights_v1" as const },
          hunter: { deathActionPolicy: "awa_knife_or_exile_v1" as const },
          sheriff: {
            electionPolicy: "awa_final_candidates_v1" as const,
            badgePolicy: "awa_next_seat_v1" as const,
            voteWeight: 1.5,
          },
        }
      : {}),
    ...{ demonHunter: { policy: DEMON_HUNTER_POLICY } },
  };
}

export function demonHunterFixture(
  size: 6 | 12 = 6,
  goal = WinCondition.SlaughterCity,
  locale: "zh-CN" | "en" = "zh-CN",
  damage = new DamageResolutionSystem(),
  faultPlan?: unknown,
) {
  const world = new World(locale),
    config = demonHunterBoard(size, goal),
    deck = demonHunterDeck(size);
  const catalog = createRoleCatalog({
    contributions: [
      ...getDefaultRoleContributions().filter((p) => p.metadata.role !== Role.DemonHunter),
      {
        metadata: {
          role: DEMON_HUNTER_ROLE as Role,
          camp: Camp.Good,
          goodSide: "god",
          label: "Demon Hunter candidate",
          skillBrief: "Candidate",
        },
        runtime: { validationRules: { ["demon_hunt" as ToolName]: DEMON_HUNTER_TOOL_RULE } },
        presentation: { kind: "custom" },
      },
    ],
  });
  for (const kind of deck) {
    const id = world.createEntity(),
      camp = kind === Role.Wolf ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(kind, camp, locale);
    if (String(kind) === DEMON_HUNTER_ROLE)
      (role.privateState as Record<string, unknown>).demonHunter = freshDemonHunterState();
    else getDefaultRoleCatalog().applyRuntime(role, { boardConfig: config, locale, world });
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, id, String(id)));
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp, locale));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent(true, locale));
    world.addComponent(id, COMPONENT.StatusMarks, createStatusMarksComponent(locale));
    world.addComponent(id, COMPONENT.VotingRight, createVotingRightComponent(1, true, locale));
    world.addComponent(id, COMPONENT.Badge, createBadgeComponent(false, false, locale));
  }
  installInitialRoster(world);
  installDemonHunter(world, config);
  const gateway = new ToolGateway(
    new ActionValidator(new ToolValidationRuleRegistry(undefined, catalog)),
  );
  const phaseManager = new PhaseManager(
    world,
    config,
    gateway,
    createDefaultRoleRegistry(catalog),
    new ConditionRegistry(getDefaultWinConditionRegistry()),
    damage,
    createRandom("demon-night-candidate"),
    { faultPlan },
  );
  return {
    world,
    config,
    phaseManager,
    gateway,
    damage,
    demonId: size,
    witchId: size === 6 ? 5 : 9,
    hunterId: size === 12 ? 10 : null,
  };
}
