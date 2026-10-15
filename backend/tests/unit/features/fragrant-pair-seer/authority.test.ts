/**
 * 单元测试：验证馥郁双生原 authority 资格与部分提交边界。
 * 输入为原内存 roster、callback 和非法状态；字面量、引用与错误／库存断言保持原独立预期。
 * 原 owner、frame 和 readers 真实执行，native/install/use 只迁向同一实际实例 owner。
 * 不运行完整对局、模型或传输，不替换支持 fixture、规则与原历史矩阵。
 */
import {
  createAliveComponent,
  createCampComponent,
} from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { Role, Camp, Phase } from "../../../../src/domain/identity";
import { COMPONENT } from "../../../../src/domain/components/names";
import { type AliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";

import { createIdentityComponent } from "../../../../src/domain/entities/player";
import { createVictoryComponent } from "../../../../src/domain/components/victory";
import type { GameEvent } from "../../../../src/domain/events";
import { freshPairSeerState } from "../../../../src/features/fragrant-pair-seer/state";
import { findNightAbility } from "../../../../src/features/night-abilities/abilities";
import { installNativeAbility } from "../../../../src/features/night-abilities/ability-changes";
import {
  beginFragrantNight,
  openFragrantBindChoice,
  openPairCheckChoice,
  closeFragrantNight,
  fragrantKnifeEligible,
  fragrantPlayerKnowledge,
  fragrantAuthoritySnapshot,
  prepareFragrantDeathWave,
  cancelFragrantDeathWave,
  commitFragrantDeathWave,
  publishFragrantDeathWave,
} from "../../../../src/features/fragrant-pair-seer/authority";

import { fragrantPairOwnerFixture as fixture } from "../../../support/features/fragrant-pair-seer/builders/owner";

test("real open pays singleton once; duplicate entry and aborted continuation do not redraw", () => {
  const f = fixture(),
    notice = f.open()!;
  expect(notice.known.knownWolfId).toBe(3);
  expect(notice.known.knifeNotices).toEqual([{ day: 1, eligible: false }]);
  expect(f.draws()).toBe(1);
  expect(() => f.open()).toThrow();
  expect(f.draws()).toBe(1);
  expect(() => closeFragrantNight(f.world, 1, "normal")).toThrow(
    "fragrant_required_choice_missing",
  );
  closeFragrantNight(f.world, 1, "aborted");
  expect(() => f.open(2)).toThrow();
  expect(fragrantPlayerKnowledge(f.world).knownWolfId).toBe(3);
});
test("cancelled controller cannot open, pay knowledge, or draw", () => {
  const f = fixture();
  f.stale();
  expect(() => f.open()).toThrow();
  expect(f.draws()).toBe(0);
  expect(fragrantAuthoritySnapshot(f.world).fragrant.knowledgeNight).toBeNull();
});
test("sampled N1 failure retains aborted ownership and cannot redraw or continue", () => {
  const f = fixture();
  let checks = 0;
  expect(() => beginFragrantNight(f.world, 1, f.random, () => ++checks === 1)).toThrow();
  expect(f.draws()).toBe(1);
  expect(fragrantAuthoritySnapshot(f.world).nights).toEqual([
    { day: 1, status: "aborted", knife: false, bindCommitted: false, pairCommitted: false },
  ]);
  expect(() => f.open()).toThrow();
  expect(() => f.open(2)).toThrow();
  expect(f.draws()).toBe(1);
});
test("random callback deaths revoke entry instead of changing the frozen knife grant", () => {
  const f = fixture();
  expect(() =>
    beginFragrantNight(
      f.world,
      1,
      {
        next: () => {
          f.kill(2, 3, 4);
          return 0.5;
        },
      },
      () => true,
    ),
  ).toThrow();
  expect(fragrantKnifeEligible(f.world, 1, 1)).toBe(false);
  expect(fragrantAuthoritySnapshot(f.world).nights[0]!.status).toBe("aborted");
  expect(() => f.open()).toThrow();
});
test("pair check returns exactly one boolean and normalized identities, no per-target facts", () => {
  const f = fixture();
  f.open();
  const receipt = openPairCheckChoice(f.world, 1).commit([6, 2]);
  expect(receipt).toEqual({ actorId: 5, day: 1, targetIds: [2, 6], containsWerewolf: true });
  expect((f.role(5).privateState as { readonly pairSeer?: unknown }).pairSeer).toEqual({
    policy: "awa_fragrant_pair_seer_v1",
    history: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
  });
  expect(findNightAbility(f.role(5), "pair_check")).toMatchObject({ uses: 1, lastUsedDay: 1 });
  expect(() => openPairCheckChoice(f.world, 1)).toThrow();
});
test("pair history and its only common resource reject late counter edits atomically", () => {
  const f = fixture();
  f.open();
  const lease = openPairCheckChoice(f.world, 1),
    ability = findNightAbility(f.role(5), "pair_check")!;
  (ability as { uses: number }).uses = 1;
  expect(lease.isCurrent()).toBe(false);
  expect(() => lease.commit([5, 6])).toThrow();
  expect((f.role(5).privateState as { readonly pairSeer?: unknown }).pairSeer).toEqual(
    freshPairSeerState(),
  );
});
test("nonwritable common counters cannot leave a paid half-history", () => {
  const f = fixture();
  f.open();
  const lease = openPairCheckChoice(f.world, 1),
    ability = findNightAbility(f.role(5), "pair_check")!;
  Object.freeze(ability);
  expect(() => lease.commit([5, 6])).toThrow("fragrant_state_write_revoked");
  expect((f.role(5).privateState as { readonly pairSeer?: unknown }).pairSeer).toEqual(
    freshPairSeerState(),
  );
  expect(ability.uses).toBe(0);
  expect(ability.lastUsedDay).toBeNull();
});
test("same-value common source replacement revokes owner and retains empty history", () => {
  const f = fixture();
  f.open();
  const lease = openPairCheckChoice(f.world, 1),
    ability = findNightAbility(f.role(5), "pair_check")!;
  (ability as { source: import("@ai-werewolf-arena/game-contract").AbilitySource }).source = {
    ...ability.source,
  };
  expect(lease.isCurrent()).toBe(false);
  expect(() => lease.commit([5, 6])).toThrow();
  expect((f.role(5).privateState as { readonly pairSeer?: unknown }).pairSeer).toEqual(
    freshPairSeerState(),
  );
  expect(ability.uses).toBe(0);
});
test("initial native disabled must be the boolean false rather than any falsy value", () => {
  for (const disabled of [null, 0, ""])
    expect(() =>
      fixture((role) => {
        Object.defineProperty(findNightAbility(role, "pair_check")!, "disabled", {
          value: disabled,
        });
      }),
    ).toThrow("fragrant_initial_state_invalid");
});
for (const field of ["life", "role", "camp", "actorState"] as const)
  test(`late ${field} replacement revokes complete pair and leaves original history empty`, () => {
    const f = fixture();
    f.open();
    const lease = openPairCheckChoice(f.world, 1),
      originalState = (f.role(5).privateState as { readonly pairSeer?: unknown }).pairSeer;
    if (field === "life") f.world.addComponent(6, COMPONENT.Alive, createAliveComponent());
    if (field === "role") f.world.addComponent(6, COMPONENT.Role, createRoleComponent(Role.Witch));
    if (field === "camp") f.world.addComponent(6, COMPONENT.Camp, createCampComponent(Camp.Good));
    if (field === "actorState")
      (f.role(5).privateState as Record<string, unknown>).pairSeer = freshPairSeerState();
    expect(lease.isCurrent()).toBe(false);
    expect(() => lease.commit([5, 6])).toThrow();
    expect(originalState).toEqual(freshPairSeerState());
  });
test("phase revocation removes action permission without refunding paid knowledge or binding", () => {
  const f = fixture();
  f.open();
  openFragrantBindChoice(f.world, 1).commit([9, 10]);
  const pair = openPairCheckChoice(f.world, 1);
  f.stale();
  expect(pair.isCurrent()).toBe(false);
  expect(() => pair.commit([5, 6])).toThrow();
  closeFragrantNight(f.world, 1, "aborted");
  expect(fragrantAuthoritySnapshot(f.world).fragrant.bindings[0]!.status).toEqual({
    kind: "pending",
  });
  expect(fragrantPlayerKnowledge(f.world).activeBinding?.pairIds).toEqual([9, 10]);
});
test("observed controller revocation is terminal even if phase callback later returns true", () => {
  const f = fixture();
  f.open();
  const lease = openFragrantBindChoice(f.world, 1);
  f.stale();
  expect(lease.isCurrent()).toBe(false);
  f.fresh();
  expect(lease.isCurrent()).toBe(false);
  expect(() => lease.commit([9, 10])).toThrow();
  expect(fragrantAuthoritySnapshot(f.world).fragrant.lastChoice).toBeNull();
  expect(fragrantAuthoritySnapshot(f.world).nights[0]!.status).toBe("aborted");
});
test("an observed target identity replacement permanently revokes its old choice lease", () => {
  const f = fixture();
  f.open();
  const lease = openPairCheckChoice(f.world, 1),
    originalRole = f.role(6);
  f.world.addComponent(6, COMPONENT.Role, createRoleComponent(Role.Witch));
  expect(lease.isCurrent()).toBe(false);
  f.world.addComponent(6, COMPONENT.Role, originalRole);
  expect(lease.isCurrent()).toBe(false);
  expect(() => lease.commit([5, 6])).toThrow();
  expect((f.role(5).privateState as { readonly pairSeer?: unknown }).pairSeer).toEqual(
    freshPairSeerState(),
  );
});
test("private knowledge reader revalidates owner after live-permit controller changes original life", () => {
  const f = fixture();
  let revoke = false;
  beginFragrantNight(f.world, 1, f.random, () => {
    if (revoke) f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
    return true;
  });
  expect(fragrantPlayerKnowledge(f.world).knownWolfId).toBe(3);
  revoke = true;
  expect(() => fragrantPlayerKnowledge(f.world)).toThrow("fragrant_owner_revoked");
});
test("choice snapshots input before controller callbacks can rewrite caller's array", () => {
  const f = fixture(),
    targets = [5, 6];
  beginFragrantNight(f.world, 1, f.random, () => {
    targets[1] = 2;
    return true;
  });
  const lease = openPairCheckChoice(f.world, 1);
  targets[1] = 6;
  expect(lease.commit(targets)).toEqual({
    actorId: 5,
    day: 1,
    targetIds: [5, 6],
    containsWerewolf: false,
  });
  expect(targets).toEqual([5, 2]);
});
test("closed night retains paid relation after original caster dies; only actual public receipt reveals use", () => {
  const f = fixture();
  f.open();
  f.choices();
  closeFragrantNight(f.world, 1, "normal");
  f.stale();
  f.kill(1);
  const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
  expect(receipt).toEqual({ day: 1, rootId: 9, addedTargetId: 10, pairIds: [9, 10] });
  expect(() => commitFragrantDeathWave(f.world, receipt)).toThrow();
  expect(fragrantAuthoritySnapshot(f.world).fragrant.trigger).toBeNull();
  f.kill(9, 10);
  commitFragrantDeathWave(f.world, receipt);
  expect(fragrantAuthoritySnapshot(f.world).fragrant.trigger?.rootId).toBe(9);
  expect(fragrantPlayerKnowledge(f.world).used).toBe(false);
  const event: GameEvent = { type: "additional_deaths", timestamp: 1, payload: { deaths: [10] } };
  expect(() => publishFragrantDeathWave(f.world, receipt, event)).toThrow();
  f.events.push(event);
  expect(() => publishFragrantDeathWave(f.world, receipt, structuredClone(event))).toThrow();
  publishFragrantDeathWave(f.world, receipt, event);
  expect(fragrantPlayerKnowledge(f.world).used).toBe(true);
  expect(fragrantPlayerKnowledge(f.world).activeBinding).toBeNull();
  expect(fragrantPlayerKnowledge(f.world)).not.toHaveProperty("rootId");
  expect(prepareFragrantDeathWave(f.world, 1, [11])).toBeNull();
  expect(() => commitFragrantDeathWave(f.world, receipt)).toThrow();
});
test("both independent original deaths consume once without claiming an additional target", () => {
  const f = fixture();
  f.open();
  f.choices([6, 7]);
  closeFragrantNight(f.world, 1, "normal");
  const receipt = prepareFragrantDeathWave(f.world, 1, [7, 6])!;
  expect(receipt.rootId).toBe(7);
  expect(receipt.addedTargetId).toBeNull();
  f.kill(7, 6);
  commitFragrantDeathWave(f.world, receipt);
  const publicEvent: GameEvent = {
    type: "night_resolved",
    timestamp: 1,
    payload: { deaths: [7, 6] },
  };
  f.events.push(publicEvent);
  publishFragrantDeathWave(f.world, receipt, publicEvent);
  expect(
    fragrantAuthoritySnapshot(f.world).fragrant.bindings.filter(
      (b) => b.status.kind === "triggered",
    ),
  ).toHaveLength(1);
  expect(fragrantPlayerKnowledge(f.world).used).toBe(true);
});
test("abandoned effective wave does not spend and its cancelled receipt cannot be reused", () => {
  const f = fixture();
  f.open();
  f.choices();
  const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
  expect(() => prepareFragrantDeathWave(f.world, 1, [9])).toThrow();
  cancelFragrantDeathWave(f.world, receipt);
  expect(fragrantAuthoritySnapshot(f.world).fragrant.trigger).toBeNull();
  expect(prepareFragrantDeathWave(f.world, 1, [11])).toBeNull();
  expect(() => commitFragrantDeathWave(f.world, receipt)).toThrow();
});
test("next real night expires the paid pair; phase labels alone and pass never extend it", () => {
  const f = fixture();
  f.open();
  f.choices();
  closeFragrantNight(f.world, 1, "normal");
  f.stale();
  expect(fragrantPlayerKnowledge(f.world).activeBinding?.createdNight).toBe(1);
  f.fresh();
  f.open(2);
  expect(fragrantPlayerKnowledge(f.world).activeBinding).toBeNull();
  expect(fragrantPlayerKnowledge(f.world).lastChoice).toEqual({ day: 1, pairIds: [9, 10] });
  openFragrantBindChoice(f.world, 2).commit(null);
  expect(prepareFragrantDeathWave(f.world, 2, [9])).toBeNull();
  expect(fragrantAuthoritySnapshot(f.world).fragrant.bindings[0]!.status).toEqual({
    kind: "expired",
    day: 2,
  });
  expect(f.draws()).toBe(1);
});
test("known wolf death is historical only; all three dying mid-night cannot grant a late knife", () => {
  const f = fixture();
  f.open();
  f.choices(null);
  f.kill(3);
  expect(fragrantPlayerKnowledge(f.world).knownWolfId).toBe(3);
  expect(fragrantKnifeEligible(f.world, 1, 1)).toBe(false);
  f.kill(2, 4);
  expect(fragrantKnifeEligible(f.world, 1, 1)).toBe(false);
  closeFragrantNight(f.world, 1, "normal");
  const notice = f.open(2)!;
  expect(notice.known.knifeNotices).toEqual([
    { day: 1, eligible: false },
    { day: 2, eligible: true },
  ]);
  expect(fragrantKnifeEligible(f.world, 1, 2)).toBe(true);
  expect(fragrantKnifeEligible(f.world, 2, 2)).toBe(false);
  openFragrantBindChoice(f.world, 2).commit(null);
  openPairCheckChoice(f.world, 2).commit([5, 6]);
  closeFragrantNight(f.world, 2, "normal");
  expect(fragrantPlayerKnowledge(f.world).hasInheritedKnife).toBe(true);
  expect(fragrantPlayerKnowledge(f.world).canVoteForKill).toBe(false);
  expect(fragrantKnifeEligible(f.world, 1, 2)).toBe(false);
});
test("a throwing night controller terminates inherited knife permission permanently", () => {
  const f = fixture();
  f.open();
  f.choices(null);
  f.kill(2, 3, 4);
  closeFragrantNight(f.world, 1, "normal");
  let fail = false;
  beginFragrantNight(f.world, 2, f.random, () => {
    if (fail) throw Error("controller_cancelled");
    return true;
  });
  expect(fragrantKnifeEligible(f.world, 1, 2)).toBe(true);
  fail = true;
  expect(fragrantKnifeEligible(f.world, 1, 2)).toBe(false);
  fail = false;
  expect(fragrantKnifeEligible(f.world, 1, 2)).toBe(false);
  expect(fragrantPlayerKnowledge(f.world).hasInheritedKnife).toBe(true);
  expect(fragrantAuthoritySnapshot(f.world).nights[1]!.status).toBe("aborted");
});
test("spent Phantom still receives the next night knife notice without a bind request", () => {
  const f = fixture();
  f.open();
  f.choices();
  closeFragrantNight(f.world, 1, "normal");
  const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
  f.kill(9, 10);
  commitFragrantDeathWave(f.world, receipt);
  const event: GameEvent = { type: "additional_deaths", timestamp: 1, payload: { deaths: [10] } };
  f.events.push(event);
  publishFragrantDeathWave(f.world, receipt, event);
  f.kill(2, 3, 4);
  expect(f.open(2)!.known.knifeNotices.at(-1)).toEqual({ day: 2, eligible: true });
  expect(() => openFragrantBindChoice(f.world, 2)).toThrow();
  openPairCheckChoice(f.world, 2).commit([5, 6]);
  closeFragrantNight(f.world, 2, "normal");
});
for (const replacement of ["casterRevival", "targetRevival", "identity", "victory"] as const)
  test(`paid ownership rejects ${replacement}`, () => {
    const f = fixture();
    f.open();
    f.choices();
    closeFragrantNight(f.world, 1, "normal");
    if (replacement.endsWith("Revival")) {
      const id = replacement === "casterRevival" ? 1 : 10;
      f.kill(id);
      f.world.getComponent(id, COMPONENT.Alive)!.alive = true;
    } else if (replacement === "identity")
      f.world.addComponent(10, COMPONENT.Identity, createIdentityComponent(10, 10, "p10"));
    else
      f.world.addComponent(
        10,
        COMPONENT.Victory,
        createVictoryComponent([{ kind: "faction", faction: "good" }]),
      );
    expect(() => prepareFragrantDeathWave(f.world, 1, [9])).toThrow();
    expect((f.role(1).privateState as { readonly fragrant?: unknown }).fragrant).toMatchObject({
      trigger: null,
    });
  });
test("forged cross-World receipt and private or pre-wave events cannot publish actual trigger", () => {
  const f = fixture(),
    other = fixture();
  f.open();
  f.choices();
  const event: GameEvent = { type: "additional_deaths", timestamp: 1, payload: { deaths: [10] } };
  f.events.push(event);
  const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
  f.kill(9, 10);
  commitFragrantDeathWave(f.world, receipt);
  expect(() => commitFragrantDeathWave(other.world, receipt)).toThrow();
  expect(() => publishFragrantDeathWave(f.world, receipt, event)).toThrow();
  expect(() => publishFragrantDeathWave(f.world, { ...receipt }, event)).toThrow();
  const privateEvent = { ...event, audience: [] };
  f.events.push(privateEvent);
  expect(() => publishFragrantDeathWave(f.world, receipt, privateEvent)).toThrow();
  expect(fragrantPlayerKnowledge(f.world).used).toBe(false);
});
test("foreign feed methods cannot invent a public event or execute during publication", () => {
  const f = fixture();
  f.open();
  f.choices();
  const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
  f.kill(9, 10);
  commitFragrantDeathWave(f.world, receipt);
  let calls = 0;
  Object.defineProperty(f.events, "indexOf", {
    value: () => {
      calls++;
      return 0;
    },
  });
  const event: GameEvent = { type: "additional_deaths", timestamp: 1, payload: { deaths: [10] } };
  expect(() => publishFragrantDeathWave(f.world, receipt, event)).toThrow();
  expect(calls).toBe(0);
  expect(fragrantPlayerKnowledge(f.world).used).toBe(false);
});
test("an audience accessor cannot masquerade as a public death event", () => {
  const f = fixture();
  f.open();
  f.choices();
  const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
  f.kill(9, 10);
  commitFragrantDeathWave(f.world, receipt);
  let calls = 0;
  const event: GameEvent = { type: "additional_deaths", timestamp: 1, payload: { deaths: [10] } };
  Object.defineProperty(event, "audience", {
    get: () => {
      calls++;
      return [];
    },
  });
  f.events.push(event);
  expect(() => publishFragrantDeathWave(f.world, receipt, event)).toThrow();
  expect(calls).toBe(0);
  expect(fragrantPlayerKnowledge(f.world).used).toBe(false);
});
test("a subsequent day's event cannot authorize the previous cycle's consumed binding", () => {
  const f = fixture();
  f.open();
  f.choices();
  const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
  f.kill(9, 10);
  commitFragrantDeathWave(f.world, receipt);
  f.events.push({ type: "phase_changed", timestamp: 1, payload: { day: 2, phase: Phase.Day } });
  const event: GameEvent = { type: "night_resolved", timestamp: 2, payload: { deaths: [9, 10] } };
  f.events.push(event);
  expect(() => publishFragrantDeathWave(f.world, receipt, event)).toThrow();
  expect(fragrantPlayerKnowledge(f.world).used).toBe(false);
});
test("death event type coercion cannot execute external methods or publish", () => {
  const f = fixture();
  f.open();
  f.choices();
  const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
  f.kill(9, 10);
  commitFragrantDeathWave(f.world, receipt);
  let calls = 0;
  const event = {
    type: {
      toString: () => {
        calls++;
        return "night_resolved";
      },
    },
    timestamp: 1,
    payload: { deaths: [9, 10] },
  };
  f.events.push(event as unknown as GameEvent);
  expect(() => publishFragrantDeathWave(f.world, receipt, event as unknown as GameEvent)).toThrow();
  expect(calls).toBe(0);
  expect(fragrantPlayerKnowledge(f.world).used).toBe(false);
});
test("rewriting an original phase fact or deleting the original feed prefix revokes publication", () => {
  for (const action of ["mutate", "delete"] as const) {
    const f = fixture();
    const phase: GameEvent = {
      type: "phase_changed",
      timestamp: 1,
      payload: { day: 1, phase: Phase.Night },
    };
    f.events.push(phase);
    f.open();
    f.choices();
    const receipt = prepareFragrantDeathWave(f.world, 1, [9])!;
    f.kill(9, 10);
    commitFragrantDeathWave(f.world, receipt);
    const event: GameEvent = { type: "additional_deaths", timestamp: 2, payload: { deaths: [10] } };
    if (action === "mutate") phase.payload.phase = Phase.Day;
    else f.events.splice(0, 1);
    f.events.push(event);
    expect(() => publishFragrantDeathWave(f.world, receipt, event)).toThrow();
    expect(fragrantPlayerKnowledge(f.world).used).toBe(false);
  }
});
