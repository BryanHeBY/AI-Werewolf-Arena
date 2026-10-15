/**
 * Owns original test oracle wolf-king handwritten expected data and bounded contract assertions. Inputs are supplied
 * plans or observed tuples; outputs preserve literal stock, identity, marker and error expectations. No
 * expected game result is regenerated from production settlement; this owner performs no game, model or
 * transport execution.
 */
import { Role } from "../../../../../src/domain";
import type { TransportGameScenario } from "../../../transport/contracts";

export function withPromptOracle(scenario: TransportGameScenario): TransportGameScenario {
  return {
    ...scenario,
    promptAssertions: (actor, locale) =>
      scenario.roles[actor - 1] === Role.WolfKing
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Wolf King." : "真实身份是狼王。",
            requiredCurrentMarkers:
              locale === "en"
                ? ["Your role is Wolf King.", "Shots remaining: 1."]
                : ["你的底牌是【狼王】", "剩余枪：1。"],
          }
        : { forbiddenCurrentMarkers: [locale === "en" ? "Shots remaining:" : "剩余枪："] },
  };
}
