/**
 * 完整真实传输场景验证夜之贵族板的死亡持徽者提示与实际移交一致。
 * 输入为原警徽场景及合成 SDK／ACP／混合运行。
 * 输出与独立预期为独立的警徽字面文案、所有者协议前缀及真实接任／死亡事实。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
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
