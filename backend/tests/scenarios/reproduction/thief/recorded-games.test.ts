/**
 * Reproduction scenarios verify Thief complete recorded games preserve the initial role choice, bottom cards and full-deal archive contract.
 * Input: Original six/twelve-player choice/keep/native-role plans, transports, locales and copied original-record forgeries.
 * Output and oracle: Literal initial-deal/final-role/private-view and terminal assertions retain exact reproduction; no card expectation is derived from a second game.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { Camp, Role } from "../../../../src/core";
import { THIEF_CASES, thiefScenario } from "../../../support/thief_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
for (const size of [6, 12] as const)
  for (const kind of THIEF_CASES.filter(
    (k) => size === 6 || ["both0", "keep", "seer", "hunter"].includes(k),
  ))
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`${size}/${kind}/${transport}: actual bilingual SDK/ACP-MCP initial role swap and strict full-deal Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = thiefScenario(kind, size, locale),
            run = await runTransportGame(scenario, transport, locale),
            record = run.record;
          expect(record.metadata.initialDeal).toEqual(scenario.initialDeal);
          expect(record.metadata.players.map((p) => p.role)).toEqual([...scenario.roles]);
          expect(record.metadata.normalizedBoard.roleSetups.reduce((n, r) => n + r.count, 0)).toBe(
            size,
          );
          const choices = record.decisions.filter((d) => d.stage === "thief");
          expect(choices).toHaveLength(kind === "bottom" ? 0 : 1);
          if (choices.length)
            expect(choices[0]!.request.context.turn_constraints.min_valid_actions).toBe(
              kind.startsWith("both") ? 1 : 0,
            );
          expect(record.checkpoints.at(-1)!.snapshot.result?.winner).toBe(Camp.Good);
          expect(record.checkpoints.at(-1)!.players.map((p) => p.role)).toEqual(
            scenario.finalRoles,
          );
          expect(record.checkpoints.at(-1)!.thiefSetup?.status).toBe("complete");
          for (const view of run.views) {
            expect(
              view.timeline.some(
                (e) => e.kind === "event" && e.event.type === "thief_initial_deal",
              ),
            ).toBe(false);
            const facts = view.timeline.filter(
              (e) => e.kind === "event" && e.event.type === "thief_identity_chosen",
            );
            expect(facts).toHaveLength(view.player_id === scenario.actorId ? 1 : 0);
          }
          if (kind === "hunter")
            expect(
              record.events.some(
                (e) => e.type === "hunter_shot" && e.payload.hunterId === scenario.actorId,
              ),
            ).toBe(true);
          if (kind === "seer")
            expect(
              record.decisions.some(
                (d) => d.actorId === scenario.actorId && d.stage === "seer" && d.day === 1,
              ),
            ).toBe(true);
          if (kind === "witch")
            expect(
              record.decisions.some(
                (d) => d.actorId === scenario.actorId && d.stage === "witch" && d.day === 1,
              ),
            ).toBe(true);
          if (kind === "guard")
            expect(
              record.decisions.some(
                (d) => d.actorId === scenario.actorId && d.stage === "guard" && d.day === 1,
              ),
            ).toBe(true);
          if (kind === "wolf" || kind.startsWith("both"))
            expect(
              record.decisions.some(
                (d) => d.actorId === scenario.actorId && d.stage === "wolf_vote" && d.day === 1,
              ),
            ).toBe(true);
          if (transport === "llm" && locale === "zh-CN") {
            await fs.writeFile(
              `/tmp/awa-p9-thief-${size}-${kind}.replay.json`,
              JSON.stringify(run.replay),
            );
            await fs.writeFile(
              `/tmp/awa-p9-thief-${size}-${kind}.record.json`,
              JSON.stringify(record),
            );
          }
          if (kind === "seer" && size === 6 && transport === "llm" && locale === "zh-CN") {
            for (const mutate of [
              (r: typeof record) => {
                r.events.push({
                  timestamp: 0,
                  type: "shapeshifter_identity_chosen",
                  payload: {
                    actorId: scenario.actorId,
                    day: 1,
                    slot: 0,
                    role: Role.Wolf,
                    camp: Camp.Wolf,
                    policy: "awa_netease_shapeshifter_two_extra_villagers_v1",
                  },
                });
              },
              (r: typeof record) => {
                const d = structuredClone(r.decisions.find((d) => d.stage === "thief")!);
                d.stage = "shapeshifter";
                d.request.context.stage = "shapeshifter";
                d.request.allowedTools = ["choose_shapeshifter_card"];
                r.decisions.push(d);
              },
              (r: typeof record) => {
                r.checkpoints[0]!.thiefSetup!.status = "complete";
                r.checkpoints[0]!.thiefSetup!.selection = {
                  actorId: scenario.actorId,
                  slot: null,
                  role: Role.Thief,
                };
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.thiefSetup!.status = "pending";
                r.checkpoints.at(-1)!.thiefSetup!.selection = null;
              },
              (r: typeof record) => {
                delete r.metadata.initialDeal;
              },
              (r: typeof record) => {
                r.metadata.initialDeal!.pop();
              },
              (r: typeof record) => {
                r.metadata.initialDeal![size] = Role.Wolf;
              },
              (r: typeof record) => {
                r.metadata.players[0]!.role = Role.Wolf;
              },
              (r: typeof record) => {
                delete r.checkpoints.at(-1)!.thiefSetup;
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.thiefSetup!.reserve[0].cardId = "deal:0";
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.thiefSetup!.selection!.slot = 1;
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.players[scenario.actorId - 1]!.camp = Camp.Wolf;
              },
            ]) {
              const corrupted = structuredClone(record);
              mutate(corrupted);
              expect(() => parseReproductionRecord(corrupted)).toThrow();
            }
          }
        }
      }, 120000);
