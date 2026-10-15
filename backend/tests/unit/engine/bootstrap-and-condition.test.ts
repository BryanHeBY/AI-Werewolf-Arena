/**
 * 单元测试：验证启动时上帝信息与狼人半数条件。输入为原公开板子、有限 World 修改或条件注册表查询；初始玩家字段及阵营结果保留精确字面预期，不执行完整阶段、文件或模型。
 */
import { bindVictoryQueries } from "../../../src/rulesets/victory/default-specs";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import { AliveComponent } from "../../../src/domain/components/alive";
import { RoleComponent } from "../../../src/domain/components/role";
import { Camp, WinCondition } from "../../../src/domain/model";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { ConditionRegistry } from "../../../src/domain/registries/condition-registry";
import { getDefaultWinConditionRegistry } from "../../../src/engine/victory/condition-registry";

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
      return context.world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Good;
    });
    // 6人局初始 2狼4好，击杀两名好人后达到 2狼2好，满足“狼人达半”。
    for (let i = 0; i < 2; i++) {
      const alive = context.world.getComponent(goodIds[i], COMPONENT.Alive);
      if (alive) {
        alive.alive = false;
      }
    }
    const registry = new ConditionRegistry(getDefaultWinConditionRegistry());
    const result = registry.evaluateMany(bindVictoryQueries(context.world), [
      WinCondition.WolfReachHalf,
    ]);
    expect(result?.winner).toBe(Camp.Wolf);
    expect(result?.reason).toBe("wolves_reach_half");
  });
});
