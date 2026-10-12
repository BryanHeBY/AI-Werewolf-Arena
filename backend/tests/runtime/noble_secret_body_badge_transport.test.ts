import { expect, test } from "bun:test";
import { nobleTransportScenario } from "../support/noble_secret_body_transport_scenarios";
import { assertNobleTransportWire } from "../support/features/noble-secret-body/oracles/wire";
import { assertNobleTransportGolden } from "../support/features/noble-secret-body/oracles/transport-golden";
import { assertNobleBadgeRules } from "../support/features/noble-secret-body/oracles/badge-prompt";
import { runTransportGame } from "../support/run_transport_game";
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
