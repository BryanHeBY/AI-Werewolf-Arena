/**
 * 交互场景测试：验证首夜结算、首日竞选、死亡和遗言的 PhaseManager 因果顺序。输入为固定身份、原确定动作 provider 与终局停止样本；事件、请求历史及单次执行为明确字面预期，不以生产结果替换预期。
 */
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { RoleComponent } from "../../../../src/core/domain/components/role";
import {
  ActionProvider,
  ActionRequest,
  Camp,
  Phase,
  PotionType,
  Role,
  ToolCall,
} from "../../../../src/core/domain/model";
import { twelvePlayerStandardConfig } from "../../../../src/runtime/scenarios/twelve_player_standard";

class DeterministicFlowProvider implements ActionProvider {
  private readonly firstNightKillTargetId: number | null;

  constructor(
    private readonly world: ReturnType<typeof bootstrapGame>["world"],
    private readonly sheriffCandidateId: number,
  ) {
    this.firstNightKillTargetId =
      this.world.getAliveEntityIds().find((id) => {
        if (id === this.sheriffCandidateId) {
          return false;
        }
        const role = this.world.getComponent(id, COMPONENT.Role);
        return role?.camp !== "wolf";
      }) ?? null;
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    if (request.allowedTools.includes("kill_vote")) {
      const target = this.firstNightKillTargetId;
      return target
        ? { name: "kill_vote", args: { target_id: target, abstain: false } }
        : { name: "kill_vote", args: { target_id: null, abstain: true } };
    }
    if (request.allowedTools.includes("guard")) {
      return { name: "guard", args: { target_id: null, abstain: true } };
    }
    if (request.allowedTools.includes("use_potion")) {
      return {
        name: "use_potion",
        args: { target_id: request.actorId, potion_type: PotionType.None },
      };
    }
    if (request.allowedTools.includes("check_identity")) {
      const target = this.world.getAliveEntityIds().find((id) => id !== request.actorId);
      return { name: "check_identity", args: { target_id: target ?? request.actorId } };
    }
    if (request.allowedTools.includes("run_for_sheriff")) {
      if (request.context.stage === "sheriff_withdraw") {
        return { name: "run_for_sheriff", args: { run: true } };
      }
      return {
        name: "run_for_sheriff",
        args: { run: request.actorId === this.sheriffCandidateId },
      };
    }
    if (request.allowedTools.includes("vote_for_sheriff")) {
      return {
        name: "vote_for_sheriff",
        args: { target_id: this.sheriffCandidateId, abstain: false },
      };
    }
    if (request.allowedTools.includes("choose_direction")) {
      return { name: "choose_direction", args: { direction: "clockwise" } };
    }
    if (request.allowedTools.includes("vote")) {
      const target = this.world.getAliveEntityIds().find((id) => id !== request.actorId);
      return { name: "vote", args: { target_id: target ?? request.actorId, abstain: false } };
    }
    if (request.allowedTools.includes("speak")) {
      if (request.context?.trigger === "last_words") {
        return { name: "speak", args: { text: `遗言_${request.actorId}` } };
      }
      return { name: "speak", args: { text: `发言_${request.actorId}` } };
    }
    return null;
  }
}

describe("first day flow order", () => {
  test("terminal first-night deaths stop day actions after sheriff election and last words", async () => {
    const context = bootstrapGame({
      ...twelvePlayerStandardConfig,
      boardSize: 4,
      roleSetups: [
        { role: Role.Wolf, count: 1 },
        { role: Role.Witch, count: 1 },
        { role: Role.Villager, count: 2 },
      ],
    });
    const wolfId = context.playerIds.find(
      (id) => context.world.getComponent(id, COMPONENT.Role)?.role === Role.Wolf,
    )!;
    const sheriffId = context.playerIds.find(
      (id) => context.world.getComponent(id, COMPONENT.Role)?.role === Role.Villager,
    )!;
    const requests: ActionRequest[] = [];
    const provider: ActionProvider = {
      async getAction(request): Promise<ToolCall | null> {
        requests.push(request);
        if (request.allowedTools.includes("kill_vote")) {
          return { name: "kill_vote", args: { target_id: null, abstain: true } };
        }
        if (request.allowedTools.includes("use_potion")) {
          return {
            name: "use_potion",
            args: { target_id: wolfId, potion_type: PotionType.Poison },
          };
        }
        if (request.allowedTools.includes("run_for_sheriff")) {
          return { name: "run_for_sheriff", args: { run: request.actorId === sheriffId } };
        }
        if (request.allowedTools.includes("vote_for_sheriff")) {
          return { name: "vote_for_sheriff", args: { target_id: sheriffId, abstain: false } };
        }
        if (request.allowedTools.includes("choose_direction")) {
          return { name: "choose_direction", args: { direction: "clockwise" } };
        }
        if (request.allowedTools.includes("speak")) {
          return { name: "speak", args: { text: `发言_${request.actorId}` } };
        }
        return null;
      },
    };

    const snapshot = await context.phaseManager.runSingleCycle(provider, 10);
    expect(snapshot).toMatchObject({
      day: 1,
      phase: Phase.GameOver,
      gameOver: true,
      result: { winner: Camp.Good },
    });
    expect(context.world.getAliveEntityIds()).toEqual(
      context.playerIds.filter((id) => id !== wolfId),
    );

    const events = context.phaseManager.getEvents();
    const sheriffIndex = events.findIndex((event) => event.type === "sheriff_elected");
    const nightIndex = events.findIndex((event) => event.type === "night_resolved");
    const lastWordsIndex = events.findIndex((event) => event.type === "last_words_spoken");
    const gameOverIndex = events.findIndex(
      (event) => event.type === "phase_changed" && event.payload.phase === Phase.GameOver,
    );
    expect(sheriffIndex).toBeGreaterThanOrEqual(0);
    if (events[sheriffIndex].type !== "sheriff_elected") throw new Error("unexpected_flow_event");
    expect(events[sheriffIndex].payload.winnerId).toBe(sheriffId);
    expect(sheriffIndex).toBeLessThan(nightIndex);
    if (events[nightIndex].type !== "night_resolved") throw new Error("unexpected_flow_event");
    expect(events[nightIndex].payload.deaths).toEqual([wolfId]);
    expect(nightIndex).toBeLessThan(lastWordsIndex);
    if (events[lastWordsIndex].type !== "last_words_spoken")
      throw new Error("unexpected_flow_event");
    expect(events[lastWordsIndex].payload.playerId).toBe(wolfId);
    expect(lastWordsIndex).toBeLessThan(gameOverIndex);
    expect(events.slice(gameOverIndex + 1)).toEqual([
      expect.objectContaining({
        type: "game_over",
        payload: expect.objectContaining({ winner: Camp.Good }),
      }),
    ]);
    expect(
      events
        .slice(nightIndex)
        .filter((event) =>
          ["sheriff_direction_chosen", "day_speech", "vote_cast"].includes(event.type),
        ),
    ).toEqual([]);
    expect(
      requests.filter(
        (request) =>
          request.allowedTools.includes("choose_direction") ||
          request.context.stage === "day_speech" ||
          request.phase === Phase.Voting,
      ),
    ).toEqual([]);
    expect(
      requests
        .filter((request) => request.context.stage === "last_words")
        .map((request) => request.actorId),
    ).toEqual([wolfId]);
  });

  test("day1 should elect sheriff before announcing previous night deaths", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const sheriffCandidateId = 1;
    const provider = new DeterministicFlowProvider(context.world, sheriffCandidateId);

    await context.phaseManager.runSingleCycle(provider, 10);

    const events = context.phaseManager.getEvents();
    const firstDayPhaseIndex = events.findIndex(
      (event) =>
        event.type === "phase_changed" &&
        event.payload.phase === Phase.Day &&
        Number(event.payload.day) === 1,
    );
    const sheriffElectedIndex = events.findIndex((event) => event.type === "sheriff_elected");
    const nightResolvedIndex = events.findIndex((event) => event.type === "night_resolved");
    const lastWordsGrantedIndex = events.findIndex(
      (event) => event.type === "last_words_granted" && event.payload.phase === Phase.Day,
    );
    const sheriffDirectionIndex = events.findIndex(
      (event) => event.type === "sheriff_direction_chosen",
    );

    expect(firstDayPhaseIndex).toBeGreaterThanOrEqual(0);
    expect(sheriffElectedIndex).toBeGreaterThanOrEqual(0);
    expect(nightResolvedIndex).toBeGreaterThanOrEqual(0);
    expect(lastWordsGrantedIndex).toBeGreaterThanOrEqual(0);
    expect(sheriffDirectionIndex).toBeGreaterThanOrEqual(0);

    expect(firstDayPhaseIndex).toBeLessThan(sheriffElectedIndex);
    expect(sheriffElectedIndex).toBeLessThan(nightResolvedIndex);
    expect(nightResolvedIndex).toBeLessThan(lastWordsGrantedIndex);
    expect(lastWordsGrantedIndex).toBeLessThan(sheriffDirectionIndex);
  });

  test("day1 night deaths should still join sheriff vote before death announcement", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const sheriffCandidateId = 1;
    const provider = new DeterministicFlowProvider(context.world, sheriffCandidateId);

    await context.phaseManager.runSingleCycle(provider, 10);

    const events = context.phaseManager.getEvents();
    const nightResolved = events.find((event) => event.type === "night_resolved");
    expect(nightResolved).toBeTruthy();
    const deaths = (nightResolved?.payload.deaths as number[]) ?? [];
    expect(deaths.length).toBeGreaterThan(0);

    const firstNightDeadId = deaths[0];
    const sheriffVoteSummary = events.find((event) => event.type === "sheriff_vote_summary");
    expect(sheriffVoteSummary).toBeTruthy();
    const sheriffVoters = ((sheriffVoteSummary?.payload.votes as { actorId: number }[]) ?? []).map(
      (vote) => vote.actorId,
    );
    expect(sheriffVoters).toContain(firstNightDeadId);

    const daySpeechActors = events
      .filter((event) => event.type === "day_speech")
      .map((event) => Number(event.payload.actorId));
    const voteActors = events
      .filter((event) => event.type === "vote_cast")
      .map((event) => Number(event.payload.actorId));
    expect(daySpeechActors).not.toContain(firstNightDeadId);
    expect(voteActors).not.toContain(firstNightDeadId);
  });

  test("night deaths should write last_words events with day phase", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const provider = new DeterministicFlowProvider(context.world, 1);

    await context.phaseManager.runSingleCycle(provider, 10);

    const events = context.phaseManager.getEvents();
    const lastWordsGranted = events.filter((event) => event.type === "last_words_granted");
    const lastWordsSpoken = events.filter((event) => event.type === "last_words_spoken");

    expect(lastWordsGranted.length).toBeGreaterThan(0);
    expect(lastWordsGranted.some((event) => event.payload.phase === Phase.Day)).toBe(true);
    expect(lastWordsSpoken.some((event) => event.payload.phase === Phase.Day)).toBe(true);
    expect(lastWordsGranted.some((event) => event.payload.phase === Phase.Night)).toBe(false);
    expect(lastWordsSpoken.some((event) => event.payload.phase === Phase.Night)).toBe(false);
  });

  test("night_resolved should not expose wolf target in public payload", async () => {
    const context = bootstrapGame(twelvePlayerStandardConfig);
    const provider = new DeterministicFlowProvider(context.world, 1);

    await context.phaseManager.runSingleCycle(provider, 10);

    const events = context.phaseManager.getEvents();
    const nightResolved = events.find((event) => event.type === "night_resolved");
    expect(nightResolved).toBeTruthy();
    expect((nightResolved?.payload as Record<string, unknown>).wolfTarget).toBeUndefined();
  });
});
