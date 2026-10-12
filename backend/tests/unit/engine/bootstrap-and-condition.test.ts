/**
 * Unit tests verify bootstrap initial God information and Wolf-half condition selection under the original PhaseManager describe prefix.
 * Input: Original public boards and bounded world state edits or condition registry query.
 * Output and oracle: Exact initial player fields and literal faction outcome remain unchanged; no full phase, filesystem or model runs.
 */
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { AliveComponent } from "../../../src/core/domain/components/alive";
import { RoleComponent } from "../../../src/core/domain/components/role";
import { Camp, WinCondition } from "../../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { ConditionRegistry } from "../../../src/core/domain/registries/condition_registry";
import { getDefaultWinConditionRegistry } from "../../../src/game/mechanisms/registries/win_condition_registry";

describe("PhaseManager", () => {
  test("bootstrap should emit god_private_game_info as initial event", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const events = context.phaseManager.getEvents();
    const init = events.find((event) => event.type === "god_private_game_info");

    expect(init).toBeTruthy();
    const players = Array.isArray(init?.payload.players) ? init?.payload.players : [];
    expect(players.length).toBe(sixPlayerMvpConfig.boardSize);
    expect(
      players.every(
        (item: any) =>
          typeof item.seat === "number" &&
          typeof item.role === "string" &&
          typeof item.camp === "string",
      ),
    ).toBe(true);
  });

  test("wolf_reach_half condition should trigger wolf win when wolves equal good", async () => {
    const context = bootstrapGame(sixPlayerMvpConfig);
    const aliveIds = context.world.getAliveEntityIds();
    const goodIds = aliveIds.filter((id) => {
      const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
      return role?.camp === Camp.Good;
    });
    // 6人局初始 2狼4好，击杀两名好人后达到 2狼2好，满足“狼人达半”。
    for (let i = 0; i < 2; i++) {
      const alive = context.world.getComponent<AliveComponent>(goodIds[i], COMPONENT.Alive);
      if (alive) {
        alive.alive = false;
      }
    }
    const registry = new ConditionRegistry(getDefaultWinConditionRegistry());
    const result = registry.evaluateMany(context.world, [WinCondition.WolfReachHalf]);
    expect(result?.winner).toBe(Camp.Wolf);
    expect(result?.reason).toBe("wolves_reach_half");
  });
});
