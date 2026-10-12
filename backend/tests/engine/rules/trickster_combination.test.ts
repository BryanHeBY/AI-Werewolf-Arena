/**
 * Integration/scenario tests for trickster combination configuration and setup contracts.
 * Input: the existing literal boards, original scenario actions and malformed
 * candidates. Output: the unchanged acceptance, roundtrip and state assertions.
 * Fixed policies, recorded literal expectations and rejection cases are the
 * oracle; these tests never generate replacement goldens from migrated rules.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { tricksterTwelveConfig } from "../../../src/runtime/scenarios/trickster_twelve";
import { Role, COMPONENT, type RoleComponent } from "../../../src/core";
import { isTricksterPreset } from "../../../src/rulesets";
import {
  beginTricksterNight,
  commitTricksterExchange,
  finishTricksterNight,
  cancelTricksterExchange,
  resolveTricksterExile,
  tricksterChoiceTargets,
} from "../../../src/game/mechanisms/roles/trickster/night_frame";
import {
  beginMagicianNight,
  commitMagicianExchange,
  cancelMagicianExchangeIfMatching,
  resolveMagicianNightTarget,
  closeMagicianNight,
} from "../../../src/game/mechanisms/roles/magician/night_frame";
import { getTricksterState } from "../../../src/game/mechanisms/roles/trickster/state";
import { getMagicianState } from "../../../src/game/mechanisms/roles/magician/state";
function fixture() {
  const g = bootstrapGame(structuredClone(tricksterTwelveConfig));
  const role = (id: number) => g.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
  return {
    ...g,
    role,
    t: g.world.entityIds().find((id) => role(id).role === Role.Trickster)!,
    m: g.world.entityIds().find((id) => role(id).role === Role.Magician)!,
  };
}
test("identical unordered pair cancels both outputs and preserves both histories", () => {
  const f = fixture(),
    ids = f.world.entityIds(),
    a = ids[0]!,
    b = ids[1]!;
  beginMagicianNight(f.world, 1);
  commitMagicianExchange(f.world, f.m, 1, [a, b]);
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, f.t, 1, [b, a]);
  expect(cancelMagicianExchangeIfMatching(f.world, 1, [b, a])).toBe(true);
  cancelTricksterExchange(f.world, 1);
  expect(resolveMagicianNightTarget(f.world, 1, a).effectiveId).toBe(a);
  finishTricksterNight(f.world, 1);
  expect(resolveTricksterExile(f.world, 1, a)).toEqual({
    requestedId: a,
    effectiveId: a,
    missed: false,
  });
  expect(getMagicianState(f.role(f.m))!.history[0]!.pair).toEqual([Math.min(a, b), Math.max(a, b)]);
  expect(getTricksterState(f.role(f.t))!.history[0]!.pair).toEqual([
    Math.min(a, b),
    Math.max(a, b),
  ]);
  closeMagicianNight(f.world, 1);
  beginMagicianNight(f.world, 2);
  beginTricksterNight(f.world, 2);
  expect(tricksterChoiceTargets(f.world, 2)).not.toContain(a);
  expect(tricksterChoiceTargets(f.world, 2)).not.toContain(b);
});
test("different overlapping pairs remain independently active", () => {
  const f = fixture(),
    [a, b, c] = f.world.entityIds() as [number, number, number, ...number[]];
  beginMagicianNight(f.world, 1);
  commitMagicianExchange(f.world, f.m, 1, [a, b]);
  beginTricksterNight(f.world, 1);
  commitTricksterExchange(f.world, f.t, 1, [a, c]);
  expect(cancelMagicianExchangeIfMatching(f.world, 1, [a, c])).toBe(false);
  expect(resolveMagicianNightTarget(f.world, 1, a).effectiveId).toBe(b);
  finishTricksterNight(f.world, 1);
  expect(resolveTricksterExile(f.world, 1, a).effectiveId).toBe(c);
});
test("cancelled magician receipts cannot remain current", () => {
  const f = fixture(),
    [a, b] = f.world.entityIds() as [number, number, ...number[]];
  beginMagicianNight(f.world, 1);
  commitMagicianExchange(f.world, f.m, 1, [a, b]);
  const receipt = resolveMagicianNightTarget(f.world, 1, a);
  expect(receipt.isCurrent()).toBe(true);
  expect(cancelMagicianExchangeIfMatching(f.world, 1, [a, b])).toBe(true);
  expect(receipt.isCurrent()).toBe(false);
});
test("finite combination rejects changed night order policy and extra roles", () => {
  expect(isTricksterPreset(tricksterTwelveConfig)).toBe(true);
  const late = structuredClone(tricksterTwelveConfig);
  late.magician!.firstNight = 2;
  expect(isTricksterPreset(late)).toBe(false);
  expect(() => bootstrapGame(late)).toThrow();
  const extra = structuredClone(tricksterTwelveConfig);
  extra.roleSetups.push({ role: Role.Hunter, count: 1 });
  expect(isTricksterPreset(extra)).toBe(false);
  expect(() => bootstrapGame(extra)).toThrow();
});
