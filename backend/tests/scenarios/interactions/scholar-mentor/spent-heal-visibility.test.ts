/**
 * Interaction scenarios verify spent Scholar Mentor heal suppresses later knife-target disclosure throughout a recorded game and replay checks.
 * Input: The original early-heal transport plan, declared winner/alive expectations and copied later-target context forgery.
 * Output and oracle: Explicit day-two/day-three privacy fields, original planned result and forgery rejection retain the causal history; expected alive is declared by the plan rather than produced by a second World.
 */
import { expect, test } from "bun:test";
import { scholarMentorScenario } from "../../../support/scholar_mentor_transport_scenarios";
import { runTransportGame } from "../../../support/run_transport_game";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";

for (const transport of ["llm", "acp"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`Scholar Mentor spent heal hides later knife targets/${transport}/${locale}`, async () => {
      const scenario = scholarMentorScenario("early-heal");
      const run = await runTransportGame(scenario, transport, locale);
      const second = run.record.decisions.find((d) => d.day === 2 && d.stage === "witch")!;
      const third = run.record.decisions.find((d) => d.day === 3 && d.stage === "witch")!;
      expect(second.request.context.wolf_targets).toHaveLength(2);
      expect(third.request.context.modifier_poison_blocked).toBe(true);
      expect(Object.hasOwn(third.request.context, "wolf_target")).toBe(false);
      expect(Object.hasOwn(third.request.context, "wolf_targets")).toBe(false);
      expect(run.result.snapshot.result?.winner).toBe(scenario.winner);
      expect(run.manifest.players.filter((p) => p.alive).map((p) => p.player_id)).toEqual(
        scenario.alive,
      );
      const forged = structuredClone(run.record);
      forged.decisions.find(
        (d) => d.day === 3 && d.stage === "witch",
      )!.request.context.wolf_targets = [];
      expect(() => parseReproductionRecord(forged)).toThrow("reproduction_scholar_mentor_invalid");
    }, 120000);
