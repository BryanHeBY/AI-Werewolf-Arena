/**
 * Owns original test oracle knight handwritten expected data and bounded contract assertions. Inputs are supplied plans
 * or observed tuples; outputs preserve literal stock, identity, marker and error expectations. No expected
 * game result is regenerated from production settlement; this owner performs no game, model or transport
 * execution.
 */
import { Role } from "../../../../../src/core";
import type { TransportGameScenario } from "../../../transport/contracts";

export function oracle(scene: TransportGameScenario): TransportGameScenario {
  for (const [actor, turns] of scene.turns) {
    if (scene.roles[actor - 1] !== Role.Knight) continue;
    let remaining: 0 | 1 = 1;
    for (const turn of turns) {
      turn.knightResourceRemaining = remaining;
      if (turn.action?.name === "duel") remaining = 0;
    }
  }
  return {
    ...scene,
    promptAssertions: (actor, locale) =>
      scene.roles[actor - 1] === Role.Knight
        ? {
            expectedIdentityMarker:
              locale === "en" ? "your true role is Knight." : "真实身份是骑士。",
            requiredCurrentMarkers:
              locale === "en" ? ["Your role is Knight,"] : ["你的底牌是【骑士】"],
          }
        : {
            forbiddenCurrentMarkers: [
              locale === "en" ? "Duel opportunities remaining:" : "决斗机会剩余：",
            ],
          },
  };
}
