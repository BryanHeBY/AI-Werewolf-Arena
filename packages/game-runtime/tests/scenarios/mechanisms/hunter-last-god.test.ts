/**
 * 猎人死亡场景测试：验证跨目标政策和双语的最后神枪结算先于唯一好人终局。输入为固定身份、受控前置死亡和真实 PM 狼刀／枪请求；手写结果、枪次数及事件次序保留原因果链，不重生预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, DeathCause, Phase, Role, WinCondition } from "../../../src/domain";
import { twelvePlayerStandardConfig } from "../../../src/rulesets/presets/twelve-player-standard";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

const roles = [
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Hunter,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];

const fixture = (locale: "zh-CN" | "en", winCondition = WinCondition.SlaughterCity) =>
  bootstrapGame(
    { ...twelvePlayerStandardConfig, winConditions: [winCondition] },
    { locale, fixedRoles: roles },
  );

const dead = (world: ReturnType<typeof fixture>["world"], id: number) => {
  world.getComponent(id, COMPONENT.Alive)!.alive = false;
};

for (const locale of ["zh-CN", "en"] as const)
  for (const mode of [
    WinCondition.SlaughterCity,
    WinCondition.SlaughterSide,
    WinCondition.WolfReachHalf,
  ])
    test(`${locale}: PhaseManager resolves the last god's gun and then seals a good victory (${mode})`, async () => {
      const game = bootstrapGame(
        {
          ...sixPlayerMvpConfig,
          selfDestruct: { enabledWindows: [] },
          winConditions: [mode],
          roleSetups: [
            { role: Role.Wolf, count: 1 },
            { role: Role.Hunter, count: 1 },
            { role: Role.Villager, count: 4 },
          ],
        },
        {
          locale,
          fixedRoles: [
            Role.Wolf,
            Role.Hunter,
            Role.Villager,
            Role.Villager,
            Role.Villager,
            Role.Villager,
          ],
        },
      );
      // City／half 在狼刀后也会到达看似终局的状态；Side 保留存活平民。
      if (mode !== WinCondition.SlaughterSide) for (const id of [3, 4, 5, 6]) dead(game.world, id);
      let shots = 0;
      const result = await game.phaseManager.runSingleCycle({
        async getAction(request) {
          if (request.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: 2, abstain: false } };
          if (request.allowedTools.includes("shoot")) {
            shots++;
            expect(game.phaseManager.getSnapshot().gameOver).toBe(false);
            expect(request.context.death_sources).toEqual([DeathCause.WolfKill]);
            return { name: "shoot", args: { target_id: 1 } };
          }
          return null;
        },
      });
      expect(shots).toBe(1);
      expect(result.result).toEqual({
        winner: Camp.Good,
        reason: "all_wolves_eliminated",
        outcome: {
          kind: "victory",
          primary: { kind: "faction", faction: "good", winningPlayerIds: [2, 3, 4, 5, 6] },
          additional: [],
          winningPlayerIds: [2, 3, 4, 5, 6],
        },
        decidedAt: { day: 1, phase: Phase.Day, checkpoint: "night_settled" },
      });
      const events = game.phaseManager.getEvents();
      expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
      expect(events.findIndex((event) => event.type === "hunter_shot")).toBeLessThan(
        events.findIndex((event) => event.type === "game_over"),
      );
      expect(
        events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
      ).toEqual([{ hunterId: 2, targetId: 1 }]);
    });
