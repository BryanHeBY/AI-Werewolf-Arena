import { parseReproductionRecord } from "../../src/recording/reproduction";
import { expect, test } from "bun:test";
import { magicianScenario } from "../support/magician_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
import type { PlannedTurn } from "../support/foundation_transport_plan";
import { Role } from "../../src/core";
for (const boundary of ["witch", "death_shot", "wolf_discussion"] as const)
  for (const transport of ["llm", "acp"] as const)
    test(`Magician late ${boundary}/${transport} preserves committed prefix`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = magicianScenario(),
          actorId =
            boundary === "death_shot"
              ? scenario.king
              : boundary === "witch"
                ? scenario.roles.indexOf(Role.Witch) + 1
                : scenario.roles.indexOf(Role.Wolf) + 1;
        const before = new Set<string>(
          boundary === "wolf_discussion"
            ? ["magician_exchange", "wolf_discussion"]
            : boundary === "witch"
              ? ["magician_exchange", "wolf_discussion", "wolf_vote", "witch"]
              : [
                  "magician_exchange",
                  "wolf_discussion",
                  "wolf_vote",
                  "witch",
                  "seer",
                  "on_pre_election",
                  "sheriff_nomination",
                  "last_words",
                  "death_shot",
                ],
        );
        const turns = new Map<number, PlannedTurn[]>();
        for (const [actor, plan] of scenario.turns)
          turns.set(
            actor,
            plan
              .filter((t) => t.day === 1 && before.has(t.stage))
              .map((t) =>
                actor === actorId && t.stage === boundary
                  ? { ...t, terminalFailure: "late" as const }
                  : t,
              ),
          );
        const run = await runTransportGame(
          { ...scenario, turns, expectedFailure: { actorId, stage: boundary } },
          transport,
          locale,
        );
        const cp = run.record.checkpoints.at(-1)!;
        expect(cp.complete).toBe(false);
        expect(
          run.record.decisions.some(
            (d) => d.actorId === actorId && d.stage === boundary && d.outcome.kind === "error",
          ),
        ).toBe(true);
        expect(
          run.replay.events.filter((e) => e.type === "magician_exchange_committed"),
        ).toHaveLength(1);
        expect(run.replay.events.some((e) => e.type === "game_over")).toBe(false);
        expect(
          run.replay.events.some(
            (e) => e.type === "death_shot_missed" || e.type === "wolf_king_shot",
          ),
        ).toBe(false);
        if (boundary === "death_shot") {
          expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(1);
          expect(cp.players.find((p) => p.id === actorId)!.privateState).toEqual({
            wolf_king: { canShoot: true },
          });
          const tampered = structuredClone(run.record);
          (
            tampered.checkpoints.at(-1)!.players.find((p) => p.id === actorId)!.privateState
              .wolf_king as { canShoot: boolean }
          ).canShoot = false;
          expect(() => parseReproductionRecord(tampered)).toThrow(
            "reproduction_magician_state_invalid",
          );
        } else {
          expect(run.replay.events.filter((e) => e.type === "night_resolved")).toHaveLength(0);
          expect(run.replay.events.some((e) => e.type === "witch_potion_used")).toBe(false);
        }
      }
    }, 120000);
