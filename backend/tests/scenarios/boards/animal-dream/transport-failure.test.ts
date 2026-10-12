/**
 * Scenario tests stop real Animal Dream game execution on missing, invalid or late Fox/Puffer required actions.
 * Inputs are the original SDK/ACP scripts truncated at the failing turn in both locales; literal incomplete/stopped checkpoints, empty histories and absent commit/game-over events are the oracle.
 * The transport driver owns local process and record cleanup. These failure-prefix scenarios never synthesize a successful action, refund a paid effect or call a billed model.
 */
import { expect, test } from "bun:test";
import { animalTransportScenario } from "../../../support/animal_dream_transport";
import { runTransportGame } from "../../../support/run_transport_game";
import type { ToolCall } from "../../../../src/core";
for (const skill of ["fox", "puffer"] as const)
  for (const fault of ["missing", "invalid", "late"] as const)
    for (const kind of ["llm", "acp"] as const)
      test(`Animal actual required failure ${skill}/${fault}/${kind}`, async () => {
        for (const locale of ["zh-CN", "en"] as const) {
          const s = await animalTransportScenario(
              skill === "fox" ? "fox_beauty" : "full_retaliation",
            ),
            id = s.mapping.get(skill === "fox" ? 10 : 12)!,
            rows = s.turns.get(id)!,
            index = rows.findIndex(
              (t) => t.stage === (skill === "fox" ? "fox_distract" : "puffer_reaction"),
            );
          const target = rows[index]!;
          s.turns.set(id, rows.slice(0, index + 1));
          target.terminalFailure = fault === "late" ? "late" : "missing";
          if (fault !== "late") target.action = null;
          if (fault === "invalid") {
            target.invalidActions = [
              (skill === "fox"
                ? { name: "fox_distract", args: { target_id: 999 } }
                : { name: "puffer_retaliate", args: { activate: "true" } }) as ToolCall,
            ];
            target.expectedInvalidError =
              skill === "fox" ? "animal_action_unavailable" : "invalid_tool_arguments";
          }
          s.expectedFailure = { actorId: id, stage: target.stage };
          const r = await runTransportGame(s, kind, locale),
            last = r.record.checkpoints.at(-1)!;
          expect(last.complete).toBe(false);
          expect(last.animalDream!.stopped).toBe(true);
          const stock = skill === "fox" ? last.animalDream!.fox : last.animalDream!.puffer;
          expect(stock[skill === "fox" ? "usedNight" : "usedDay"]).toBeNull();
          expect(stock.history).toEqual([]);
          expect(r.record.events.filter((e) => e.type === "game_over")).toHaveLength(0);
          expect(
            r.record.events.filter(
              (e) => e.type === (skill === "fox" ? "animal_fox_chosen" : "animal_puffer_decided"),
            ),
          ).toHaveLength(0);
        }
      }, 120000);
