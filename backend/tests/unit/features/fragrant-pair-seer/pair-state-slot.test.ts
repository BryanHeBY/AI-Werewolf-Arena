/**
 * 单元测试：验证原生双人查验槽的实际 owner。输入为手写双人历史、受控 privateState accessor 与不可写字段；字面归档形状、同引用和写前快照为预期。原角色／能力 factory 只造输入，不由生产命令生成预期；租约与完整对局留在外部。
 */
import type { RoleInitializationComponent } from "../../../../src/game/mechanisms/roles/contracts";
import type { PairSeerState } from "@ai-werewolf-arena/game-contract";

import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import {
  findNightAbility,
  type NightAbility,
} from "../../../../src/game/mechanisms/roles/abilities";
import { getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import {
  installPairStateSlot,
  commitPairStateSlot,
  type PairStateSlot,
} from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/pair-state-slot";

function fixture() {
  const role = createRoleComponent(Role.AwakenedSeer, Camp.Good, "en");
  installPairStateSlot(role);
  const ability = findNightAbility(role, "pair_check")!,
    slot: PairStateSlot = {
      pairState: ability.state,
      pairAbility: ability,
      pairJson: '{"policy":"awa_fragrant_pair_seer_v1","history":[]}',
      pairAbilityJson: JSON.stringify(ability),
    };
  return { role, ability, slot };
}

test("actual profile initialization owns separate native instances with one state behind both checkpoint aliases", () => {
  const first = createRoleComponent(Role.AwakenedSeer, Camp.Good, "en"),
    second = createRoleComponent(Role.AwakenedSeer, Camp.Good, "en");
  const profile = getDefaultRoleCatalog().get(Role.AwakenedSeer)!;
  profile.init!(first as RoleInitializationComponent, { locale: "en" });
  profile.init!(second as RoleInitializationComponent, { locale: "en" });
  const one = findNightAbility(first, "pair_check")!,
    two = findNightAbility(second, "pair_check")!;
  expect((first.privateState as { readonly pairSeer?: unknown }).pairSeer).toBe(one.state);
  expect((second.privateState as { readonly pairSeer?: unknown }).pairSeer).toBe(two.state);
  expect(one.state).not.toBe(two.state);
  expect(one.state.history).not.toBe(two.state.history);
  expect(Object.keys(first.privateState)).toEqual(["abilities", "pairSeer"]);
  expect(JSON.parse(JSON.stringify(first.privateState))).toEqual({
    abilities: {
      "native:pair_check": {
        id: "native:pair_check",
        kind: "pair_check",
        state: { policy: "awa_fragrant_pair_seer_v1", history: [] },
        source: { kind: "native", role: "awakened_seer" },
        sourceDisclosed: true,
        startsOnDay: 1,
        maxUses: null,
        uses: 0,
        lastUsedDay: null,
        disabled: false,
      },
    },
    pairSeer: { policy: "awa_fragrant_pair_seer_v1", history: [] },
  });
});

test("initializer evaluates the checkpoint alias left-hand reference before installation reads privateState", () => {
  const role = createRoleComponent(Role.AwakenedSeer, Camp.Good, "en"),
    aliasContainer: Record<string, unknown> = {},
    abilityContainer: Record<string, unknown> = {},
    reads: number[] = [];
  Object.defineProperty(role, "privateState", {
    get: () => {
      reads.push(reads.length + 1);
      return reads.length === 1 ? aliasContainer : abilityContainer;
    },
  });
  installPairStateSlot(role);
  const ability = (abilityContainer.abilities as Record<string, NightAbility<"pair_check">>)[
    "native:pair_check"
  ]!;
  expect(reads).toEqual([1, 2, 3]);
  expect(aliasContainer.pairSeer).toBe(ability.state);
  expect(aliasContainer.abilities).toBeUndefined();
  expect(abilityContainer.pairSeer).toBeUndefined();
  expect(ability.state).toEqual({ policy: "awa_fragrant_pair_seer_v1", history: [] });
});

test("pair commitment retains state and aliases while updating history, counters and audit JSON in place", () => {
  const { role, ability, slot } = fixture(),
    original = ability.state,
    oldHistory = original.history,
    next: PairSeerState = {
      policy: "awa_fragrant_pair_seer_v1",
      history: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
    };
  commitPairStateSlot(slot, next, 1);
  expect(ability.state).toBe(original);
  expect((role.privateState as { readonly pairSeer?: unknown }).pairSeer).toBe(original);
  expect(original.history).toBe(next.history);
  expect(original.history).not.toBe(oldHistory);
  expect(original).toEqual({
    policy: "awa_fragrant_pair_seer_v1",
    history: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
  });
  expect(ability.uses).toBe(1);
  expect(ability.lastUsedDay).toBe(1);
  expect(slot.pairJson).toBe(
    '{"policy":"awa_fragrant_pair_seer_v1","history":[{"day":1,"targetIds":[2,6],"containsWerewolf":true}]}',
  );
  expect(JSON.parse(slot.pairAbilityJson)).toEqual({
    id: "native:pair_check",
    kind: "pair_check",
    state: {
      policy: "awa_fragrant_pair_seer_v1",
      history: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
    },
    source: { kind: "native", role: "awakened_seer" },
    sourceDisclosed: true,
    startsOnDay: 1,
    maxUses: null,
    uses: 1,
    lastUsedDay: 1,
    disabled: false,
  });
});

test("non-writable ability or state fields reject before history, counters or audit snapshot writes", () => {
  for (const field of ["counter", "history"] as const) {
    const { role, ability, slot } = fixture(),
      originalPair = slot.pairJson,
      originalAbility = slot.pairAbilityJson;
    Object.defineProperty(
      field === "counter" ? ability : ability.state,
      field === "counter" ? "uses" : "history",
      {
        writable: false,
      },
    );
    expect(() =>
      commitPairStateSlot(
        slot,
        {
          policy: "awa_fragrant_pair_seer_v1",
          history: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
        },
        1,
      ),
    ).toThrow("fragrant_state_write_revoked");
    expect(ability.state).toEqual({ policy: "awa_fragrant_pair_seer_v1", history: [] });
    expect((role.privateState as { readonly pairSeer?: unknown }).pairSeer).toBe(ability.state);
    expect(ability.uses).toBe(0);
    expect(ability.lastUsedDay).toBe(null);
    expect(slot.pairJson).toBe(originalPair);
    expect(slot.pairAbilityJson).toBe(originalAbility);
  }
});
