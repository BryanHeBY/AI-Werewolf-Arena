/**
 * Scenario tests execute Fox and Puffer invalid-action correction through SDK and ACP in both locales.
 * Inputs are the original full-game plans with one handwritten invalid action; literal error, one paid history and final golden outcome expectations check correction without duplicate stock consumption.
 * The transport driver owns child/recording resources. Tests neither grant replacement-body authority nor call a billed model.
 */
import { expect, test } from "bun:test";
import { animalTransportScenario } from "../../../support/features/animal-dream/builders/transport-plan";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
import type { ToolCall } from "../../../../src/core";
for (const skill of ["fox", "puffer"] as const)
  for (const kind of ["llm", "acp"] as const)
    test(`Animal actual rejection then correction ${skill}/${kind}`, async () => {
      for (const locale of ["en", "zh-CN"] as const) {
        const s = await animalTransportScenario(
            skill === "fox" ? "fox_beauty" : "full_retaliation",
          ),
          actor = s.mapping.get(skill === "fox" ? 10 : 12)!,
          turn = s.turns
            .get(actor)!
            .find((t) => t.stage === (skill === "fox" ? "fox_distract" : "puffer_reaction"))!;
        turn.invalidActions = [
          (skill === "fox"
            ? { name: "fox_distract", args: { target_id: 999 } }
            : { name: "puffer_retaliate", args: { activate: "true" } }) as ToolCall,
        ];
        turn.expectedInvalidError =
          skill === "fox" ? "animal_action_unavailable" : "invalid_tool_arguments";
        const r = await runTransportGame(s, kind, locale),
          stock =
            skill === "fox"
              ? r.record.checkpoints.at(-1)!.animalDream!.fox
              : r.record.checkpoints.at(-1)!.animalDream!.puffer;
        expect(r.result.snapshot.result?.winner).toBe(s.golden.winner);
        expect(stock.history).toHaveLength(1);
        expect(stock[skill === "fox" ? "usedNight" : "usedDay"]).toBe(skill === "fox" ? 2 : 1);
      }
    }, 120000);
