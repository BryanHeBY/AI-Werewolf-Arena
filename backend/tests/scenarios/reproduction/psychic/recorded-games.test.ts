/**
 * 复现场景验证通灵师完整录制对局保留私有身份标签及重复／跳过的查验机会。
 * 输入为原场景／传输／语言矩阵，以及手写标签、跳过、使用次数、存活者和遗言事实。
 * 输出与预期为字面受众／资源／终局断言，与实际重放保持因果对应；预期状态独立于观察到的引擎输出。
 */
import { Camp, DeathCause, Phase } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { PSYCHIC_CASES, psychicScenario, type PsychicScenario } from "../../../support/features/psychic/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
const facts: Record<
  PsychicScenario,
  {
    alive: number[];
    words: number[];
    day: number;
    wolf?: boolean;
    roles: string[];
    skip: number[];
    uses: number;
  }
> = {
  six_skip: {
    alive: [2, 3, 4],
    words: [1, 6],
    day: 2,
    wolf: true,
    roles: ["wolf"],
    skip: [2],
    uses: 1,
  },
  six_repeat: {
    alive: [2, 3, 4],
    words: [1, 6],
    day: 2,
    wolf: true,
    roles: ["wolf", "wolf"],
    skip: [],
    uses: 2,
  },
  six_good: { alive: [3, 4, 6], words: [1, 2], day: 2, roles: ["wolf", "wolf"], skip: [], uses: 2 },
  twelve: {
    alive: [5, 8, 10, 11, 12],
    words: [4, 9, 1],
    day: 3,
    roles: ["witch", "wolf", "wolf"],
    skip: [],
    uses: 3,
  },
  king_link: { alive: [4, 5, 6], words: [1, 2], day: 1, roles: ["wolf_king"], skip: [], uses: 1 },
  hidden_mask: {
    alive: [3, 4, 6],
    words: [1, 2],
    day: 2,
    roles: ["villager", "hidden_wolf"],
    skip: [],
    uses: 2,
  },
};
for (const kind of PSYCHIC_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual Spirit Seer games preserve role labels, repeat/pass opportunities, private audiences and strict Tape`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = psychicScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const oracle = facts[kind],
          events = run.replay.events,
          actor = kind === "twelve" ? 5 : 3;
        expect(
          events.filter((e) => e.type === "role_inspected").map((e) => e.payload.result),
        ).toEqual(oracle.roles.map((role) => ({ kind: "role", role })));
        expect(
          events.filter((e) => e.type === "role_inspection_skipped").map((e) => e.payload),
        ).toEqual(oracle.skip.map((day) => ({ actorId: actor, day, reason: "passed" })));
        const ability = Object.values(
          run.record.checkpoints.at(-1)!.players.find((p) => p.id === actor)!.privateState
            .abilities as any,
        ).find((a: any) => a.kind === "role_check") as any;
        expect(ability.uses).toBe(oracle.uses);
        expect(ability.lastUsedDay).toBe(oracle.day);
        expect(ability.state.policy).toBe("psychic");
        expect(ability.state.history.map((r: any) => r.result.role)).toEqual(oracle.roles);
        const targets =
          kind === "twelve" ? [6, 1, 1] : kind === "king_link" ? [1] : oracle.roles.map(() => 2);
        expect(
          events
            .filter((e) => e.type === "role_inspected")
            .map((e) => ({
              actorId: e.payload.actorId,
              targetId: e.payload.targetId,
              day: e.payload.day,
              result: e.payload.result,
            })),
        ).toEqual(
          oracle.roles.map((role, index) => ({
            actorId: actor,
            targetId: targets[index],
            day: index + 1,
            result: { kind: "role", role },
          })),
        );
        if (kind === "twelve") {
          expect(
            events
              .filter((e) => e.type === "witch_potion_used")
              .map((e) => [e.payload.targetId, e.payload.potionType]),
          ).toEqual([
            [9, "heal"],
            [3, "poison"],
          ]);
          expect(events.filter((e) => e.type === "hunter_shot").map((e) => e.payload)).toEqual([
            { hunterId: 7, targetId: 2 },
          ]);
          expect(
            events.filter((e) => e.type === "sheriff_elected").map((e) => e.payload.winnerId),
          ).toEqual([5]);
        }
        if (kind === "king_link") {
          const report = events.findIndex((e) => e.type === "role_inspected"),
            shot = events.findIndex((e) => e.type === "wolf_king_shot"),
            roar = events.findIndex((e) => e.type === "bear_roared");
          expect(report).toBeLessThan(shot);
          expect(shot).toBeLessThan(roar);
          expect(events[shot].payload).toEqual({ actorId: 1, targetId: 3 });
        }
        expect(
          events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
        ).toEqual(oracle.words);
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          oracle.alive,
        );
        const wolves = scenario.roles.flatMap((r, i) =>
            ["wolf", "wolf_king", "hidden_wolf"].includes(r) ? [i + 1] : [],
          ),
          winners = oracle.wolf
            ? wolves
            : scenario.roles.flatMap((_, i) => (!wolves.includes(i + 1) ? [i + 1] : [])),
          faction = oracle.wolf ? Camp.Wolf : Camp.Good;
        expect(run.result.snapshot.result).toEqual({
          winner: faction,
          reason: oracle.wolf ? "slaughter_side_completed" : "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction, winningPlayerIds: winners },
            additional: [],
            winningPlayerIds: winners,
          },
          decidedAt: { day: oracle.day, phase: Phase.Voting, checkpoint: "exile_settled" },
        });
        for (const view of run.views) {
          expect(
            view.timeline.filter((e) => e.kind === "event" && e.event.type === "role_inspected"),
          ).toHaveLength(view.player_id === actor ? oracle.roles.length : 0);
          expect(
            view.timeline.filter(
              (e) => e.kind === "event" && e.event.type === "role_inspection_skipped",
            ),
          ).toHaveLength(view.player_id === actor ? oracle.skip.length : 0);
        }
        expect(run.rejected.size).toBe(0);
        expect(run.acpTraces.every((row) => row.trace.rejected === 0)).toBe(true);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (["six_skip", "twelve", "hidden_mask"].includes(kind) && transport === "llm")
          await writeFile(
            `/tmp/awa-p7-psychic-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...e }) => e);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
