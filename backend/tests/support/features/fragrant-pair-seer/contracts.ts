/**
 * Defines original fragrant-pair-seer planning data contracts for public test support. Inputs are
 * explicitly authored turn/actor/scenario data; outputs preserve the original nullable choices, source
 * fields and exact callback types. No game, model, filesystem, live permission or expected outcome is
 * allocated or computed here.
 */


export interface FragrantRuntimePlan {
  bind?: readonly [number, number] | null;
  knife?: number | null;
  poison?: number | null;
  exile?: number | null;
  sheriff?: number | null;
  shoot?: number | null;
  badge?: number | null;
}
