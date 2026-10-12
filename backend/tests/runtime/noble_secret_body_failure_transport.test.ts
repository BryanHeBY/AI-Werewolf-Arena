import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ActionStage } from "../../src/core";
import type { PlannedTurn } from "../support/foundation_transport_plan";
import { nobleTransportScenario } from "../support/noble_secret_body_transport_scenarios";
import { runTransportGame } from "../support/run_transport_game";
import { assertNobleTransportWire } from "../support/features/noble-secret-body/oracles/wire";
import { assertNobleBadgeRules } from "../support/features/noble-secret-body/oracles/badge-prompt";
const rank: Partial<Record<ActionStage, number>> = {
  secret_body: 150,
  wolf_discussion: 200,
  wolf_vote: 400,
  night_noble: 450,
  witch: 500,
  seer: 600,
  demon_hunter: 650,
};
for (const [stage, old] of [
  ["secret_body", 5],
  ["night_noble", 1],
  ["wolf_discussion", 11],
  ["wolf_vote", 11],
  ["witch", 3],
  ["seer", 2],
  ["demon_hunter", 4],
  ["awakened_idiot_reveal_speech", 5],
] as const)
  for (const mode of ["missing", "late"] as const)
    for (const kind of ["llm", "acp"] as const)
      test(`actual Noble required ${stage}/${mode}/${kind}`, async () => {
        for (const locale of ["en", "zh-CN"] as const) {
          const reveal = stage === "awakened_idiot_reveal_speech",
            scenario = nobleTransportScenario(reveal ? "badge_reveal" : "expiry"),
            day = reveal ? 1 : 2,
            actorId = scenario.mapping.get(old)!,
            turns = new Map<number, PlannedTurn[]>();
          for (const [actor, plan] of scenario.turns)
            turns.set(
              actor,
              plan
                .filter(
                  (t) =>
                    t.day < day ||
                    (t.day === day && (reveal || (rank[t.stage] ?? 1000) <= rank[stage]!)),
                )
                .map((t) =>
                  actor === actorId && t.day === day && t.stage === stage
                    ? { ...t, terminalFailure: mode, action: mode === "late" ? t.action : null }
                    : t,
                ),
            );
          const run = await runTransportGame(
              { ...scenario, turns, expectedFailure: { actorId, stage } },
              kind,
              locale,
            ),
            cp = run.record.checkpoints.at(-1)!;
          assertNobleTransportWire(run);
          assertNobleBadgeRules(run, locale);
          expect(cp.complete).toBe(false);
          expect(cp.snapshot.gameOver).toBe(false);
          expect(run.record.termination!.reason).toBe("runtime_error");
          expect(run.record.events.filter((e) => e.type === "night_resolved")).toHaveLength(1);
          expect(run.diagnostics.pendingDelays).toBe(0);
          if (reveal) {
            const body = cp.players.find((p) => p.id === actorId)!;
            expect(body.alive).toBe(true);
            expect(body.badge!.isSheriff).toBe(true);
            expect(body.vote).toEqual({ weight: 1.5, canVote: true });
            expect(cp.nobleBody!.body.body).toEqual({ kind: "exile_revealed", day: 1 });
            expect(run.record.events.some((e) => e.type === "secret_body_reveal_speech")).toBe(
              false,
            );
            if (kind === "llm" && mode === "missing" && process.env.AWA_NOBLE_FIXTURES) {
              const directory = process.env.AWA_NOBLE_FIXTURES,
                fixture = `noble-failed-reveal-${locale}`;
              await mkdir(path.join(directory, "player-views"), { recursive: true });
              await writeFile(
                path.join(directory, `${fixture}.replay.json`),
                JSON.stringify(run.replay, null, 2) + "\n",
              );
              await writeFile(
                path.join(directory, `${fixture}.checkpoint.txt`),
                JSON.stringify(cp, null, 2) + "\n",
              );
              for (const [label, old] of [
                ["body", 5],
                ["villager", 9],
              ] as const)
                await writeFile(
                  path.join(directory, "player-views", `${fixture}-${label}.player.json`),
                  JSON.stringify(
                    run.views.find((v) => v.player_id === scenario.mapping.get(old)),
                    null,
                    2,
                  ) + "\n",
                );
            }
          } else {
            expect(
              run.record.events.some(
                (e) => e.type === "noble_body_native_damage_committed" && e.payload.day === 2,
              ),
            ).toBe(false);
            expect(cp.nobleBody!.body.body).toEqual({ kind: "intact" });
          }
        }
      }, 120000);
