/**
 * Scenario tests for white wolf king selection. Inputs are original locale/window/cause matrix and
 * controlled target/stock revocations. Original literal receipts, reference/getter/error traces, facts and
 * expected state remain the oracle. Complete PM cycles integrate blast wave, badge, Hunter/words, night
 * interruption and poison/guard effects before judgment. Engine sequencing remains real and models remain
 * controlled providers; production output is not a newly generated golden.
 */
import { Camp } from "../../../../src/core";
import { PotionType } from "../../../../src/core";
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import {
  COMPONENT,
  Role,
  Phase,
  ActionWindow,
  DeathCause,
  WinCondition,
  type RoleComponent,
} from "../../../../src/core";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";
import { ActionReception } from "../../../../src/ai/agents/player/action_reception";
import { getWhiteWolfKingState } from "../../../../src/game/mechanisms/roles/white_wolf_king/ports";
import { getHunterState } from "../../../../src/game/mechanisms/roles/hunter/ports";

const deck = [Role.WhiteWolfKing, Role.Wolf, Role.Seer, Role.Hunter, Role.Villager, Role.Villager];

const board = (window: ActionWindow) => ({
  ...sixPlayerMvpConfig,
  enableSheriff: true,
  sheriff: { voteWeight: 2.25 },
  winConditions: [WinCondition.SlaughterSide],
  hooks: { onDaybreak: true, onPreElection: true, onPreVote: true, onPerSpeechGap: true },
  selfDestruct: { enabledWindows: [window] },
  roleSetups: [
    { role: Role.WhiteWolfKing, count: 1 },
    { role: Role.Wolf, count: 1 },
    { role: Role.Seer, count: 1 },
    { role: Role.Hunter, count: 1 },
    { role: Role.Villager, count: 2 },
  ],
});

const role = (world: ReturnType<typeof bootstrapGame>["world"], id: number) =>
  world.getComponent<RoleComponent>(id, COMPONENT.Role)!;

const call = (target_id: number | null) => ({
  name: "self_destruct_with_target" as const,
  args: { reason: "Raw", confirm: true, target_id },
});

for (const locale of ["zh-CN", "en"] as const)
  for (const window of Object.values(ActionWindow))
    test(`${locale}/${window}: selected white blast merges the whole first wave, badge and Hunter follow before victory`, async () => {
      const game = bootstrapGame(board(window), { locale, fixedRoles: deck });
      let shots = 0,
        elections = 0,
        voted = 0;
      const snapshot = await game.phaseManager.runSingleCycle({
        async getAction(request) {
          if (request.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (request.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: 5, abstain: false } };
          if (request.allowedTools.includes("check_identity"))
            return { name: "check_identity", args: { target_id: 1 } };
          if (request.allowedTools.includes("self_destruct_with_target")) return call(4);
          if (request.allowedTools.includes("self_destruct")) return null;
          if (request.allowedTools.includes("shoot")) {
            shots++;
            expect(game.world.getAliveEntityIds()).not.toContain(1);
            expect(game.world.getAliveEntityIds()).not.toContain(4);
            expect(request.context.death_sources).toEqual([DeathCause.WhiteWolfBlast]);
            return { name: "shoot", args: { target_id: 2 } };
          }
          if (request.allowedTools.includes("speak"))
            return { name: "speak", args: { text: "Raw" } };
          if (request.allowedTools.includes("run_for_sheriff")) {
            elections++;
            return { name: "run_for_sheriff", args: { run: false } };
          }
          if (request.allowedTools.includes("vote")) {
            voted++;
            throw new Error("blast_no_vote");
          }
          throw new Error(`unexpected:${request.context.stage}`);
        },
      });
      expect(shots).toBe(1);
      expect(voted).toBe(0);
      expect(elections).toBe(window === ActionWindow.OnPreElection ? 0 : 6);
      expect(snapshot.result).toEqual({
        winner: Camp.Good,
        reason: "all_wolves_eliminated",
        outcome: {
          kind: "victory",
          primary: { kind: "faction", faction: "good", winningPlayerIds: [3, 4, 5, 6] },
          additional: [],
          winningPlayerIds: [3, 4, 5, 6],
        },
        decidedAt: {
          day: 1,
          phase: window === ActionWindow.OnPreVote ? Phase.Voting : Phase.Day,
          checkpoint: "day_interrupted",
        },
      });
      expect(game.world.getAliveEntityIds()).toEqual([3, 6]);
      expect(game.world.activeDeathActionCount).toBe(0);
      const events = game.phaseManager.getEvents();
      expect(
        events
          .filter((event) => event.type === "last_words_spoken")
          .map((event) => event.payload.playerId),
      ).toEqual([5]);
      expect(
        events.filter((event) => event.type === "hunter_shot").map((event) => event.payload),
      ).toEqual([{ hunterId: 4, targetId: 2 }]);
      expect(events.filter((event) => event.type === "game_over")).toHaveLength(1);
      expect(
        events.findIndex((event) => event.type === "white_wolf_king_self_destruct"),
      ).toBeLessThan(events.findIndex((event) => event.type === "hunter_shot"));
      expect(events.findIndex((event) => event.type === "hunter_shot")).toBeLessThan(
        events.findIndex((event) => event.type === "game_over"),
      );
      expect(getWhiteWolfKingState(role(game.world, 1))?.canDetonate).toBe(false);
      expect(getHunterState(role(game.world, 4))?.canShoot).toBe(false);
    });

for (const locale of ["zh-CN", "en"] as const)
  for (const cause of ["knife", "poison"] as const)
    test(`${locale}/${cause}: a pending-night White Wolf King cannot swallow death; a higher valid ordinary wolf can still interrupt`, async () => {
      const config = {
        ...board(ActionWindow.OnPreElection),
        roleSetups: [
          { role: Role.WhiteWolfKing, count: 1 },
          { role: Role.Wolf, count: 1 },
          { role: Role.Seer, count: 1 },
          { role: Role.Witch, count: 1 },
          { role: Role.Villager, count: 2 },
        ],
      };
      const game = bootstrapGame(config, {
        locale,
        fixedRoles: [
          Role.WhiteWolfKing,
          Role.Wolf,
          Role.Seer,
          Role.Witch,
          Role.Villager,
          Role.Villager,
        ],
      });
      let whiteRequests = 0,
        elections = 0;
      const snapshot = await game.phaseManager.runSingleCycle({
        async getAction(request) {
          if (request.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (request.allowedTools.includes("kill_vote"))
            return {
              name: "kill_vote",
              args: { target_id: cause === "knife" ? 1 : 5, abstain: false },
            };
          if (request.allowedTools.includes("check_identity"))
            return { name: "check_identity", args: { target_id: 1 } };
          if (request.allowedTools.includes("use_potion"))
            return {
              name: "use_potion",
              args: {
                target_id: 1,
                potion_type: (cause === PotionType.Poison
                  ? PotionType.Poison
                  : PotionType.None) as never,
              },
            };
          if (request.allowedTools.includes("self_destruct_with_target")) {
            whiteRequests++;
            expect(request.context).not.toHaveProperty("death_sources");
            expect(getWhiteWolfKingState(role(game.world, 1))?.canDetonate).toBe(true);
            const accepted = new ActionReception(game.world).validate(
              request,
              "self_destruct_with_target",
              call(3).args,
            );
            expect(accepted.ok).toBe(true);
            return call(3);
          }
          if (request.allowedTools.includes("self_destruct"))
            return {
              name: "self_destruct",
              args: { reason: "Second valid choice", confirm: true },
            };
          if (request.allowedTools.includes("speak"))
            return { name: "speak", args: { text: "Raw" } };
          if (request.allowedTools.includes("run_for_sheriff")) {
            elections++;
            throw new Error("ordinary_interrupt_before_election");
          }
          throw new Error(`unexpected:${request.context.stage}`);
        },
      });
      expect(whiteRequests).toBe(1);
      expect(elections).toBe(0);
      expect(snapshot.result?.winner).toBe(Camp.Good);
      expect(snapshot.result?.decidedAt).toEqual({
        day: 1,
        phase: Phase.Day,
        checkpoint: "day_interrupted",
      });
      expect(getWhiteWolfKingState(role(game.world, 1))?.canDetonate).toBe(true);
      expect(game.world.getAliveEntityIds()).toContain(3);
      const events = game.phaseManager.getEvents();
      expect(events.filter((event) => event.type === "white_wolf_king_self_destruct")).toEqual([]);
      expect(
        events
          .filter((event) => event.type === "wolf_self_destruct")
          .map((event) => event.payload.wolfId),
      ).toEqual([2]);
      expect(
        events
          .filter((event) => event.type === "last_words_spoken")
          .map((event) => event.payload.playerId),
      ).toEqual(cause === "knife" ? [1] : [1, 5]);
    });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: a White Wolf King explicitly taking nobody consumes one chance and settles its badge`, async () => {
    const game = bootstrapGame(
      { ...board(ActionWindow.OnPreVote), initialSheriffSeat: 1 },
      { locale, fixedRoles: deck },
    );
    const snapshot = await game.phaseManager.runSingleCycle({
      async getAction(request) {
        if (request.allowedTools.includes("speak_to_wolves"))
          return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
        if (request.allowedTools.includes("kill_vote"))
          return { name: "kill_vote", args: { target_id: 5, abstain: false } };
        if (request.allowedTools.includes("check_identity"))
          return { name: "check_identity", args: { target_id: 1 } };
        if (request.allowedTools.includes("self_destruct_with_target")) return call(null);
        if (request.allowedTools.includes("self_destruct")) return null;
        if (request.allowedTools.includes("speak")) return { name: "speak", args: { text: "Raw" } };
        if (request.allowedTools.includes("choose_direction"))
          return { name: "choose_direction", args: { direction: "clockwise" } };
        throw new Error(`unexpected:${request.context.stage}`);
      },
    });
    expect(snapshot.phase).toBe(Phase.Night);
    expect(snapshot.day).toBe(2);
    expect(snapshot.gameOver).toBe(false);
    expect(game.world.getAliveEntityIds()).toEqual([2, 3, 4, 6]);
    expect(getWhiteWolfKingState(role(game.world, 1))?.canDetonate).toBe(false);
    const events = game.phaseManager.getEvents();
    expect(
      events
        .filter((event) => event.type === "white_wolf_king_self_destruct")
        .map((event) => event.payload),
    ).toEqual([{ actorId: 1, targetId: null, window: ActionWindow.OnPreVote }]);
    expect(events.filter((event) => event.type === "hunter_shot")).toEqual([]);
    expect(
      events
        .filter((event) => event.type === "sheriff_badge_transferred")
        .map((event) => event.payload),
    ).toEqual([{ fromId: 1, toId: 2, reason: "self_destruct" }]);
  });

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: real night guard protection does not stop the later public take, and a pending poisoned target stays one forbidden death`, async () => {
    for (const poison of [false, true]) {
      const extra = poison ? Role.Witch : Role.Guard;
      const config = {
        ...board(poison ? ActionWindow.OnPreElection : ActionWindow.OnDaybreak),
        roleSetups: [
          { role: Role.WhiteWolfKing, count: 1 },
          { role: Role.Wolf, count: 1 },
          { role: Role.Seer, count: 1 },
          { role: Role.Hunter, count: 1 },
          { role: extra, count: 1 },
          { role: Role.Villager, count: 1 },
        ],
      };
      const game = bootstrapGame(config, {
        locale,
        fixedRoles: [Role.WhiteWolfKing, Role.Wolf, Role.Seer, Role.Hunter, extra, Role.Villager],
      });
      let guns = 0;
      const snapshot = await game.phaseManager.runSingleCycle({
        async getAction(request) {
          if (request.allowedTools.includes("speak_to_wolves"))
            return { name: "speak_to_wolves", args: { text: "End", end_chat: true } };
          if (request.allowedTools.includes("kill_vote"))
            return { name: "kill_vote", args: { target_id: 4, abstain: false } };
          if (request.allowedTools.includes("check_identity"))
            return { name: "check_identity", args: { target_id: 1 } };
          if (request.allowedTools.includes("guard"))
            return { name: "guard", args: { target_id: 4, abstain: false } };
          if (request.allowedTools.includes("use_potion"))
            return {
              name: "use_potion",
              args: { target_id: 4, potion_type: PotionType.Poison as never },
            };
          if (request.allowedTools.includes("self_destruct_with_target")) return call(4);
          if (request.allowedTools.includes("self_destruct")) return null;
          if (request.allowedTools.includes("shoot")) {
            guns++;
            expect(request.context.death_sources).toEqual([DeathCause.WhiteWolfBlast]);
            return { name: "shoot", args: { target_id: 2 } };
          }
          if (request.allowedTools.includes("run_for_sheriff"))
            return { name: "run_for_sheriff", args: { run: false } };
          if (request.allowedTools.includes("speak"))
            return { name: "speak", args: { text: "Raw" } };
          throw new Error(`unexpected:${request.context.stage}`);
        },
      });
      const events = game.phaseManager.getEvents();
      expect(events.filter((event) => event.type === "white_wolf_king_self_destruct")).toHaveLength(
        1,
      );
      expect(events.filter((event) => event.type === "last_words_spoken")).toEqual([]);
      expect(guns).toBe(poison ? 0 : 1);
      expect(getHunterState(role(game.world, 4))?.canShoot).toBe(false);
      expect(game.world.getAliveEntityIds()).toEqual(poison ? [2, 3, 5, 6] : [3, 5, 6]);
      if (poison) {
        expect(snapshot.gameOver).toBe(false);
        expect(snapshot.day).toBe(2);
        expect(snapshot.phase).toBe(Phase.Night);
        expect(events.filter((event) => event.type === "hunter_silent_due_to_poison")).toHaveLength(
          1,
        );
      } else {
        expect(snapshot.result?.winner).toBe(Camp.Good);
        expect(events.find((event) => event.type === "night_resolved")?.payload.deaths).toEqual([]);
      }
    }
  });
