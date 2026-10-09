import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { Camp, Role } from "../../src/core";
import { WILD_CHILD_CASES, wildChildScenario } from "../support/wild_child_scenarios";
import { runTransportGame } from "../support/run_transport_game";
import { parseReproductionRecord } from "../../src/recording/reproduction";
for (const size of [6, 12] as const)
  for (const kind of WILD_CHILD_CASES.filter(
    (k) => size === 6 || ["wolf_exile", "good_knife", "hunter_chain"].includes(k),
  ))
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`${size}/${kind}/${transport}: actual bilingual model/committed death/next-night pack and strict Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = wildChildScenario(kind, size, locale),
            run = await runTransportGame(scenario, transport, locale),
            record = run.record,
            actor = scenario.actorId;
          expect(record.metadata.players.find((p) => p.id === actor)?.role).toBe(Role.WildChild);
          expect(record.metadata.players.find((p) => p.id === actor)?.camp).toBe(Camp.Good);
          expect(run.replay.players.find((p) => p.player_id === actor)?.camp).toBe(Camp.Good);
          expect(record.decisions.filter((d) => d.stage === "wild_child")).toHaveLength(1);
          expect(
            record.decisions.find((d) => d.stage === "wild_child")?.request.context.allow_fallback,
          ).toBe(false);
          const conversions = record.events.filter((e) => e.type === "wild_child_transformed"),
            activations = record.events.filter((e) => e.type === "wild_child_pack_activated");
          expect(conversions).toHaveLength(scenario.transformed ? 1 : 0);
          expect(activations).toHaveLength(scenario.active ? 1 : 0);
          if (activations.length) expect(activations[0]!.payload.day).toBe(2);
          const final = record.checkpoints.at(-1)!;
          expect(final.snapshot.result?.winner).toBe(Camp.Good);
          expect(final.players.find((p) => p.id === actor)?.role).toBe(Role.WildChild);
          expect(final.players.find((p) => p.id === actor)?.camp).toBe(
            scenario.transformed ? Camp.Wolf : Camp.Good,
          );
          for (const view of run.views) {
            const childFacts = view.timeline.filter(
              (e) => e.kind === "event" && e.event.type.startsWith("wild_child_"),
            );
            expect(childFacts).toHaveLength(
              view.player_id === actor
                ? 1 + (scenario.transformed ? 1 : 0) + (scenario.active ? 1 : 0)
                : 0,
            );
            expect(
              view.timeline.some(
                (e) => e.kind === "event" && e.event.type === "wild_child_model_eliminated",
              ),
            ).toBe(false);
            if (view.player_id === actor) {
              expect(
                view.timeline.some(
                  (e) =>
                    e.kind === "event" &&
                    e.day === 1 &&
                    ["wolf_tactical_order", "wolf_discussion", "wolf_kill_vote_cast"].includes(
                      e.event.type,
                    ),
                ),
              ).toBe(false);
            }
          }
          if (scenario.active)
            expect(
              record.decisions.some(
                (d) => d.actorId === actor && d.day === 2 && d.stage === "wolf_vote",
              ),
            ).toBe(true);
          expect(
            record.decisions.some((d) => d.actorId === actor && d.stage === "on_pre_vote"),
          ).toBe(false);
          if (transport === "llm" && locale === "zh-CN") {
            await fs.writeFile(
              `/tmp/awa-p9-wild-child-${size}-${kind}.replay.json`,
              JSON.stringify(run.replay),
            );
            await fs.writeFile(
              `/tmp/awa-p9-wild-child-${size}-${kind}.record.json`,
              JSON.stringify(record),
            );
          }
          if (size === 6 && kind === "wolf_exile" && transport === "llm" && locale === "zh-CN")
            for (const mutate of [
              (r: typeof record) => {
                r.metadata.players.find((p) => p.id === actor)!.camp = Camp.Wolf;
              },
              (r: typeof record) => {
                r.events.find((e) => e.type === "wild_child_model_eliminated")!.payload.sources = [
                  "not_a_cause",
                ];
              },
              (r: typeof record) => {
                const replacement = r.metadata.players.find(
                  (p) => p.id !== actor && p.id !== scenario.modelId,
                )!.id;
                const commit = `wild-model:${actor}:${replacement}:1`;
                for (const event of r.events) {
                  if (
                    event.type === "wild_child_model_chosen" ||
                    event.type === "wild_child_model_eliminated"
                  )
                    event.payload.targetId = replacement;
                  if (event.type === "wild_child_model_eliminated")
                    event.payload.deadIds = [replacement];
                  if (
                    event.type === "wild_child_model_eliminated" ||
                    event.type === "wild_child_transformed"
                  )
                    event.payload.deathCommit = commit;
                }
                for (const cp of r.checkpoints) {
                  const state = cp.players.find((p) => p.id === actor)!.privateState.wildChild as {
                    choice: { targetId: number } | null;
                  };
                  if (state.choice) state.choice.targetId = replacement;
                }
              },
              (r: typeof record) => {
                r.checkpoints[0]!.players.find((p) => p.id === actor)!.privateState.wildChild = {
                  remaining: 0,
                  status: "active",
                };
              },
              (r: typeof record) => {
                r.events.find((e) => e.type === "wild_child_transformed")!.payload.deathCommit =
                  "wild-model:7:8:9";
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.players.find((p) => p.id === actor)!.camp = Camp.Good;
              },
              (r: typeof record) => {
                r.events.find((e) => e.type === "wild_child_pack_activated")!.payload.day = 1;
              },
              (r: typeof record) => {
                r.events.find((e) => e.type === "wild_child_model_eliminated")!.payload.deadIds = [
                  scenario.modelId,
                  actor,
                ];
              },
              (r: typeof record) => {
                r.checkpoints.at(-1)!.players.find((p) => p.id === actor)!.privateState.wildChild =
                  {
                    policy: "awa_lui_meme_wild_child_v1",
                    remaining: 1,
                    status: "pending",
                    choice: null,
                    eligibleNight: null,
                    activeFromNight: null,
                  };
              },
            ]) {
              const bad = structuredClone(record);
              mutate(bad);
              expect(() => parseReproductionRecord(bad)).toThrow(
                "reproduction_wild_child_state_invalid",
              );
            }
        }
      }, 120000);
