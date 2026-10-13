/**
 * Owns original test oracle white-wolf-king handwritten expected data and bounded contract assertions. Inputs are
 * supplied plans or observed tuples; outputs preserve literal stock, identity, marker and error
 * expectations. No expected game result is regenerated from production settlement; this owner performs no
 * game, model or transport execution.
 */
import { Role } from "../../../../../src/core";
import type { TransportGameScenario } from "../../../transport/contracts";

export function oracle(scenario: TransportGameScenario): TransportGameScenario {
  return {
    ...scenario,
    promptAssertions: (actor, locale) =>
      scenario.roles[actor - 1] === Role.WhiteWolfKing
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is White Wolf King." : "真实身份是白狼王。",
            requiredCurrentMarkers:
              locale === "en"
                ? ["Your role is White Wolf King.", "Self-destruct opportunities remaining: 1."]
                : ["你的底牌是【白狼王】", "自爆机会剩余：1。"],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Self-destruct opportunities remaining:" : "自爆机会剩余：",
            ],
          },
  };
}
