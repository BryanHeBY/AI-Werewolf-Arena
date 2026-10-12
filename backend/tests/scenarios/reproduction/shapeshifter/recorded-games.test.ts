/**
 * Reproduction scenarios verify Shapeshifter complete recorded games preserve the initial swap window and full-deal archive contract.
 * Input: Original board-size, swap/keep/bottom-role, transport and locale matrices and copied original-record forgeries.
 * Output and oracle: Declared initial deal, final roles and private knowledge assertions retain exact replay; action matrices and source fixture bytes are unchanged.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { Camp, Role } from "../../../../src/core";
import { SHAPESHIFTER_CASES, shapeshifterScenario } from "../../../support/shapeshifter_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
for (const size of [6, 12] as const)
  for (const kind of SHAPESHIFTER_CASES.filter(
    (k) => size === 6 || ["both0", "one1", "seer", "hunter", "bottom"].includes(k),
  ))
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`${size}/${kind}/${transport}: actual bilingual SDK/ACP-MCP initial role swap and strict full-deal Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = shapeshifterScenario(kind, size, locale),
            run = await runTransportGame(scenario, transport, locale),
            record = run.record;
          expect(record.metadata.initialDeal).toEqual(scenario.initialDeal);
          expect(record.metadata.players.map((p) => p.role)).toEqual([...scenario.roles]);
          expect(record.metadata.normalizedBoard.roleSetups.reduce((n, r) => n + r.count, 0)).toBe(
            size,
          );
          const choices = record.decisions.filter((d) => d.stage === "shapeshifter");
          expect(choices).toHaveLength(kind === "bottom" ? 0 : 1);
          if (choices.length)
            expect(choices[0]!.request.context.turn_constraints.min_valid_actions).toBe(1);
          expect(record.checkpoints.at(-1)!.snapshot.result?.winner).toBe(Camp.Good);
          expect(record.checkpoints.at(-1)!.players.map((p) => p.role)).toEqual(
            scenario.finalRoles,
          );
          expect(record.checkpoints.at(-1)!.shapeshifterSetup?.status).toBe("complete");
          for (const view of run.views) {
            expect(
              view.timeline.some(
                (e) => e.kind === "event" && e.event.type === "shapeshifter_initial_deal",
              ),
            ).toBe(false);
            const facts = view.timeline.filter(
              (e) => e.kind === "event" && e.event.type === "shapeshifter_identity_chosen",
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
              `/tmp/awa-p9-shapeshifter-${size}-${kind}.replay.json`,
              JSON.stringify(run.replay),
            );
            await fs.writeFile(
              `/tmp/awa-p9-shapeshifter-${size}-${kind}.record.json`,
              JSON.stringify(record),
            );
            const own = run.views.find((v) => v.player_id === scenario.actorId);
            if (own)
              await fs.writeFile(
                `/tmp/awa-p9-shapeshifter-${size}-${kind}.player.json`,
                JSON.stringify(own),
              );
          }
          if (kind === "seer" && size === 6 && transport === "llm" && locale === "zh-CN") {
            for (const mutate of [
              (r: typeof record) => {
                const d = r.decisions.find((d) => d.stage === "shapeshifter")!;
                d.request.actorId = d.actorId === 1 ? 2 : 1;
              },
              (r: typeof record) => {
                r.decisions.find((d) => d.stage === "shapeshifter")!.request.context.stage = "seer";
              },
              (r: typeof record) => {
                r.decisions.find((d) => d.stage === "shapeshifter")!.request.context.day = 2;
              },
              (r: typeof record) => {
                const d = r.decisions.find((d) => d.stage === "shapeshifter")!;
                if (d.outcome.kind === "action") (d.outcome.action!.args as any).extra = true;
              },
              (r: typeof record) => {
                const d = structuredClone(r.decisions.find((d) => d.stage === "shapeshifter")!);
                d.stage = "thief";
                d.request.context.stage = "thief";
                d.request.allowedTools = ["choose_thief_card"];
                r.decisions.push(d);
              },
              (r: typeof record) => {
                r.events.push({
                  timestamp: 0,
                  type: "thief_identity_chosen",
                  payload: {
                    actorId: scenario.actorId,
                    day: 1,
                    slot: 0,
                    role: Role.Wolf,
                    camp: Camp.Wolf,
                    policy: "lui_meme_thief_two_extra_villagers_v1",
                  },
                });
              },
              (r: typeof record) => {
                r.checkpoints[0]!.shapeshifterSetup!.status = "complete";
                r.checkpoints[0]!.shapeshifterSetup!.selection = {
                  actorId: scenario.actorId,
                  slot: 0,
                  role: Role.Seer,
                };
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.shapeshifterSetup!.status = "pending";
                r.checkpoints.at(-1)!.shapeshifterSetup!.selection = null;
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
                r.metadata.players[0]!.role = Role.Thief;
              },
              (r: typeof record) => {
                delete r.checkpoints.at(-1)!.shapeshifterSetup;
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.shapeshifterSetup!.reserve[0].cardId = "deal:0";
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.shapeshifterSetup!.selection!.slot = 1;
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
