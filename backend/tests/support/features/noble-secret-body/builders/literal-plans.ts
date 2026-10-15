/**
 * Builds original noble-secret-body test input plans, fixed boards and explicit player/marker data. Inputs
 * are supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { PotionType } from "../../../../../src/domain";

export interface NobleLiteralNight {
  body: number | null;
  servant: number | null;
  knife: number | null;
  hunt: number | null;
  exile: number | null;
  potion?: { target: number; type: PotionType };
}

export const nobleLiteralPlans: Record<string, readonly NobleLiteralNight[]> = {
  blast_skips_vote: [
    { body: 6, servant: null, knife: null, hunt: null, exile: 10 },
    { body: 7, servant: 6, knife: null, hunt: null, exile: 11 },
    { body: 6, servant: null, knife: null, hunt: null, exile: 11 },
    { body: null, servant: null, knife: null, hunt: null, exile: 12 },
  ],
  expiry: [
    { body: 6, servant: null, knife: null, hunt: null, exile: 10 },
    { body: 7, servant: 6, knife: null, hunt: null, exile: 11 },
    { body: 6, servant: null, knife: null, hunt: null, exile: 12 },
    { body: null, servant: 7, knife: null, hunt: null, exile: 1 },
  ],
  new_and_old_clear: [
    { body: null, servant: null, knife: null, hunt: null, exile: 10 },
    { body: null, servant: 6, knife: null, hunt: 6, exile: 11 },
    { body: null, servant: 12, knife: null, hunt: null, exile: 6 },
    { body: null, servant: null, knife: 12, hunt: 12, exile: 1 },
  ],
  two_sources: [
    { body: null, servant: null, knife: null, hunt: null, exile: 10 },
    { body: 7, servant: 5, knife: null, hunt: null, exile: 11 },
    {
      body: 6,
      servant: null,
      knife: 6,
      hunt: null,
      exile: 12,
      potion: { target: 6, type: PotionType.Poison },
    },
    { body: null, servant: 7, knife: null, hunt: null, exile: 1 },
  ],
  pending_last_wolf: [
    { body: null, servant: null, knife: null, hunt: null, exile: 10 },
    { body: null, servant: 7, knife: null, hunt: 12, exile: 11 },
    { body: null, servant: null, knife: null, hunt: null, exile: 1 },
  ],
  badge_reveal: [
    { body: 6, servant: null, knife: null, hunt: null, exile: 5 },
    { body: null, servant: null, knife: null, hunt: null, exile: 10 },
    { body: null, servant: null, knife: null, hunt: null, exile: 5 },
    { body: null, servant: null, knife: 12, hunt: 11, exile: 1 },
  ],
};
