/**
 * 交互场景测试：验证赤月最后狼人延迟终局与单夜封印的胜负／到期政策。输入为原允许终局／禁止矩阵、固定角色计划及三次实际自爆／恢复周期；胜者、到期、请求时点和封印夜次数为明确预期，不调用生产 World 生成终局预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { redMoonTwelveConfig } from "../../../../src/rulesets/presets/red-moon-twelve";
import {
  COMPONENT,
  Camp,
  PotionType,
  type ActionRequest,
  type ToolCall,
  type RoleComponent,
} from "../../../../src/domain";
import { demonNightChoice } from "../../../support/features/demon-hunter/drivers/actions";
import { getRedMoonState } from "../../../../src/features/red-moon/state-slot";
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
          getRedMoonState(g.world.getComponent(4, COMPONENT.Role), () => g.world.getComponent(4, COMPONENT.Camp))!.expirySettled,
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
