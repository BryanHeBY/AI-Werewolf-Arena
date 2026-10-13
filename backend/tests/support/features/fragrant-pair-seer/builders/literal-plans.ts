/**
 * Builds original fragrant-pair-seer test input plans, fixed boards and explicit player/marker data. Inputs
 * are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import type { FragrantRuntimePlan } from "../contracts";

export const fragrantLiteralPlans: Record<string, readonly FragrantRuntimePlan[]> = {
  inherited_gun: [
    { bind: null, knife: 9, poison: 2, exile: 3 },
    { bind: null, knife: 10, exile: 4 },
    { bind: [1, 12], knife: 11, shoot: 1 },
  ],
  first_link: [
    { bind: [5, 6], knife: 5, exile: 2 },
    { knife: 7, exile: 3 },
    { knife: 8, exile: 4 },
  ],
  expiry: [
    { bind: [5, 6], knife: null, exile: 2 },
    { bind: null, knife: 7, exile: 3 },
    { bind: [5, 6], knife: 5, exile: 4 },
    { knife: null, exile: 1 },
  ],
};
