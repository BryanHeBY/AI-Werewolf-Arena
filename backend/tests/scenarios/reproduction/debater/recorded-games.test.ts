/**
 * Reproduction scenarios verify Debater complete recorded games preserve strict challenge ballots, blocked voters and terminal timing.
 * Input: Original six/twelve-player success/tie/abstain plans across transport and locale matrices.
 * Output and oracle: Literal ballot/support/abstention, privacy and declared terminal-day assertions retain the real recorded sequence; diagnostic temporary output stays unchanged.
 */
import { promises as fs } from "node:fs";
import { expect, test } from "bun:test";
import { Camp, Role, Phase } from "../../../../src/core";
import { debaterScenario } from "../../../support/debater_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
for (const size of [6, 12] as const)
  for (const outcome of ["success", "tie", "abstain"] as const)
    for (const transport of ["llm", "acp", "mixed"] as const)
      test(`${size}/${outcome}/${transport}: bilingual complete local transports and strict Tape`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const scenario = debaterScenario(size, outcome),
            run = await runTransportGame(scenario, transport, locale),
            actor = scenario.roles.indexOf(Role.Debater) + 1,
            target = scenario.roles.map((_, i) => i + 1).find((id) => id !== actor)!,
            ledger = run.replay.events.filter((e) => e.type === "debate_ballots_recorded"),
            result = run.replay.events.filter((e) => e.type === "debate_resolved");
          expect(ledger).toHaveLength(1);
          expect(result).toHaveLength(1);
          expect(result[0]!.payload).toEqual({
            actorId: actor,
            targetId: target,
            day: 1,
            eligibleCount: size,
            supports: size / 2 + (outcome === "success" ? 1 : 0),
            rejects: outcome === "abstain" ? 0 : size / 2 - (outcome === "success" ? 1 : 0),
            abstentions: outcome === "abstain" ? size / 2 : 0,
            success: outcome === "success",
            blockedId: outcome === "success" ? target : actor,
          });
          expect(run.record.checkpoints.at(-1)!.snapshot.gameOver).toBe(true);
          expect(run.record.checkpoints.at(-1)!.snapshot.result?.winner).toBe(Camp.Good);
          expect(run.record.checkpoints.at(-1)!.snapshot.day).toBe(size === 6 ? 1 : 4);
          expect(run.record.decisions.filter((d) => d.stage === "debate_challenge")).toHaveLength(
            1,
          );
          expect(run.record.decisions.filter((d) => d.stage === "debate_ballot")).toHaveLength(
            size,
          );
          expect(
            run.record.decisions
              .filter((d) => d.stage === "voting" && d.request.context.day === 1)
              .some((d) => d.request.actorId === (outcome === "success" ? target : actor)),
          ).toBe(false);
          expect(
            run.record.decisions
              .filter((d) => d.stage === "debate_ballot")
              .every((d) => d.request.context.allow_fallback === false),
          ).toBe(true);
          if (transport === "llm" && locale === "zh-CN" && outcome !== "abstain")
            await fs.writeFile(
              `/tmp/awa-p8-debater-${size}-${outcome}.replay.json`,
              JSON.stringify(run.replay),
            );
          for (const view of run.views)
            expect(JSON.stringify(view.timeline)).not.toContain("debate_ballots_recorded");
        }
      }, 120000);
