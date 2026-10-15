/**
 * Reproduction scenarios verify Miracle Merchant and Lucky complete recorded games retain actor-local gifted resources and private effects.
 * Input: Original skill, hold, late, backlash and compound scenario matrices with handwritten targets, survivors and last words.
 * Output and oracle: Literal gift, use/consumption, privacy and terminal assertions remain tied to actual replay; existing archived fixture bytes remain unchanged.
 */
import { Camp, DeathCause, Phase } from "../../../../src/domain";
import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { MERCHANT_CASES, merchantScenario, type MerchantScenario } from "../../../support/features/miracle-merchant/builders/scenario";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
const facts: Record<
  MerchantScenario,
  {
    alive: number[];
    words: number[];
    day: number;
    night?: boolean;
    target: number;
    skill: string;
    backlash?: boolean;
  }
> = {
  check: { alive: [3, 5], words: [1, 2], day: 2, target: 4, skill: "check" },
  poison: { alive: [3, 5, 6], words: [1, 2], day: 1, target: 5, skill: "poison" },
  guard: { alive: [3, 4], words: [1, 2], day: 2, target: 5, skill: "guard" },
  hold: { alive: [3, 6], words: [1, 2], day: 2, target: 6, skill: "check" },
  late: { alive: [3, 4, 6], words: [1], day: 2, night: true, target: 6, skill: "poison" },
  backlash: {
    alive: [5, 6],
    words: [3, 1],
    day: 2,
    night: true,
    target: 1,
    skill: "guard",
    backlash: true,
  },
  dream: { alive: [3, 4], words: [1, 2], day: 2, target: 1, skill: "check", backlash: true },
  hidden: { alive: [4, 5], words: [3, 1, 2], day: 2, target: 2, skill: "poison", backlash: true },
  twelve: { alive: [5, 7, 10, 11, 12], words: [4, 2, 1], day: 3, target: 5, skill: "check" },
};
for (const kind of MERCHANT_CASES)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual Merchant and Lucky complete games preserve actor-local resources, privacy and strict replay`, async () => {
      const runs: Awaited<ReturnType<typeof runTransportGame>>[] = [];
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = merchantScenario(kind),
          run = await runTransportGame(scenario, transport, locale);
        runs.push(run);
        const events = run.replay.events,
          oracle = facts[kind],
          merchant = kind === "twelve" ? 8 : 3;
        expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
          oracle.alive,
        );
        expect(
          events.filter((e) => e.type === "last_words_spoken").map((e) => e.payload.playerId),
        ).toEqual(oracle.words);
        expect(
          events.filter((e) => e.type === "merchant_trade_committed").map((e) => e.payload),
        ).toEqual([
          {
            actorId: merchant,
            day: kind === "late" ? 2 : 1,
            targetId: oracle.target,
            skill: oracle.skill,
          },
        ]);
        expect(
          events.filter((e) => e.type === "merchant_trade_resolved").map((e) => e.payload),
        ).toEqual([
          {
            actorId: merchant,
            day: kind === "late" ? 2 : 1,
            targetId: oracle.target,
            skill: oracle.skill,
            outcome: oracle.backlash ? "backlash" : "granted",
          },
        ]);
        const checkpoint = run.record.checkpoints.at(-1)!;
        expect(
          checkpoint.players.find((p) => p.id === merchant)!.privateState.miracle_merchant,
        ).toEqual({
          remaining: 0,
          closedDay: kind === "late" ? 2 : 1,
          choice: { day: kind === "late" ? 2 : 1, targetId: oracle.target, skill: oracle.skill },
        });
        const lucky = Object.values(
          checkpoint.players.find((p) => p.id === oracle.target)!.privateState.abilities ?? {},
        ).filter((a: any) => a.activation === "lucky") as any[];
        expect(lucky).toHaveLength(oracle.backlash ? 0 : 1);
        if (!oracle.backlash) {
          expect(lucky[0].uses).toBe(1);
          expect(lucky[0].sourceDisclosed).toBe(false);
          expect(lucky[0].id).toBe("gift:miracle");
        }
        if (kind === "guard") {
          expect(lucky[0]).toMatchObject({ disabled: true, deathExpired: true });
          expect(
            events
              .filter((e) => e.type === "guard_applied" && e.payload.actorId === 5)
              .map((e) => [e.day, e.payload.targetId]),
          ).toEqual([
            [1, 6],
            [1, 4],
            [2, 3],
          ]);
        }
        if (kind === "poison") {
          const native = Object.values(
            checkpoint.players.find((p) => p.id === 5)!.privateState.abilities as any,
          ).find((a: any) => a.source.kind === "native") as any;
          expect(native.state).toMatchObject({ heal: 0, poison: 1 });
          expect(lucky[0].state.poison).toBe(0);
        }
        if (kind === "hold")
          expect(
            events.filter((e) => e.type === "lucky_ability_skipped").map((e) => e.payload),
          ).toEqual([{ actorId: 6, abilityId: "gift:miracle", day: 1, kind: "seer_check" }]);
        const winners = kind === "twelve" ? [5, 6, 7, 8, 9, 10, 11, 12] : [3, 4, 5, 6];
        expect(run.result.snapshot.result).toEqual({
          winner: Camp.Good,
          reason: "all_wolves_eliminated",
          outcome: {
            kind: "victory",
            primary: { kind: "faction", faction: Camp.Good, winningPlayerIds: winners },
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
          const projected = view.timeline
            .filter((row) => row.kind === "event")
            .map((row) => row.event);
          expect(projected.some((e) => e.type === "merchant_trade_resolved")).toBe(false);
          expect(projected.filter((e) => e.type === "merchant_trade_committed")).toHaveLength(
            view.player_id === merchant ? 1 : 0,
          );
          for (const e of projected.filter(
            (e) => e.type === "ability_changed" && e.payload.abilityId === "gift:miracle",
          ))
            expect(e.payload.source).toEqual({ kind: "gift" });
        }
        const rejectionCount = ["check", "guard", "twelve"].includes(kind) ? 1 : 0;
        expect(
          [...run.rejected.values()].reduce((a, b) => a + b, 0) +
            run.acpTraces.reduce((a, row) => a + row.trace.rejected, 0),
        ).toBe(rejectionCount);
        expect(events.filter((e) => e.type === "game_over")).toHaveLength(1);
        expect(events.at(-1)!.type).toBe("game_over");
        if (["poison", "dream", "twelve"].includes(kind) && transport === "llm")
          await writeFile(
            `/tmp/awa-p7-merchant-${kind}-${locale}.replay.json`,
            JSON.stringify(run.replay),
          );
      }
      const neutral = (events: (typeof runs)[0]["replay"]["events"]) =>
        events.map(({ timestamp: _time, ...event }) => event);
      expect(runs[0].result).toEqual(runs[1].result);
      expect(neutral(runs[0].replay.events)).toEqual(neutral(runs[1].replay.events));
      expect(runs[0].record.checkpoints).toEqual(runs[1].record.checkpoints);
    }, 120000);
