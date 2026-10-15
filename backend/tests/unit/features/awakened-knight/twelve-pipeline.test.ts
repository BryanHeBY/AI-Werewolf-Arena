/**
 * 负责觉醒骑士原十二人牌池的真实PM/DayPipeline/DR单元场景，关闭警长只固定本层手写游标。
 * 显式夜行动与公开边界选择驱动三方盾／狼美人替死、误中恢复和自爆跳日；预期死亡名单与顺序人工写出。
 * 此层不冒充真实SDK/ACP或独立Tape，协议及自然多seed验收另行执行。
 */
import { expect, test } from "bun:test";
import {
  Role,
  Phase,
  PotionType,
  type ActionRequest,
  type ToolCall,
} from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { awakenedKnightTwelveConfig } from "../../../../src/rulesets/presets/awakened-knight-twelve";
import { BaselineBotActionProvider } from "../../../../src/agents/baseline/privileged";
import { COMPONENT } from "../../../../src/domain/components/names";
import { getAwakenedBeautyState } from "../../../../src/features/awakened-wolf-beauty/state";
import { getAwakenedKnightState } from "../../../../src/features/awakened-knight/state";
import { getAwakenedGuardState } from "../../../../src/features/awakened-guard/state";
const roles = [
  Role.AwakenedGuard,
  Role.AwakenedKnight,
  Role.Wolf,
  Role.Wolf,
  Role.AwakenedWolfBeauty,
  Role.Wolf,
  Role.Seer,
  Role.Witch,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
];
function fixture(enableSheriff = false) {
  const config = structuredClone(awakenedKnightTwelveConfig);
  config.enableSheriff = enableSheriff;
  const game = bootstrapGame(config, { fixedRoles: roles }),
    baseline = new BaselineBotActionProvider(game.world);
  const base = async (r: ActionRequest): Promise<ToolCall | null> => {
    if (r.allowedTools.includes("speak_to_wolves"))
      return { name: "speak_to_wolves", args: { text: "literal night end", end_chat: true } };
    if (r.allowedTools.includes("kill_vote"))
      return { name: "kill_vote", args: { target_id: 12, abstain: false } };
    if (r.allowedTools.includes("check_identity"))
      return { name: "check_identity", args: { target_id: 3 } };
    if (r.allowedTools.includes("use_potion"))
      return { name: "use_potion", args: { target_id: 8, potion_type: PotionType.None } };
    if (r.allowedTools.includes("awakened_charm"))
      return { name: "awakened_charm", args: { target_id: 11 } };
    if (r.allowedTools.includes("self_destruct")) return null;
    if (r.allowedTools.includes("vote"))
      return { name: "vote", args: { target_id: r.actorId === 4 ? 6 : 4, abstain: false } };
    return baseline.getAction(r);
  };
  return { ...game, base };
}
for (const shield of ["body", "replacement", "none"] as const)
  test(`原12完整成功链：保护${shield}时先狼美人5后普通狼3，真实延期词与once前缀准确`, async () => {
    const g = fixture();
    let duels = 0;
    const result = await g.phaseManager.runSingleCycle({
      async getAction(r) {
        if (r.allowedTools.includes("awakened_protect"))
          return {
            name: "awakened_protect",
            args:
              shield === "body"
                ? r.context.stage === "awakened_protection_night"
                  ? { mode: "wait", target_id: null }
                  : { mode: "protect", target_id: 5 }
                : shield === "replacement"
                  ? { mode: "protect", target_id: 11 }
                  : { mode: "pass", target_id: null },
          };
        if (r.allowedTools.includes("awakened_duel"))
          return {
            name: "awakened_duel",
            args: { target_id: ++duels === 1 ? 5 : duels === 2 ? 3 : null },
          };
        return g.base(r);
      },
    });
    const events = g.phaseManager.getEvents(),
      alive = g.world.getAliveEntityIds();
    expect(result).toMatchObject({ day: 2, phase: Phase.Night, gameOver: false });
    expect(alive).toEqual(
      shield === "none" ? [1, 2, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    );
    expect(
      events.filter((e) => e.type === "last_words_granted").map((e) => e.payload.playerId),
    ).toEqual(shield === "none" ? [12, 11, 3] : [12, 3]);
    const beauty = getAwakenedBeautyState(g.world.getComponent(5, COMPONENT.Role)!)!;
    expect(beauty.replacement !== null).toBe(shield !== "body");
    expect(
      getAwakenedKnightState(g.world.getComponent(2, COMPONENT.Role)!)!.attempts.map(
        (a) => a.targetId,
      ),
    ).toEqual([5, 3]);
    expect(events.filter((e) => e.type === "awakened_protection_expired")).toHaveLength(1);
  });
test("原12误中被盾骑士仍恢复原未完speakers，已发1不重播、死9跳过、其它原活人继续", async () => {
  const g = fixture(),
    spoken: number[] = [];
  let missed = false;
  await g.phaseManager.runSingleCycle({
    async getAction(r) {
      if (r.allowedTools.includes("awakened_protect"))
        return { name: "awakened_protect", args: { mode: "protect", target_id: 2 } };
      if (r.context.stage === "day_speech") spoken.push(r.actorId);
      if (r.allowedTools.includes("awakened_duel")) {
        if (spoken.length && !missed) {
          missed = true;
          return { name: "awakened_duel", args: { target_id: 9 } };
        }
        expect(r.context.awakened_duel_options?.targetIds.includes(9)).toBe(!missed);
        return { name: "awakened_duel", args: { target_id: null } };
      }
      return g.base(r);
    },
  });
  expect(spoken).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 11]);
  expect(g.world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
  expect(g.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(false);
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "last_words_granted")
      .map((e) => e.payload.playerId),
  ).toEqual([12, 9, 4]);
  expect(getAwakenedKnightState(g.world.getComponent(2, COMPONENT.Role)!)!.attempts).toEqual([
    { day: 1, chain: 1, targetId: 9, branch: "good" },
  ]);
});
test.each([false, true])(
  "原12真实PM接受自爆，盾=%s仍跳入N2但存活和实际结果按真实receipt",
  async (protect) => {
    const g = fixture(true);
    let exploded = false;
    const result = await g.phaseManager.runSingleCycle({
      async getAction(r) {
        if (r.allowedTools.includes("awakened_protect"))
          return {
            name: "awakened_protect",
            args: protect ? { mode: "protect", target_id: 3 } : { mode: "pass", target_id: null },
          };
        if (r.allowedTools.includes("awakened_duel"))
          return { name: "awakened_duel", args: { target_id: null } };
        if (r.allowedTools.includes("self_destruct")) {
          if (r.actorId === 3 && !exploded) {
            exploded = true;
            return {
              name: "self_destruct",
              args: { reason: "literal protected blast", confirm: true },
            };
          }
          return null;
        }
        return g.base(r);
      },
    });
    expect(result).toMatchObject({ day: 2, phase: Phase.Night, gameOver: false });
    expect(g.world.getComponent(3, COMPONENT.Alive)!.alive).toBe(protect);
    const events = g.phaseManager.getEvents();
    expect(events.some((e) => e.type === "wolf_self_destruct")).toBe(false);
    expect(events.filter((e) => e.type === "awakened_self_destruct_declared")).toHaveLength(1);
    expect(
      events
        .filter((e) => e.type === "awakened_self_destruct_resolved")
        .map((e) => e.payload.deaths),
    ).toEqual([protect ? [] : [3]]);
    expect(events.some((e) => e.type === "day_speech")).toBe(false);
    expect(getAwakenedGuardState(g.world.getComponent(1, COMPONENT.Role)!)!.cycles[0]?.status).toBe(
      protect ? "protected" : "passed",
    );
    expect(g.world.activeDeathActionCount).toBe(0);
  },
);
test("真实PK入口误中9后恢复未完PK游标，死9不发言、10继续且第二票只剩真实候选", async () => {
  const g = fixture(),
    pkSpeeches: number[] = [];
  let inPK = false,
    missed = false;
  await g.phaseManager.runSingleCycle({
    async getAction(r) {
      if (r.allowedTools.includes("awakened_protect"))
        return { name: "awakened_protect", args: { mode: "protect", target_id: 2 } };
      if (r.allowedTools.includes("awakened_duel")) {
        const events = g.phaseManager.getEvents();
        inPK = events.some((e) => e.type === "exile_pk_started");
        if (inPK && !missed) {
          missed = true;
          expect(r.phase).toBe(Phase.Voting);
          return { name: "awakened_duel", args: { target_id: 9 } };
        }
        return { name: "awakened_duel", args: { target_id: null } };
      }
      if (r.context.stage === "exile_pk_speech") pkSpeeches.push(r.actorId);
      if (r.allowedTools.includes("vote")) {
        if (r.context.stage === "exile_pk_vote") {
          expect(r.context.exile_candidates).toEqual([10]);
          return { name: "vote", args: { target_id: 10, abstain: false } };
        }
        return {
          name: "vote",
          args: {
            target_id: r.actorId === 1 ? null : r.actorId <= 6 ? 9 : 10,
            abstain: r.actorId === 1,
          },
        };
      }
      return g.base(r);
    },
  });
  expect(inPK).toBe(true);
  expect(missed).toBe(true);
  expect(pkSpeeches).toEqual([10]);
  expect(g.world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
  expect(g.world.getComponent(9, COMPONENT.Alive)!.alive).toBe(false);
  expect(g.world.getComponent(10, COMPONENT.Alive)!.alive).toBe(false);
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "last_words_granted")
      .map((e) => e.payload.playerId),
  ).toEqual([12, 9, 10]);
  expect(
    g.phaseManager
      .getEvents()
      .filter((e) => e.type === "vote_summary")
      .map((e) => e.payload.target),
  ).toEqual([null, 10]);
});
