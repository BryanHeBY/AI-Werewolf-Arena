/**
 * Complete real-transport scenarios verify Noble deceased-holder badge prompt agrees with actual handoff.
 * Input: Original badge scenario and synthetic SDK/ACP/mixed runs.
 * Output and independent oracle: Independent literal badge wording, owner wire prefix and real successor/death facts.
 * The test never calls a billed model or rewrites expected fixture/Tape bytes.
 */
import { expect, test } from "bun:test";
import { nobleTransportScenario } from "../../../support/features/noble-secret-body/builders/transport-plan";
import { assertNobleTransportWire } from "../../../support/features/noble-secret-body/oracles/wire";
import { assertNobleTransportGolden } from "../../../support/features/noble-secret-body/oracles/transport-golden";
import { assertNobleBadgeRules } from "../../../support/features/noble-secret-body/oracles/badge-prompt";
import { runTransportGame } from "../../../support/drivers/transport/run-game";
for (const kind of ["llm", "acp", "mixed"] as const)
  test(`actual Noble holder badge prompt agrees with real action ${kind}`, async () => {
    const scenario = nobleTransportScenario("badge_reveal");
    for (const locale of ["en", "zh-CN"] as const) {
      const run = await runTransportGame(scenario, kind, locale);
      assertNobleTransportWire(run);
      assertNobleTransportGolden(run.record, scenario);
      assertNobleBadgeRules(run, locale);
      expect(
        run.record.decisions.some(
          (d) => d.stage === "sheriff_badge_choice" && d.outcome.kind === "action",
        ),
      ).toBe(true);
      expect(run.record.events.some((e) => e.type === "sheriff_badge_transferred")).toBe(true);
    }
  }, 120000);
