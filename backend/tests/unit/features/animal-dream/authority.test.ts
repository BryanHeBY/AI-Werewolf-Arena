/**
 * Unit tests for animal-dream; Isolated animal-dream authority contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import {
  animalRosterFixture,
  animalInternalConfig,
} from "../../../support/features/animal-dream/builders/roster";
import {
  installAnimalAuthority,
  beginAnimalNight,
  closeAnimalNight,
  openAnimalFoxChoice,
  createAnimalFoxRequest,
  animalFoxEffect,
  animalAuthoritySnapshot,
} from "../../../../src/game/mechanisms/roles/animal_dream/authority";
import { activeCharm, bindCharm } from "../../../../src/game/mechanisms/roles/wolf_beauty/relation";
import { getWolfBeautyState } from "../../../../src/game/mechanisms/roles/private_state";
const fixture = () => animalRosterFixture(undefined, installAnimalAuthority);
const secondNight = (f: ReturnType<typeof fixture>, current: () => boolean = () => true) => {
  beginAnimalNight(f.world, 1, () => true);
  closeAnimalNight(f.world, 1, "normal");
  beginAnimalNight(f.world, 2, current);
};
test("one original owner and N1 has no Fox opportunity", () => {
  const f = fixture();
  expect(() => installAnimalAuthority(f.world, animalInternalConfig())).toThrow(
    "animal_authority_already_installed",
  );
  beginAnimalNight(f.world, 1, () => true);
  expect(() => openAnimalFoxChoice(f.world, 1)).toThrow();
  expect(() => beginAnimalNight(f.world, 1, () => true)).toThrow();
});
test("callback failure reserves and terminates night without spending", () => {
  const f = fixture();
  const failure = Error("literal_phase_failure");
  expect(() =>
    beginAnimalNight(f.world, 1, () => {
      throw failure;
    }),
  ).toThrow(failure);
  expect(animalAuthoritySnapshot(f.world, false)!.night).toEqual({
    day: 1,
    status: "aborted",
    requiresFox: false,
    foxPaid: false,
  });
  expect(() => beginAnimalNight(f.world, 1, () => true)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.fox.usedNight).toBeNull();
});
test("night callback reentry cannot create a second epoch", () => {
  const f = fixture();
  let rejected = false;
  beginAnimalNight(f.world, 1, () => {
    try {
      beginAnimalNight(f.world, 1, () => true);
    } catch {
      rejected = true;
    }
    return true;
  });
  expect(rejected).toBe(true);
  expect(animalAuthoritySnapshot(f.world)!.night!.status).toBe("open");
});
test("mandatory Fox choice precedes normal night closure; deliberate pass leaves one use", () => {
  const f = fixture();
  secondNight(f);
  expect(() => closeAnimalNight(f.world, 2, "normal")).toThrow("animal_night_not_complete");
  expect(openAnimalFoxChoice(f.world, 2).commit(null)).toEqual({ day: 2, targetId: null });
  closeAnimalNight(f.world, 2, "normal");
  beginAnimalNight(f.world, 3, () => true);
  openAnimalFoxChoice(f.world, 3).commit(5);
  expect(animalAuthoritySnapshot(f.world)!.fox).toEqual({
    policy: "awa_animal_dream_v1",
    usedNight: 3,
    history: [
      { day: 2, targetId: null },
      { day: 3, targetId: 5 },
    ],
  });
});
test("malformed or dead target does not spend and same lease can be corrected", () => {
  const f = fixture();
  secondNight(f);
  f.life(5).alive = false;
  const scope = openAnimalFoxChoice(f.world, 2);
  expect(() => scope.commit(5)).toThrow("animal_fox_target_unavailable");
  expect(() => scope.commit(13)).toThrow("animal_fox_target_unavailable");
  expect(() => scope.commit(-1)).toThrow();
  expect(animalAuthoritySnapshot(f.world)!.fox.history).toEqual([]);
  scope.commit(10);
  expect(animalFoxEffect(f.world)).toEqual({
    day: 2,
    targetId: 10,
    knifeBlocked: false,
    beautyBlocked: false,
  });
});
test("Wolf choice has identical own receipt and only God effect contains camp consequence", () => {
  const f = fixture();
  secondNight(f);
  const receipt = openAnimalFoxChoice(f.world, 2).commit(2);
  expect(Object.keys(receipt)).toEqual(["day", "targetId"]);
  expect(receipt).toEqual({ day: 2, targetId: 2 });
  expect(animalFoxEffect(f.world)).toEqual({
    day: 2,
    targetId: 2,
    knifeBlocked: true,
    beautyBlocked: false,
  });
  expect(() => openAnimalFoxChoice(f.world, 2)).toThrow();
});
test("Fox clears old Beauty binding without fabricating a Night pass", () => {
  const f = fixture(),
    state = getWolfBeautyState(f.role(1))!;
  beginAnimalNight(f.world, 1, () => true);
  (state as { targetId: number | null }).targetId = 5;
  (state as { lastActedDay: number | null }).lastActedDay = 1;
  (
    state.history as {
      day: number;
      targetId: import("@ai-werewolf-arena/game-contract").EntityId | null;
    }[]
  ).push({ day: 1, targetId: 5 });
  bindCharm(f.world, 1, 5);
  closeAnimalNight(f.world, 1, "normal");
  beginAnimalNight(f.world, 2, () => true);
  openAnimalFoxChoice(f.world, 2).commit(1);
  expect(state).toEqual({ targetId: null, lastActedDay: 1, history: [{ day: 1, targetId: 5 }] });
  expect(activeCharm(f.world, 1)).toBeNull();
  expect(animalFoxEffect(f.world)).toEqual({
    day: 2,
    targetId: 1,
    knifeBlocked: true,
    beautyBlocked: true,
  });
});
test("an expired alias withdraws the shared lease forever", () => {
  const f = fixture();
  secondNight(f);
  const earlier = createAnimalFoxRequest(f.world, 2);
  openAnimalFoxChoice(f.world, 2, earlier.token);
  const later = openAnimalFoxChoice(f.world, 2, createAnimalFoxRequest(f.world, 2).token);
  earlier.revoke();
  expect(later.isCurrent()).toBe(false);
  expect(() => later.commit(2)).toThrow();
  expect(animalAuthoritySnapshot(f.world)!.fox.history).toEqual([]);
});
test("last callback can revoke the resource slot before a payment", () => {
  const f = fixture();
  let calls = 0;
  secondNight(f, () => {
    if (++calls === 3)
      Object.defineProperty(f.role(10).privateState, "foxCub", { writable: false });
    return true;
  });
  const scope = openAnimalFoxChoice(f.world, 2);
  expect(() => scope.commit(2)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.fox.usedNight).toBeNull();
  expect(animalAuthoritySnapshot(f.world, false)!.fox.history).toEqual([]);
});
test("final phase callback cannot register a new alias even when it catches the rejection", () => {
  const f = fixture();
  let calls = 0;
  secondNight(f, () => {
    if (++calls === 3) {
      try {
        openAnimalFoxChoice(f.world, 2);
      } catch {
        // Reentry itself withdraws the original lease.
      }
    }
    return true;
  });
  expect(() => openAnimalFoxChoice(f.world, 2).commit(2)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.fox.history).toEqual([]);
});
test("final phase callback revoking any earlier request prevents payment without another callback", () => {
  const f = fixture();
  let calls = 0;
  let earlier: ReturnType<typeof createAnimalFoxRequest>;
  secondNight(f, () => {
    if (++calls === 3) earlier.revoke();
    return true;
  });
  earlier = createAnimalFoxRequest(f.world, 2);
  openAnimalFoxChoice(f.world, 2, earlier.token);
  const later = openAnimalFoxChoice(f.world, 2, createAnimalFoxRequest(f.world, 2).token);
  expect(() => later.commit(2)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.fox.usedNight).toBeNull();
});
test("opaque request rejects forged and foreign tokens", () => {
  const f = fixture(),
    other = fixture();
  secondNight(f);
  secondNight(other);
  expect(() => openAnimalFoxChoice(f.world, 2, {})).toThrow();
  expect(() =>
    openAnimalFoxChoice(f.world, 2, createAnimalFoxRequest(other.world, 2).token),
  ).toThrow();
  let calls = 0;
  expect(() =>
    openAnimalFoxChoice(f.world, 2, () => {
      calls++;
      return true;
    }),
  ).toThrow();
  expect(calls).toBe(0);
  expect(
    openAnimalFoxChoice(f.world, 2, createAnimalFoxRequest(f.world, 2).token).commit(2),
  ).toEqual({ day: 2, targetId: 2 });
});
test("absolute request deadline expires without resetting another alias budget", async () => {
  const f = fixture();
  secondNight(f);
  const first = createAnimalFoxRequest(f.world, 2, Date.now() + 30);
  openAnimalFoxChoice(f.world, 2, first.token);
  const later = openAnimalFoxChoice(f.world, 2, createAnimalFoxRequest(f.world, 2).token);
  await Bun.sleep(45);
  expect(() => later.commit(2)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.fox.history).toEqual([]);
  expect(() => openAnimalFoxChoice(f.world, 2)).toThrow();
});
test("night entry aborts if its callback changes any original life", () => {
  for (const id of [10, 5]) {
    const f = fixture();
    beginAnimalNight(f.world, 1, () => true);
    closeAnimalNight(f.world, 1, "normal");
    expect(() =>
      beginAnimalNight(f.world, 2, () => {
        f.life(id).alive = false;
        return true;
      }),
    ).toThrow("animal_night_revoked");
    expect(animalAuthoritySnapshot(f.world, false)!.night!.status).toBe("aborted");
    expect(() => beginAnimalNight(f.world, 2, () => true)).toThrow();
    expect(() => beginAnimalNight(f.world, 3, () => true)).toThrow();
    expect(animalAuthoritySnapshot(f.world, false)!.fox.history).toEqual([]);
  }
});
test("an original death completed before night entry does not revoke that entry", () => {
  const f = fixture();
  f.life(10).alive = false;
  secondNight(f);
  expect(animalAuthoritySnapshot(f.world)!.night!.requiresFox).toBe(false);
  closeAnimalNight(f.world, 2, "normal");
});
test("paid effect survives caster first death but abort closes its runtime query", () => {
  const f = fixture();
  secondNight(f);
  openAnimalFoxChoice(f.world, 2).commit(2);
  f.life(10).alive = false;
  expect(animalFoxEffect(f.world)!.knifeBlocked).toBe(true);
  closeAnimalNight(f.world, 2, "aborted");
  expect(animalFoxEffect(f.world)).toBeNull();
  expect(animalAuthoritySnapshot(f.world, false)!.fox.usedNight).toBe(2);
  expect(animalAuthoritySnapshot(f.world, false)!.effect!.knifeBlocked).toBe(true);
});
test("next real night clears temporary effect without restoring the one use", () => {
  const f = fixture();
  secondNight(f);
  openAnimalFoxChoice(f.world, 2).commit(2);
  closeAnimalNight(f.world, 2, "normal");
  beginAnimalNight(f.world, 3, () => true);
  expect(animalFoxEffect(f.world)).toBeNull();
  expect(() => openAnimalFoxChoice(f.world, 3)).toThrow();
  expect(animalAuthoritySnapshot(f.world)!.fox.usedNight).toBe(2);
});
test("canonical failure snapshot does not execute a revoked inventory getter or refund payment", () => {
  const f = fixture();
  secondNight(f);
  openAnimalFoxChoice(f.world, 2).commit(2);
  let calls = 0;
  Object.defineProperty(f.role(10).privateState.foxCub!, "usedNight", {
    enumerable: true,
    get() {
      calls++;
      return null;
    },
  });
  expect(animalAuthoritySnapshot(f.world)).toBeNull();
  const saved = animalAuthoritySnapshot(f.world, false)!;
  expect(saved.fox.usedNight).toBe(2);
  expect(saved.fox.history).toEqual([{ day: 2, targetId: 2 }]);
  saved.fox.history.push({ day: 3, targetId: null });
  expect(animalAuthoritySnapshot(f.world, false)!.fox.history.length).toBe(1);
  expect(calls).toBe(0);
});
test("normal closure observes the phase callback and cannot authorize the next night after cancellation", () => {
  const f = fixture();
  let phase = true;
  beginAnimalNight(f.world, 1, () => phase);
  phase = false;
  expect(() => closeAnimalNight(f.world, 1, "normal")).toThrow("animal_night_revoked");
  expect(() => beginAnimalNight(f.world, 2, () => true)).toThrow();
});
