/**
 * 完整场景测试：验证墙报首轮投票与终局周期窗口。输入为原角色、事件和受控周期；既有字面预期及不可变 fixture 保留原授权与关闭结果，不调用模型或重写样本。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { ActionWindow, COMPONENT, Role, type GameEvent, type ActionRequest, type ToolCall } from "../../../../src/domain";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { hasWallCommit } from "../../../../src/features/wall-notes/authority";

const roles = [Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager, Role.Villager];

function fixture(deck = roles) {
  const config = { ...foxBoard(deck), events: { pack: "awa_wall_notes_once_v1" as const } };
  return { ...bootstrapGame(config, { fixedRoles: deck }), config, events: [] as GameEvent[] };
}

for (const outcome of ["abstain", "tie", "idiot"] as const)
  test(`normal first voting ${outcome} triggers wall even without exile`, async () => {
    const deck = [Role.Wolf, Role.Wolf, Role.Seer, Role.Idiot, Role.Villager, Role.Villager],
      config = {
        ...foxBoard(deck),
        events: { pack: "awa_wall_notes_once_v1" as const },
        tieBreaker: { exileVote: "no_elimination" as const, wolfKillVote: "no_kill" as const },
      },
      g = bootstrapGame(config, { fixedRoles: deck });
    const requests: ActionRequest[] = [];
    await g.phaseManager.runSingleCycle(
      {
        getAction: async (r) => {
          requests.push(r);
          if (r.allowedTools.includes("write_note")) return null;
          if (r.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: null, abstain: true } };
          if (r.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "done", end_chat: true } };
          if (r.allowedTools.includes("check_identity"))
            return { name: "check_identity", args: { target_id: 1 } };
          if (r.allowedTools.includes("vote"))
            return {
              name: "vote",
              args: {
                target_id:
                  outcome === "abstain" ? null : outcome === "idiot" ? 4 : r.actorId % 2 ? 1 : 2,
                abstain: outcome === "abstain",
              },
            };
          if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "speech" } };
          return null;
        },
      },
      10,
    );
    expect(requests.filter((r) => r.context.stage === "wall_notes")).toHaveLength(6);
    expect(g.phaseManager.getSnapshot()).toMatchObject({ day: 2, gameOver: false });
    expect(g.phaseManager.getEvents().filter((e) => e.type === "wall_notes_started")).toHaveLength(
      1,
    );
    if (outcome === "idiot")
      expect(g.world.getComponent(4, COMPONENT.VotingRight)!.canVote).toBe(
        false,
      );
  });

test("first-day terminal exile has no paper grants or requests", async () => {
  const deck = [Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager, Role.Villager],
    config = { ...foxBoard(deck), events: { pack: "awa_wall_notes_once_v1" as const } },
    g = bootstrapGame(config, { fixedRoles: deck });
  const seen: ActionRequest[] = [];
  await g.phaseManager.runSingleCycle({
    getAction: async (r) => {
      seen.push(r);
      if (r.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "done", end_chat: true } };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 1 } };
      if (r.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: r.actorId, potion_type: "none" as any } };
      if (r.allowedTools.includes("vote"))
        return {
          name: "vote",
          args: { target_id: r.actorId === 1 ? null : 1, abstain: r.actorId === 1 },
        };
      if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "speech" } };
      return null;
    },
  });
  expect(g.phaseManager.getSnapshot().gameOver).toBe(true);
  expect(seen.some((r) => r.context.stage === "wall_notes")).toBe(false);
  expect(g.world.getComponent(2, COMPONENT.WallNote)).toBeUndefined();
});

test("first-day self destruction ends day early and never catches up wall on day2", async () => {
  const g = fixture([Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter, Role.Villager]);
  g.config.hooks.onPreVote = true;
  g.config.selfDestruct = { enabledWindows: [ActionWindow.OnPreVote] };
  const seen: ActionRequest[] = [];
  let blasted = false;
  const provider = {
    getAction: async (r: ActionRequest): Promise<ToolCall | null> => {
      seen.push(r);
      if (r.allowedTools.includes("self_destruct")) {
        if (!blasted && r.actorId === 1) {
          blasted = true;
          return { name: "self_destruct", args: { reason: "early", confirm: true } };
        }
        return null;
      }
      if (r.allowedTools.includes("kill_vote"))
        return { name: "kill_vote", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("speak_to_wolves"))
        return { name: "speak_to_wolves", args: { text: "done", end_chat: true } };
      if (r.allowedTools.includes("check_identity"))
        return { name: "check_identity", args: { target_id: 6 } };
      if (r.allowedTools.includes("use_potion"))
        return { name: "use_potion", args: { target_id: r.actorId, potion_type: "none" as any } };
      if (r.allowedTools.includes("vote"))
        return { name: "vote", args: { target_id: null, abstain: true } };
      if (r.allowedTools.includes("speak")) return { name: "speak", args: { text: "speech" } };
      return null;
    },
  };
  await g.phaseManager.runSingleCycle(provider);
  expect(blasted).toBe(true);
  expect(g.phaseManager.getSnapshot()).toMatchObject({ day: 2, gameOver: false });
  await g.phaseManager.runSingleCycle(provider);
  expect(seen.some((r) => r.context.stage === "wall_notes")).toBe(false);
  expect(hasWallCommit(g.world)).toBe(false);
  expect(g.world.getComponent(2, COMPONENT.WallNote)).toBeUndefined();
});
