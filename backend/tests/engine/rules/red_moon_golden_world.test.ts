import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { redMoonTwelveConfig } from "../../../src/runtime/scenarios/red_moon_twelve";
import {
  COMPONENT,
  Camp,
  PotionType,
  type ActionRequest,
  type ToolCall,
  type RoleComponent,
} from "../../../src/core";
import { demonNightChoice } from "../../support/demon_hunter_scenarios";
import { getRedMoonState } from "../../../src/game/mechanisms/roles/red_moon_apostle/state";
function game(policy: "ends_game" | "forbidden" = "ends_game") {
  const config = structuredClone(redMoonTwelveConfig);
  config.redMoon!.lastWolfBlastPolicy = policy;
  return bootstrapGame(config, {
    fixedRoles: config.roleSetups.flatMap((row) => Array(row.count).fill(row.role)),
  });
}
for (const wins of [false, true])
  for (const policy of ["ends_game", "forbidden"] as const)
    test(
      policy +
        ": deferred last wolf " +
        (wins ? "wins with the final knife" : "expires without completing a side"),
      async () => {
        const g = game(policy);
        const seen: ActionRequest[] = [];
        const result = await g.phaseManager.runUntilGameOver(
          {
            async getAction(r) {
              seen.push(r);
              const day = r.context.day;
              if (r.allowedTools.includes("vote")) {
                const target = day === 1 ? 2 : day === 2 ? (wins ? 7 : 4) : 4;
                return { name: "vote", args: { target_id: target, abstain: false } } as ToolCall;
              }
              if (r.allowedTools.includes("check_identity"))
                return { name: "check_identity", args: { target_id: 4 } } as ToolCall;
              return demonNightChoice(r, 10, {
                knife: day === 1 ? 5 : day === 2 ? 6 : wins ? (day === 3 ? 9 : 8) : 7,
                potion: day === 1 ? { target: 1, type: PotionType.Poison } : undefined,
                hunt: day === 2 ? 3 : null,
              });
            },
          },
          10,
        );
        expect(result.gameOver).toBe(true);
        expect(result.result!.winner, JSON.stringify(g.phaseManager.getEvents())).toBe(
          wins ? Camp.Wolf : Camp.Good,
        );
        const events = g.phaseManager.getEvents();
        expect(events.filter((e) => e.type === "red_moon_exile_delayed")).toHaveLength(1);
        expect(events.filter((e) => e.type === "red_moon_delay_expired")).toHaveLength(
          wins ? 0 : 1,
        );
        expect(events.some((e) => e.type === "voted_out" && e.payload.target === 4)).toBe(false);
        expect(
          seen.some(
            (r) =>
              r.actorId === 4 &&
              r.context.day === (wins ? 4 : 3) &&
              r.allowedTools.includes("kill_vote"),
          ),
        ).toBe(true);
        expect(
          getRedMoonState(g.world.getComponent<RoleComponent>(4, COMPONENT.Role))!.expirySettled,
        ).toBe(!wins);
      },
    );
test("A real blast seals only the following night and good native requests resume", async () => {
  const g = game();
  const seen: ActionRequest[] = [];
  const provider = {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      seen.push(r);
      const day = r.context.day;
      if (r.actorId === 4 && day === 1 && r.allowedTools.includes("self_destruct"))
        return { name: "self_destruct", args: { reason: "Golden blast", confirm: true } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: day === 2 ? 1 : 2, abstain: false } };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 8 } };
      return demonNightChoice(r, 10, { knife: day === 1 ? 5 : day === 2 ? 6 : 7 });
    },
  };
  await g.phaseManager.runSingleCycle(provider, 10);
  await g.phaseManager.runSingleCycle(provider, 10);
  const good = (day: number) =>
    seen.filter(
      (r) => r.context.day === day && ["seer", "witch", "demon_hunter"].includes(r.context.stage),
    );
  expect(good(1).length).toBeGreaterThan(0);
  expect(good(2)).toEqual([]);
  expect(g.phaseManager.getEvents().filter((e) => e.type === "red_moon_night_sealed")).toHaveLength(
    1,
  );
  await g.phaseManager.runSingleCycle(provider, 10);
  expect(good(3).length).toBeGreaterThan(0);
});
