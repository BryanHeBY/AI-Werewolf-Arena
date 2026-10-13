/**
 * 死亡连锁场景测试：验证实际放逐及并发自爆先结完警徽／枪再判胜。输入为原双语矩阵、固定身份和连续 PM 周期；手写死活集合、精确事件及终局保留原断言，不调用模型、改 fixture 或生成 oracle。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT, Camp, Phase, Role, WinCondition, type ActionRequest } from "../../../src/core";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: real exile settles words, badge, gun, the shot sheriff's badge and then victory`, async () => {
    const game = bootstrapGame(
      {
        ...sixPlayerMvpConfig,
        enableSheriff: true,
        initialSheriffSeat: 2,
        sheriff: { voteWeight: 2.25 },
        selfDestruct: { enabledWindows: [] },
        winConditions: [WinCondition.SlaughterCity],
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
    const requests: ActionRequest[] = [];
    const result = await game.phaseManager.runSingleCycle({
      async getAction(request) {
        requests.push(request);
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        if (request.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        if (request.allowedTools.includes("vote"))
          return { name: "vote", args: { target_id: 2, abstain: false } };
        if (request.allowedTools.includes("shoot"))
          return { name: "shoot", args: { target_id: 1 } };
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "raw" } };
        return null;
      },
    });
    expect(result.result).toEqual({
      winner: Camp.Good,
      reason: "all_wolves_eliminated",
      outcome: {
        kind: "victory",
        primary: { kind: "faction", faction: "good", winningPlayerIds: [2, 3, 4, 5, 6] },
        additional: [],
        winningPlayerIds: [2, 3, 4, 5, 6],
      },
      decidedAt: { day: 1, phase: Phase.Voting, checkpoint: "exile_settled" },
    });
    expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]);
    expect(game.world.activeDeathActionCount).toBe(0);
    const events = game.phaseManager.getEvents();
    const relevant = events.filter((event) =>
      [
        "voted_out",
        "last_words_spoken",
        "sheriff_badge_transferred",
        "hunter_shot",
        "game_over",
      ].includes(event.type),
    );
    expect(relevant.map((event) => event.type)).toEqual([
      "voted_out",
      "last_words_spoken",
      "sheriff_badge_transferred",
      "hunter_shot",
      "sheriff_badge_transferred",
      "game_over",
    ]);
    expect(
      relevant
        .filter((event) => event.type === "sheriff_badge_transferred")
        .map((event) => [event.payload.fromId, event.payload.toId]),
    ).toEqual([
      [2, 1],
      [1, 3],
    ]);
    expect(game.world.getComponent(3, COMPONENT.VotingRight)!.weight).toBe(
      2.25,
    );
    expect(
      requests
        .filter((request) => request.context.stage === "last_words")
        .map((request) => request.actorId),
    ).toEqual([2]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: concurrent default self-destruction picks one wolf, settles the badge without last words, enters night and later ends naturally`, async () => {
    const game = bootstrapGame(
      {
        ...sixPlayerMvpConfig,
        enableSheriff: true,
        initialSheriffSeat: 1,
        sheriff: { voteWeight: 2.25 },
        hooks: { onDaybreak: false, onPreElection: false, onPreVote: true, onPerSpeechGap: false },
        winConditions: [WinCondition.SlaughterCity],
        roleSetups: [
          { role: Role.Wolf, count: 2 },
          { role: Role.Seer, count: 1 },
          { role: Role.Villager, count: 3 },
        ],
      },
      {
        locale,
        fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Villager, Role.Villager, Role.Villager],
      },
    );
    const requests: ActionRequest[] = [];
    const provider = {
      async getAction(request: ActionRequest) {
        requests.push(request);
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote" as const, args: { target_id: null, abstain: true } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity" as const, args: { target_id: 2 } };
        if (request.allowedTools.includes("choose_direction"))
          return { name: "choose_direction" as const, args: { direction: "clockwise" as const } };
        if (request.allowedTools.includes("self_destruct")) {
          await new Promise((resolve) => setTimeout(resolve, request.actorId === 1 ? 3 : 0));
          return { name: "self_destruct" as const, args: { confirm: true, reason: "raw" } };
        }
        if (request.allowedTools.includes("speak"))
          return { name: "speak" as const, args: { text: "raw" } };
        return null;
      },
    };
    const first = await game.phaseManager.runSingleCycle(provider);
    expect(first).toMatchObject({ day: 2, phase: Phase.Night, gameOver: false });
    expect(game.world.getAliveEntityIds()).toEqual([2, 3, 4, 5, 6]);
    expect(game.world.getComponent(2, COMPONENT.Badge)!.isSheriff).toBe(
      true,
    );
    expect(game.world.getComponent(2, COMPONENT.VotingRight)!.weight).toBe(
      2.25,
    );
    const last = await game.phaseManager.runSingleCycle(provider);
    expect(last.result).toEqual({
      winner: Camp.Good,
      reason: "all_wolves_eliminated",
      outcome: {
        kind: "victory",
        primary: { kind: "faction", faction: "good", winningPlayerIds: [3, 4, 5, 6] },
        additional: [],
        winningPlayerIds: [3, 4, 5, 6],
      },
      decidedAt: { day: 2, phase: Phase.Voting, checkpoint: "day_interrupted" },
    });
    expect(game.world.getAliveEntityIds()).toEqual([3, 4, 5, 6]);
    expect(game.world.getComponent(3, COMPONENT.Badge)!.isSheriff).toBe(
      true,
    );
    expect(game.world.activeDeathActionCount).toBe(0);
    expect(
      requests.filter(
        (request) =>
          request.context.stage === "last_words" || request.allowedTools.includes("vote"),
      ),
    ).toEqual([]);
    const events = game.phaseManager.getEvents();
    expect(
      events
        .filter((event) => event.type === "wolf_self_destruct")
        .map((event) => event.payload.wolfId),
    ).toEqual([1, 2]);
    expect(
      events
        .filter((event) => event.type === "sheriff_badge_transferred")
        .map((event) => event.payload),
    ).toEqual([
      { fromId: 1, toId: 2, reason: "self_destruct" },
      { fromId: 2, toId: 3, reason: "self_destruct" },
    ]);
    const finalBadge = events.reduce(
      (last, event, index) => (event.type === "sheriff_badge_transferred" ? index : last),
      -1,
    );
    expect(finalBadge).toBeLessThan(events.findIndex((event) => event.type === "game_over"));
  });
