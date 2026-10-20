/**
 * 狼刀场景验证后续预言家或警长请求不能让持有中的伤害杀死已替换目标生命。输入为原替换／
 * 复活矩阵及夜／日移交的真实请求；手写目标存活及公开死亡集合是因果预期，演员／RNG／fixture 不变。
 */
import { createAliveComponent } from "../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Role, WinCondition, COMPONENT, type BoardConfig } from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

const config = (deck: Role[]): BoardConfig => ({
  ...sixPlayerMvpConfig,
  boardSize: deck.length,
  winConditions: [WinCondition.SlaughterSide],
  roleSetups: [...new Set(deck)].map((role) => ({
    role,
    count: deck.filter((r) => r === role).length,
  })),
  selfDestruct: { enabledWindows: [] },
});

for (const mutation of ["revive", "replace_life"] as const)
  test(`${mutation}: later Seer request cannot make Hidden Wolf damage kill a new target life`, async () => {
    const deck = [Role.HiddenWolf, Role.Seer, Role.Bear, Role.Hunter, Role.Villager, Role.Villager],
      game = bootstrapGame(config(deck), { fixedRoles: deck });
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        if (request.allowedTools.includes("check_identity")) {
          if (mutation === "replace_life")
            game.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
          else {
            const life = game.world.getComponent(5, COMPONENT.Alive)!;
            life.alive = false;
            life.alive = true;
          }
          return { name: "check_identity", args: { target_id: 1 } };
        }
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: null, abstain: true } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    expect(
      game.phaseManager.getEvents().filter((e) => e.type === "wolf_kill_vote_cast"),
    ).toHaveLength(1);
    expect(game.world.getComponent(5, COMPONENT.Alive)!.alive).toBe(true);
  });

for (const mutation of ["revive", "replace_life"] as const)
  test(`${mutation}: pending first-day knife damage cannot kill a new life replaced during sheriff nominations`, async () => {
    const deck = [Role.HiddenWolf, Role.Seer, Role.Bear, Role.Hunter, Role.Villager, Role.Villager],
      game = bootstrapGame({ ...config(deck), enableSheriff: true }, { fixedRoles: deck });
    let changed = false;
    await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 1 } };
        if (request.allowedTools.includes("run_for_sheriff")) {
          if (!changed) {
            changed = true;
            if (mutation === "replace_life")
              game.world.addComponent(5, COMPONENT.Alive, createAliveComponent());
            else {
              const life = game.world.getComponent(5, COMPONENT.Alive)!;
              life.alive = false;
              life.alive = true;
            }
          }
          return { name: "run_for_sheriff", args: { run: false } };
        }
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: null, abstain: true } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    expect(changed).toBe(true);
    expect(
      game.phaseManager.getEvents().filter((e) => e.type === "wolf_kill_vote_cast"),
    ).toHaveLength(1);
    expect(
      game.phaseManager
        .getEvents()
        .filter((e) => e.type === "night_resolved")
        .map((e) => e.payload.deaths),
    ).toEqual([[]]);
    expect(game.world.getAliveEntityIds()).toEqual([1, 2, 3, 4, 5, 6]);
  });
