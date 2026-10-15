/**
 * 单元测试：验证机械狼人捕获枪的原生运行所有权。输入为原内存能力与受控操作；既有字面结果及原枪引用为预期，不运行模型传输或重建 fixture。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT, Camp, Role, Phase, WinCondition, type BoardConfig, type RoleComponent } from "../../../../src/domain";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { getMechanicalState } from "../../../../src/game/mechanisms/roles/mechanical_wolf/state";
import { DeathCause } from "../../../../src/domain/deaths";
import { mechanicalDeathHook } from "../../../../src/game/mechanisms/roles/mechanical_wolf/death_hook";
import {
  advanceMechanicalNight,
  learnMechanicalRole,
} from "../../../../src/game/mechanisms/roles/mechanical_wolf/state";

const deck = [Role.MechanicalWolf, Role.Wolf, Role.Psychic, Role.Witch, Role.Guard, Role.Villager];

function board(roles = deck): BoardConfig {
  return {
    ...sixPlayerMvpConfig,
    boardSize: roles.length,
    roleSetups: [...new Set(roles)].map((role) => ({
      role,
      count: roles.filter((r) => r === role).length,
    })),
    winConditions: [WinCondition.SlaughterCity],
    selfDestruct: { enabledWindows: [] },
  };
}

function fixture(locale: "zh-CN" | "en" = "zh-CN", roles = deck) {
  const config = board(roles),
    game = bootstrapGame(config, { fixedRoles: roles, locale });
  const role = game.world.getComponent(1, COMPONENT.Role)!;
  return { ...game, config, role, state: getMechanicalState(role)! };
}

type Game = ReturnType<typeof fixture>;

for (const revoke of ["camp", "private_state", "owner_state", "learning"] as const)
  test(`${revoke}: an armed mechanical gun stays bound to its original owner and learning through death selection`, async () => {
    const roles = [
        Role.MechanicalWolf,
        Role.Wolf,
        Role.Hunter,
        Role.Witch,
        Role.Guard,
        Role.Villager,
      ],
      game = fixture("en", roles);
    learnMechanicalRole(game.state, 3, Role.Hunter, 1);
    advanceMechanicalNight(game.state, 2);
    game.world.getComponent(1, COMPONENT.Alive)!.alive = false;
    const gun = game.state.learned!.skill,
      events = [] as ReturnType<Game["phaseManager"]["getEvents"]>;
    const permit = game.world.openDeathAction(1, "shoot", Phase.Voting, 2);
    try {
      const result = await mechanicalDeathHook(
        game.world,
        [1],
        { 1: [DeathCause.Exile] },
        async () => {
          if (revoke === "camp") game.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
          if (revoke === "private_state")
            (game.role as { privateState: Readonly<Record<string, unknown>> }).privateState = {
              ...game.role.privateState,
            };
          if (revoke === "owner_state")
            (game.role.privateState as Record<string, unknown>).mechanical_wolf = { ...game.state };
          if (revoke === "learning")
            (
              game.state as {
                learned: import("@ai-werewolf-arena/game-contract").MechanicalReadLearning | null;
              }
            ).learned = { ...game.state.learned! };
          return { kind: "shot", targetId: 4, deathActionId: permit.id };
        },
        events,
      );
      expect(result).toEqual({ extraDeaths: [], extraDeathSources: {} });
      expect(events).toEqual([]);
      expect(gun).toEqual({ kind: "hunter", canShoot: true, armed: true });
    } finally {
      permit.close();
    }
    expect(game.world.activeDeathActionCount).toBe(0);
  });
