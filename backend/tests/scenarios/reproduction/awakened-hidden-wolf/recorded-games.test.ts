/**
 * 复现场景验证觉醒隐狼完整录制对局保留学习、原生所有权及继承时点。
 * 输入为原场景／传输／语言矩阵及手写终局、学习模板、死亡和遗言事实。
 * 输出与预期为明确归档资源、阶段、私有视图和结果断言，保留原行动重放，不重新生成 fixture 或声明的预期表。
 */
import { Camp, DeathCause, Phase } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { AWAKENED_CASES, awakenedScenario, type AwakenedScenario } from "../../../support/features/awakened-hidden-wolf/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";

const facts: Record<
  AwakenedScenario,
  {
    alive: number[];
    words: number[];
    day: number;
    template: string;
    learnedDay?: number;
    inheritance: number | null;
    wolf?: boolean;
    night?: boolean;
  }
> = {
  villager: { alive: [3, 4, 5, 6], words: [2, 1], day: 2, template: "villager", inheritance: 1 },
  mirror: { alive: [3, 4, 6], words: [2, 1], day: 2, template: "mirror_girl", inheritance: 1 },
  poison: { alive: [4, 5, 6], words: [2, 1], day: 2, template: "witch", inheritance: 1 },
  guard: { alive: [3, 4, 5, 6], words: [2, 1], day: 4, template: "guard", inheritance: 1 },
  hunter_first: {
    alive: [3, 4, 5, 6],
    words: [1],
    day: 1,
    template: "hunter",
    inheritance: null,
    night: true,
  },
  hunter: { alive: [4, 6], words: [2], day: 2, template: "hunter", inheritance: 1, night: true },
  extra: { alive: [5, 6], words: [3, 2, 1], day: 2, template: "wolf", inheritance: 1 },
  extra_hold: {
    alive: [1, 5],
    words: [3, 2],
    day: 3,
    template: "wolf",
    inheritance: 1,
    night: true,
    wolf: true,
  },
  late: {
    alive: [3, 4, 6],
    words: [2, 1],
    day: 3,
    template: "witch",
    learnedDay: 2,
    inheritance: 1,
  },
  twelve: {
    alive: [5, 6, 10, 11, 12],
    words: [4, 9],
    day: 3,
    template: "hunter",
    inheritance: 2,
    night: true,
  },
};
for (const kind of AWAKENED_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: literal bilingual Awakened games preserve night-end ownership and strict Tape`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = awakenedScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const oracle = facts[kind],
          events = run.replay.events,
          learnedDay = oracle.learnedDay ?? 1;
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          oracle.alive,
        );
        expect(
          events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
        ).toEqual(oracle.words);
        expect(events.filter((e) => e.type === "awakened_mimicked").map((e) => e.payload)).toEqual([
          {
            actorId: 1,
            day: learnedDay,
            targetId: kind === "twelve" ? 7 : 3,
            role: oracle.template,
          },
        ]);
        expect(events.filter((e) => e.type === "awakened_ready").map((e) => e.payload)).toEqual([
          {
            actorId: 1,
            activationNight: learnedDay,
            activeFromNight: learnedDay + 1,
            role: oracle.template,
          },
        ]);
        expect(events.filter((e) => e.type === "awakened_inherited").map((e) => e.payload)).toEqual(
          oracle.inheritance === null
            ? []
            : [{ actorId: 1, day: oracle.inheritance, firstKnifeNight: oracle.inheritance + 1 }],
        );
        expect(
          events.filter((e) => e.type === "awakened_mimic_skipped").map((e) => e.payload.day),
        ).toEqual(kind === "late" ? [1] : []);
        const state = run.record.checkpoints.at(-1)!.players.find((p) => p.id === 1)!.privateState
          .awakened_hidden_wolf as any;
        expect(state.learned).toMatchObject({
          role: oracle.template,
          day: learnedDay,
          activationNight: learnedDay,
          activeFromNight: learnedDay + 1,
        });
        if (kind === "poison" || kind === "late")
          expect(state.learned.skill).toEqual({ kind: "poison", remaining: 0 });
        if (kind.startsWith("extra"))
          expect(state.learned.skill).toEqual({ kind: "wolf", extraKnife: "spent" });
        if (kind === "guard") {
          expect(
            events.filter((e) => e.type === "awakened_guard_chosen").map((e) => e.payload.targetId),
          ).toEqual([6, null, 6]);
          expect(state.learned.skill).toEqual({ kind: "guard", lastTarget: 6, lastGuardDay: 4 });
        }
        if (kind === "extra_hold")
          expect(
            events
              .filter((e) => e.type === "awakened_attack_chosen")
              .map((e) => [e.payload.day, e.payload.targetId]),
          ).toEqual([
            [2, null],
            [3, 6],
          ]);
        if (kind === "mirror") {
          expect(
            events
              .filter((e) => e.type === "role_inspected")
              .map((e) => [e.payload.actorId, e.payload.targetId, e.payload.result]),
          ).toEqual([
            [3, 1, { kind: "role", role: "mirror_girl" }],
            [1, 4, { kind: "role", role: "witch" }],
            [3, 6, { kind: "role", role: "villager" }],
          ]);
          expect(state.learned.skill).toEqual({
            kind: "inspection",
            abilityId: "native:role_check",
          });
        }
        if (kind.startsWith("hunter") || kind === "twelve")
          expect(state.learned.skill).toEqual({ kind: "hunter", armed: true, canShoot: false });
        if (kind === "hunter_first" || kind === "hunter" || kind === "twelve") {
          const shots = events.filter((e) => e.type === "player_shot" || e.type === "hunter_shot");
          expect(
            shots.map((e) => [e.type, e.payload.actorId ?? e.payload.hunterId, e.payload.targetId]),
          ).toEqual(
            kind === "hunter_first"
              ? [["player_shot", 1, 2]]
              : kind === "hunter"
                ? [
                    ["player_shot", 1, 3],
                    ["hunter_shot", 3, 5],
                  ]
                : [
                    ["hunter_shot", 7, 2],
                    ["player_shot", 1, 8],
                  ],
          );
          expect(events.findIndex((e) => e.type === "awakened_ready")).toBeLessThan(
            events.indexOf(shots[0]),
          );
          expect(events.indexOf(shots.at(-1)!)).toBeLessThan(
            events.findIndex((e) => e.type === "game_over"),
          );
          if (kind === "twelve") {
            const inherited = events.findIndex((e) => e.type === "awakened_inherited");
            expect(events.indexOf(shots[0])).toBeLessThan(inherited);
            expect(inherited).toBeLessThan(events.indexOf(shots[1]));
          }
        }
        const faction = oracle.wolf ? Camp.Wolf : Camp.Good,
          winners = scenario.roles.flatMap((role, i) =>
            ["wolf", "awakened_hidden_wolf"].includes(role) === !!oracle.wolf ? [i + 1] : [],
          );
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
            phase: oracle.night ? Phase.Day : Phase.Voting,
            checkpoint: oracle.night ? "night_settled" : "exile_settled",
          },
        });
        for (const view of run.views) {
          expect(
            view.timeline.filter(
              (row) => row.kind === "event" && row.event.type === "awakened_mimicked",
            ),
          ).toHaveLength(view.player_id === 1 ? 1 : 0);
          expect(
            view.timeline.filter(
              (row) => row.kind === "event" && row.event.type === "awakened_ready",
            ),
          ).toHaveLength(view.player_id === 1 ? 1 : 0);
          for (const row of view.timeline)
            if (row.kind === "event" && row.event.type === "player_shot") {
              expect(row.stage).toBe("death_shot");
              expect(Object.keys(row.event.payload).sort()).toEqual(["actorId", "targetId"]);
            }
        }
        expect(
          [...run.rejected.values()].reduce((a, b) => a + b, 0) +
            run.acpTraces.reduce((a, row) => a + row.trace.rejected, 0),
        ).toBe(kind === "guard" ? 1 : 0);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (
          transport === "llm" &&
          ["twelve", "guard", "mirror", "extra_hold", "hunter_first"].includes(kind)
        )
          await writeFile(
            `/tmp/awa-p7-awakened-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      expect(runs[0].result).toEqual(runs[1].result);
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
