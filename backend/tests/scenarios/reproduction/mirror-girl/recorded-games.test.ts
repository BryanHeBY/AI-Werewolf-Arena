/**
 * 复现场景验证魔镜少女完整录制对局保留唯一查验历史、隐私及终局资源生命期。
 * 输入为原场景／传输／语言矩阵，以及手写目标、身份标签、跳过／无目标和存活者事实。
 * 输出与预期为明确私有知识、机会／库存及结果断言，保留精确重放；历史预期仍由声明表提供。
 */
import { Camp, DeathCause, Phase } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import {
  MIRROR_CASES,
  mirrorScenario,
  type MirrorScenario,
} from "../../../support/features/mirror-girl/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";

const facts: Record<
  MirrorScenario,
  {
    alive: number[];
    words: number[];
    day: number;
    wolf?: boolean;
    targets: number[];
    roles: string[];
    skips: Array<[number, "passed" | "no_targets"]>;
  }
> = {
  skip: {
    alive: [2, 3, 4],
    words: [1, 6],
    day: 2,
    wolf: true,
    targets: [2],
    roles: ["wolf"],
    skips: [[2, "passed"]],
  },
  unique: {
    alive: [2, 3, 4],
    words: [1, 6],
    day: 2,
    wolf: true,
    targets: [2, 4],
    roles: ["wolf", "witch"],
    skips: [],
  },
  good: {
    alive: [3, 4, 6],
    words: [1, 2],
    day: 2,
    targets: [2, 4],
    roles: ["wolf", "witch"],
    skips: [],
  },
  twelve: {
    alive: [5, 8, 10, 11, 12],
    words: [4, 9, 1],
    day: 3,
    targets: [6, 1, 8],
    roles: ["witch", "wolf", "guard"],
    skips: [],
  },
  king_badge: {
    alive: [4, 5, 6],
    words: [1, 2],
    day: 1,
    targets: [1],
    roles: ["wolf_king"],
    skips: [],
  },
  hidden_before: {
    alive: [3, 4, 6],
    words: [1, 2],
    day: 2,
    targets: [2, 4],
    roles: ["villager", "witch"],
    skips: [],
  },
  hidden_after: {
    alive: [3, 4, 6],
    words: [1, 2],
    day: 2,
    targets: [2],
    roles: ["hidden_wolf"],
    skips: [[1, "passed"]],
  },
  exhausted: {
    alive: [2, 3, 4],
    words: [1],
    day: 7,
    wolf: true,
    targets: [2, 1, 4, 5, 6],
    roles: ["wolf", "wolf", "witch", "villager", "villager"],
    skips: [
      [6, "no_targets"],
      [7, "no_targets"],
    ],
  },
};

for (const kind of MIRROR_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: real bilingual Mirror games enforce unique history, privacy and exact terminal lifecycle with strict Tape`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = mirrorScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const oracle = facts[kind],
          actor = kind === "twelve" ? 5 : 3,
          events = run.replay.events;
        const reportDays = kind === "hidden_after" ? [2] : oracle.targets.map((_, i) => i + 1);
        expect(events.filter((e) => e.type === "role_inspected").map((e) => e.payload)).toEqual(
          oracle.targets.map((targetId, i) => ({
            actorId: actor,
            targetId,
            day: reportDays[i],
            result: { kind: "role", role: oracle.roles[i] },
          })),
        );
        expect(
          events.filter((e) => e.type === "role_inspection_skipped").map((e) => e.payload),
        ).toEqual(oracle.skips.map(([day, reason]) => ({ actorId: actor, day, reason })));
        const ability = Object.values(
          run.record.checkpoints.at(-1)!.players.find((p) => p.id === actor)!.privateState
            .abilities as any,
        ).find((a: any) => a.kind === "role_check") as any;
        expect(ability).toMatchObject({
          uses: oracle.targets.length,
          lastUsedDay: oracle.day,
          state: { policy: "mirror" },
        });
        expect(
          ability.state.history.map((report: any) => [report.targetId, report.result.role]),
        ).toEqual(oracle.targets.map((target, i) => [target, oracle.roles[i]]));
        expect(new Set(ability.state.history.map((report: any) => report.targetId)).size).toBe(
          ability.state.history.length,
        );
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          oracle.alive,
        );
        expect(
          events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
        ).toEqual(oracle.words);
        const faction = oracle.wolf ? Camp.Wolf : Camp.Good,
          winners =
            kind === "twelve" ? [5, 6, 7, 8, 9, 10, 11, 12] : oracle.wolf ? [1, 2] : [3, 4, 5, 6];
        expect(run.result.snapshot.result).toEqual({
          winner: faction,
          reason: oracle.wolf ? "slaughter_side_completed" : "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction, winningPlayerIds: winners },
            additional: [],
            winningPlayerIds: winners,
          },
          decidedAt: {
            day: oracle.day,
            phase: kind === "exhausted" ? Phase.Day : Phase.Voting,
            checkpoint: kind === "exhausted" ? "night_settled" : "exile_settled",
          },
        });
        if (kind === "king_badge") {
          expect(events.filter((e) => e.type === "wolf_king_shot").map((e) => e.payload)).toEqual([
            { actorId: 1, targetId: 3 },
          ]);
          expect(
            events.filter((e) => e.type === "sheriff_badge_transferred").map((e) => e.payload),
          ).toEqual([
            { fromId: 1, toId: 2, reason: "night_death" },
            { fromId: 2, toId: 4, reason: "voted_out" },
          ]);
        }
        if (kind === "twelve") {
          expect(events.filter((e) => e.type === "hunter_shot").map((e) => e.payload)).toEqual([
            { hunterId: 7, targetId: 2 },
          ]);
          for (const view of run.views) {
            const shots = view.timeline.filter(
              (e) => e.kind === "event" && e.event.type === "player_shot",
            );
            expect(shots).toHaveLength(1);
            expect(shots[0]).toMatchObject({
              stage: "death_shot",
              event: { type: "player_shot", payload: { actorId: 7, targetId: 2 } },
            });
            expect(
              view.timeline.some((e) => e.kind === "event" && e.event.type === "hunter_shot"),
            ).toBe(false);
          }
        }
        for (const view of run.views) {
          expect(
            view.timeline.filter((e) => e.kind === "event" && e.event.type === "role_inspected"),
          ).toHaveLength(view.player_id === actor ? oracle.targets.length : 0);
          expect(
            view.timeline.filter(
              (e) => e.kind === "event" && e.event.type === "role_inspection_skipped",
            ),
          ).toHaveLength(view.player_id === actor ? oracle.skips.length : 0);
        }
        expect(
          [...run.rejected.values()].reduce((a, b) => a + b, 0) +
            run.acpTraces.reduce((a, row) => a + row.trace.rejected, 0),
        ).toBe(["unique", "twelve", "hidden_before"].includes(kind) ? 1 : 0);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (["skip", "twelve", "exhausted", "king_badge"].includes(kind) && transport === "llm")
          await writeFile(
            `/tmp/awa-p7-mirror-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...event }) => event);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
