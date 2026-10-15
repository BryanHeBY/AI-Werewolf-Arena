/**
 * 单元测试：验证捣蛋鬼无序／重叠配对与既有历史。输入为原配对和历史；目标映射及历史不变的原字面断言检查独立生效结果，不重新生成预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { tricksterTwelveConfig } from "../../../src/rulesets/presets/trickster-twelve";
import { Role, COMPONENT, type RoleComponent } from "../../../src/domain";
import { isTricksterPreset } from "../../../src/rulesets";
import {
  beginTricksterNight,
  commitTricksterExchange,
  finishTricksterNight,
  cancelTricksterExchange,
  resolveTricksterExile,
  tricksterChoiceTargets,
} from "../../../src/features/trickster/night-frame";
import {
  beginMagicianNight,
  commitMagicianExchange,
  cancelMagicianExchangeIfMatching,
  resolveMagicianNightTarget,
  closeMagicianNight,
} from "../../../src/features/magician/night-frame";
import { getTricksterState } from "../../../src/features/trickster/ports";
import { getMagicianState } from "../../../src/features/magician/state-slot";
function fixture() {
  const g = bootstrapGame(structuredClone(tricksterTwelveConfig));
  const role = (id: number) => g.world.getComponent(id, COMPONENT.Role)!;
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
  expect(getMagicianState(f.role(f.m), () => f.world.getComponent(f.m, COMPONENT.Camp))!.history[0]!.pair).toEqual([Math.min(a, b), Math.max(a, b)]);
  expect(getTricksterState(f.role(f.t), () => f.world.getComponent(f.t, COMPONENT.Camp))!.history[0]!.pair).toEqual([
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
