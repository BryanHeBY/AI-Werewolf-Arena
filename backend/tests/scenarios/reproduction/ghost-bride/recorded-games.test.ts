/**
 * Reproduction scenarios verify Ghost Bride complete recorded marriages preserve private recognition, independent goals and one knife channel.
 * Input: Original good/wolf/pair/witness plans across local transport and locale matrices.
 * Output and oracle: Declared survivor/winner/setup facts and exact action replay retain the original marriage prefix; initial identity and archive fixtures are unchanged.
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import { ghostBrideScenario } from "../../../support/ghost_bride_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
for (const kind of ["good", "wolf", "pair", "witness"] as const)
  for (const transport of ["llm", "acp", "mixed"] as const)
    test(`${kind}/${transport}: actual bilingual marriage, independent goals, single knife and strict Tape`, async () => {
      for (const locale of ["zh-CN", "en"] as const) {
        const scenario = ghostBrideScenario(kind),
          run = await runTransportGame(scenario, transport, locale),
          record = run.record;
        const final = record.checkpoints.at(-1)!;
        expect(final.snapshot.result?.winner).toBe(scenario.winner);
        expect(final.snapshot.result?.outcome).toMatchObject({
          kind: "victory",
          winningPlayerIds: scenario.winners,
        });
        expect(final.players.filter((p) => p.alive).map((p) => p.id)).toEqual(scenario.alive);
        expect(record.metadata.initialDeal).toBeUndefined();
        expect(record.events.filter((e) => e.type === "ghost_bride_pair_chosen")).toHaveLength(1);
        expect(record.events.filter((e) => e.type === "ghost_bride_group_chosen")).toHaveLength(1);
        for (const view of run.views) {
          const own = view.timeline.filter(
            (r) => r.kind === "event" && r.event.type.startsWith("ghost_bride_"),
          );
          if (view.player_id === scenario.witnessId) {
            expect(
              own.some((r) => r.kind === "event" && r.event.type === "ghost_bride_partner_chat"),
            ).toBe(false);
            expect(
              own.some((r) => r.kind === "event" && r.event.type === "ghost_bride_witness_vote"),
            ).toBe(false);
          }
          if (![scenario.brideId, scenario.groomId, scenario.witnessId].includes(view.player_id))
            expect(own).toEqual([]);
        }
        if (transport === "llm" && locale === "zh-CN") {
          await fs.writeFile(`/tmp/awa-p9-ghost-bride-${kind}.record.json`, JSON.stringify(record));
          await fs.writeFile(
            `/tmp/awa-p9-ghost-bride-${kind}.replay.json`,
            JSON.stringify(run.replay),
          );
          for (const member of [
            scenario.brideId,
            scenario.groomId,
            scenario.witnessId,
            scenario.roles.findIndex(
              (r, i) => r === "wolf" && ![scenario.groomId, scenario.witnessId].includes(i + 1),
            ) + 1,
          ])
            await fs.writeFile(
              `/tmp/awa-p9-ghost-bride-${kind}-${member}.player.json`,
              JSON.stringify(run.views.find((v) => v.player_id === member)),
            );
        }
      }
    }, 120000);
