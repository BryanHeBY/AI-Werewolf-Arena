/**
 * Scenario tests for lonely girl setup. Inputs are original required choices, getter/revocation matrices
 * and public board configuration. Original literal receipts, reference/getter/error traces, facts and
 * expected state remain the oracle. Actual two PM cycles complete setup and day/voting flow while nested
 * phase/cycle entries are rejected. Engine sequencing remains real and models remain controlled providers;
 * production output is not a newly generated golden.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Role, Phase, PotionType, type BoardConfig, type ActionRequest, type ToolCall, type GameEvent } from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";

const deck = [Role.LonelyGirl, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];

function fixture(roles = deck, extra: Partial<BoardConfig> = {}) {
  const config = { ...foxBoard(roles), ...extra };
  return { ...bootstrapGame(config, { fixedRoles: roles }), config, events: [] as GameEvent[] };
}

const choose = (target_id = 2): ToolCall => ({
  name: "choose_admired_player",
  args: { target_id },
});

test("actual first-night Day/Voting jumpTo and recursive cycles reject before phase/events; later night does not reopen", async () => {
  const g = fixture();
  let blocked = 0,
    choices = 0;
  const provider = {
    async getAction(r: ActionRequest): Promise<ToolCall | null> {
      if (r.context.stage === "lonely_girl") {
        choices++;
        return choose();
      }
      if (r.context.stage === "wolf_discussion")
        return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
      if (r.context.stage === "wolf_vote")
        return { name: "kill_vote", args: { target_id: null, abstain: true } };
      if (r.context.stage === "seer") return { name: "check_identity", args: { target_id: 1 } };
      if (r.context.stage === "witch")
        return { name: "use_potion", args: { target_id: r.actorId, potion_type: PotionType.None } };
      if (["day_speech", "voting"].includes(r.context.stage)) {
        const before = g.phaseManager.getSnapshot(),
          count = g.phaseManager.getEvents().length;
        for (const phase of [Phase.Night, Phase.Day, Phase.Voting])
          expect(() => g.phaseManager.jumpTo(phase)).toThrow("lonely_girl_phase_reentry");
        await expect(g.phaseManager.runSingleCycle(provider)).rejects.toThrow(
          "lonely_girl_cycle_reentry",
        );
        expect(g.phaseManager.getSnapshot()).toEqual(before);
        expect(g.phaseManager.getEvents()).toHaveLength(count);
        blocked++;
        return r.context.stage === "day_speech"
          ? { name: "speak", args: { text: "Raw" } }
          : { name: "vote", args: { target_id: null, abstain: true } };
      }
      return null;
    },
  };
  await g.phaseManager.runSingleCycle(provider);
  await g.phaseManager.runSingleCycle(provider);
  expect(choices).toBe(1);
  expect(blocked).toBe(24);
  expect(g.phaseManager.getSnapshot().day).toBe(3);
});
