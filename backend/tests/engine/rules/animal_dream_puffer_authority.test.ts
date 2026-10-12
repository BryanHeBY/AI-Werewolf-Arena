import { expect, test } from "bun:test";
import { animalRosterFixture } from "../animal_dream_fixture";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import type { VotingRightComponent } from "../../../src/core/domain/components/voting_right";
import {
  installAnimalAuthority,
  beginAnimalNight,
  closeAnimalNight,
  openAnimalFoxChoice,
  beginAnimalExileUnit,
  recordAnimalBallotRound,
  sealAnimalBallots,
  animalPufferChoiceActor,
  openAnimalPufferChoice,
  createAnimalPufferRequest,
  animalPufferReaction,
  prepareAnimalCatExpiry,
  closeAnimalExileUnit,
  commitAnimalPufferKnifeDeath,
  animalBeautyLinkBlocked,
  animalAuthoritySnapshot,
  filterAnimalLethalWave,
} from "../../../src/game/mechanisms/roles/animal_dream/authority";
const fixture = (first = false) =>
  animalRosterFixture(undefined, (world, config) =>
    installAnimalAuthority(world, {
      ...config,
      pufferfish: { ballotPolicy: first ? "awa_first_ballot_v1" : "awa_final_ballot_v1" },
    }),
  );
function night(f: ReturnType<typeof fixture>, day: number) {
  beginAnimalNight(f.world, day, () => true);
  if (day >= 2) openAnimalFoxChoice(f.world, day).commit(null);
  closeAnimalNight(f.world, day, "normal");
}
function ballots(
  f: ReturnType<typeof fixture>,
  selected: Record<number, number | null> = {},
  candidates: readonly number[] = [],
) {
  return f.world
    .getAliveEntityIds()
    .filter((id) => !candidates.includes(id))
    .map((actorId) => {
      const targetId = selected[actorId] ?? null;
      return {
        actorId,
        targetId,
        abstain: targetId === null,
        weight:
          targetId === null
            ? 0
            : f.world.getComponent<VotingRightComponent>(actorId, COMPONENT.VotingRight)!.weight,
      };
    });
}
function reaction(
  f: ReturnType<typeof fixture>,
  day = 1,
  selected: Record<number, number | null> = { 2: 12 },
  current = () => true,
) {
  night(f, day);
  const token = beginAnimalExileUnit(f.world, day, "exile", current);
  recordAnimalBallotRound(f.world, token, 1, ballots(f, selected));
  sealAnimalBallots(f.world, token);
  return token;
}
function finish(f: ReturnType<typeof fixture>, token: object) {
  // Raw owner tests simulate the future sole DeathResolution consumer.
  for (const id of animalPufferReaction(f.world, token)) f.life(id).alive = false;
  prepareAnimalCatExpiry(f.world, token);
  closeAnimalExileUnit(f.world, token);
}
test("full accepted electorate, self ballot and 1.5 weight give one target per original voter", () => {
  const f = fixture();
  f.world.getComponent<VotingRightComponent>(12, COMPONENT.VotingRight)!.weight = 1.5;
  const token = reaction(f, 1, { 2: 12, 12: 12 });
  const receipt = openAnimalPufferChoice(f.world, token).commit(true);
  expect(receipt).toEqual({ day: 1, activate: true });
  expect(Object.keys(receipt)).toEqual(["day", "activate"]);
  expect(animalPufferReaction(f.world, token)).toEqual([2, 12]);
  expect(animalAuthoritySnapshot(f.world)!.puffer).toEqual({
    policy: "awa_animal_dream_v1",
    usedDay: 1,
    knifeDeathDay: null,
    history: [{ day: 1, activate: true, targetIds: [2, 12] }],
  });
  expect(() => openAnimalPufferChoice(f.world, token)).toThrow();
});
test("Puffer mandatory choice prevents closure; false records a pass and preserves the whole-game use", () => {
  const f = fixture(),
    token = reaction(f);
  expect(() => prepareAnimalCatExpiry(f.world, token)).toThrow("animal_exile_unit_not_complete");
  expect(() => closeAnimalExileUnit(f.world, token)).toThrow("animal_exile_unit_not_complete");
  openAnimalPufferChoice(f.world, token).commit(false);
  expect(animalPufferReaction(f.world, token)).toEqual([]);
  prepareAnimalCatExpiry(f.world, token);
  closeAnimalExileUnit(f.world, token);
  expect(animalAuthoritySnapshot(f.world)!.puffer.usedDay).toBeNull();
  const second = reaction(f, 2, { 3: 12 });
  openAnimalPufferChoice(f.world, second).commit(true);
  expect(animalPufferReaction(f.world, second)).toEqual([3]);
  expect(animalAuthoritySnapshot(f.world)!.puffer.history).toEqual([
    { day: 1, activate: false, targetIds: [2] },
    { day: 2, activate: true, targetIds: [3] },
  ]);
});
for (const first of [false, true])
  test(`${first ? "first" : "final"} ballot policy with all-abstain PK does not fall back to another round`, () => {
    const f = fixture(first);
    night(f, 1);
    const token = beginAnimalExileUnit(f.world, 1, "exile", () => true);
    recordAnimalBallotRound(f.world, token, 1, ballots(f, { 2: 12, 3: 12, 4: 5, 6: 5 }));
    expect(() => sealAnimalBallots(f.world, token)).toThrow("animal_ballot_pk_required");
    recordAnimalBallotRound(f.world, token, 2, ballots(f, {}, [5, 12]), [5, 12]);
    sealAnimalBallots(f.world, token);
    expect(animalPufferChoiceActor(f.world, token)).toBe(first ? 12 : null);
    if (first) {
      openAnimalPufferChoice(f.world, token).commit(true);
      expect(animalPufferReaction(f.world, token)).toEqual([2, 3]);
    } else {
      expect(() => openAnimalPufferChoice(f.world, token)).toThrow();
      expect(animalAuthoritySnapshot(f.world)!.puffer.history).toEqual([]);
    }
    finish(f, token);
  });
test("final tied PK still offers Puffer a reaction based on its accepted final voters", () => {
  const f = fixture();
  night(f, 1);
  const token = beginAnimalExileUnit(f.world, 1, "exile", () => true);
  recordAnimalBallotRound(f.world, token, 1, ballots(f, { 2: 12, 3: 12, 4: 5, 6: 5 }));
  recordAnimalBallotRound(f.world, token, 2, ballots(f, { 2: 12, 3: 5 }, [5, 12]), [5, 12]);
  sealAnimalBallots(f.world, token);
  openAnimalPufferChoice(f.world, token).commit(true);
  expect(animalPufferReaction(f.world, token)).toEqual([2]);
});
test("no legal target has no request and no consumption; incomplete ballots cannot close an exile unit", () => {
  const f = fixture();
  night(f, 1);
  const token = beginAnimalExileUnit(f.world, 1, "exile", () => true);
  expect(() => prepareAnimalCatExpiry(f.world, token)).toThrow("animal_exile_unit_not_complete");
  expect(() => closeAnimalExileUnit(f.world, token)).toThrow();
  recordAnimalBallotRound(f.world, token, 1, ballots(f));
  sealAnimalBallots(f.world, token);
  expect(animalPufferChoiceActor(f.world, token)).toBeNull();
  expect(() => openAnimalPufferChoice(f.world, token).commit(true)).toThrow();
  prepareAnimalCatExpiry(f.world, token);
  closeAnimalExileUnit(f.world, token);
  expect(animalAuthoritySnapshot(f.world)!.puffer.history).toEqual([]);
});
test("incomplete, duplicate, fabricated weights and false PK electorates cannot become accepted round receipts", () => {
  const f = fixture();
  night(f, 1);
  const token = beginAnimalExileUnit(f.world, 1, "exile", () => true),
    full = ballots(f, { 2: 12 });
  expect(() => recordAnimalBallotRound(f.world, token, 1, full.slice(1))).toThrow();
  expect(() =>
    recordAnimalBallotRound(f.world, token, 1, [...full.slice(0, -1), full[0]!]),
  ).toThrow();
  expect(() =>
    recordAnimalBallotRound(
      f.world,
      token,
      1,
      full.map((v) => (v.actorId === 2 ? { ...v, weight: 1.5 } : v)),
    ),
  ).toThrow();
  recordAnimalBallotRound(f.world, token, 1, full);
  expect(() =>
    recordAnimalBallotRound(f.world, token, 2, ballots(f, {}, [5, 12]), [5, 12]),
  ).toThrow();
  sealAnimalBallots(f.world, token);
  expect(() => recordAnimalBallotRound(f.world, token, 1, full)).toThrow();
  expect(animalAuthoritySnapshot(f.world)!.puffer.history).toEqual([]);
});
test("PK candidates cannot vote and ordinary self votes remain legal", () => {
  const f = fixture();
  night(f, 1);
  const token = beginAnimalExileUnit(f.world, 1, "exile", () => true);
  recordAnimalBallotRound(f.world, token, 1, ballots(f, { 2: 12, 3: 12, 4: 5, 6: 5 }));
  expect(() =>
    recordAnimalBallotRound(f.world, token, 2, ballots(f, { 12: 12 }), [5, 12]),
  ).toThrow();
  recordAnimalBallotRound(f.world, token, 2, ballots(f, { 2: 12 }, [5, 12]), [5, 12]);
  sealAnimalBallots(f.world, token);
  openAnimalPufferChoice(f.world, token).commit(true);
  expect(animalPufferReaction(f.world, token)).toEqual([2]);
});
for (const target of ["actor", "voter"] as const)
  test(`last external guard revokes ${target} original body before payment`, () => {
    const f = fixture();
    let armed = false,
      calls = 0;
    const token = reaction(f, 1, { 2: 12 }, () => {
      if (armed && ++calls === 2)
        f.world.addComponent(target === "actor" ? 12 : 2, COMPONENT.Alive, createAliveComponent());
      return true;
    });
    const choice = openAnimalPufferChoice(f.world, token);
    armed = true;
    expect(() => choice.commit(true)).toThrow();
    expect(animalAuthoritySnapshot(f.world, false)!.puffer.usedDay).toBeNull();
    expect(animalAuthoritySnapshot(f.world, false)!.puffer.history).toEqual([]);
  });
test("all request aliases inherit earlier cancellation and deadline without running request callbacks", async () => {
  const f = fixture(),
    token = reaction(f);
  const earlier = createAnimalPufferRequest(f.world, token, Date.now() + 30);
  openAnimalPufferChoice(f.world, token, earlier.token);
  const later = openAnimalPufferChoice(
    f.world,
    token,
    createAnimalPufferRequest(f.world, token).token,
  );
  await Bun.sleep(45);
  expect(() => later.commit(true)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.puffer.history).toEqual([]);
});
test("last phase callback revoking an earlier permit prevents payment", () => {
  const f = fixture();
  let armed = false,
    calls = 0;
  let earlier: ReturnType<typeof createAnimalPufferRequest>;
  const token = reaction(f, 1, { 2: 12 }, () => {
    if (armed && ++calls === 2) earlier.revoke();
    return true;
  });
  earlier = createAnimalPufferRequest(f.world, token);
  openAnimalPufferChoice(f.world, token, earlier.token);
  const later = openAnimalPufferChoice(f.world, token);
  armed = true;
  expect(() => later.commit(true)).toThrow();
  expect(animalAuthoritySnapshot(f.world, false)!.puffer.history).toEqual([]);
});
test("paid reaction retains original first deaths and failure snapshot does not invent an Alive commit", () => {
  const f = fixture(),
    token = reaction(f);
  openAnimalPufferChoice(f.world, token).commit(true);
  expect(f.life(2).alive).toBe(true);
  f.life(12).alive = false;
  expect(animalPufferReaction(f.world, token)).toEqual([2]);
  closeAnimalNight(f.world, 1, "aborted");
  const saved = animalAuthoritySnapshot(f.world, false)!;
  expect(saved.puffer.usedDay).toBe(1);
  expect(saved.unit!.puffer!.targetIds).toEqual([2]);
  expect(f.life(2).alive).toBe(true);
  saved.puffer.history.length = 0;
  expect(animalAuthoritySnapshot(f.world, false)!.puffer.history.length).toBe(1);
});
test("knife passive requires actual first death with knife cause, independent of spent active stock", () => {
  const f = fixture(),
    token = reaction(f);
  openAnimalPufferChoice(f.world, token).commit(true);
  finish(f, token);
  night(f, 2);
  expect(() => commitAnimalPufferKnifeDeath(f.world, 2, ["wolf_kill"], () => true)).toThrow();
  f.life(12).alive = false;
  expect(() => commitAnimalPufferKnifeDeath(f.world, 2, ["exile"], () => true)).toThrow();
  commitAnimalPufferKnifeDeath(f.world, 2, ["wolf_kill"], () => true);
  expect(animalBeautyLinkBlocked(f.world, 2)).toBe(true);
  expect(animalAuthoritySnapshot(f.world)!.puffer.usedDay).toBe(1);
  expect(animalAuthoritySnapshot(f.world)!.puffer.knifeDeathDay).toBe(2);
  expect(() => commitAnimalPufferKnifeDeath(f.world, 2, ["wolf_kill"], () => true)).toThrow();
  night(f, 3);
  expect(animalBeautyLinkBlocked(f.world, 2)).toBe(false);
  expect(animalAuthoritySnapshot(f.world)!.puffer.knifeDeathDay).toBe(2);
});
test("revoked resource getter never enters failed canonical reaction history", () => {
  const f = fixture();
  let armed = false,
    calls = 0,
    reads = 0;
  const token = reaction(f, 1, { 2: 12 }, () => {
    if (armed && ++calls === 2)
      Object.defineProperty(f.role(12).privateState, "pufferfish", {
        enumerable: true,
        get() {
          reads++;
          return {};
        },
      });
    return true;
  });
  const choice = openAnimalPufferChoice(f.world, token);
  armed = true;
  expect(() => choice.commit(true)).toThrow();
  expect(reads).toBe(0);
  expect(animalAuthoritySnapshot(f.world, false)!.puffer.history).toEqual([]);
});
test("normal unit closure waits for all paid targets to die or an actual Cat deferral", () => {
  const f = fixture(),
    token = reaction(f, 1, { 2: 12, 9: 12 });
  openAnimalPufferChoice(f.world, token).commit(true);
  prepareAnimalCatExpiry(f.world, token);
  expect(() => closeAnimalExileUnit(f.world, token)).toThrow("animal_exile_unit_not_complete");
  f.life(2).alive = false;
  expect(() => closeAnimalExileUnit(f.world, token)).toThrow("animal_exile_unit_not_complete");
  const filtered = filterAnimalLethalWave(
    f.world,
    1,
    "voting",
    [9],
    { 9: ["puffer_retaliation"] },
    token,
  );
  expect(filtered).toEqual({ deaths: [], revealedCatId: 9, blockedCatId: 9 });
  expect(f.life(9).alive).toBe(true);
  expect(() => closeAnimalExileUnit(f.world, token)).toThrow("animal_exile_unit_not_complete");
  expect(prepareAnimalCatExpiry(f.world, token)).toBeNull();
  closeAnimalExileUnit(f.world, token);
  expect(animalAuthoritySnapshot(f.world)!.completedUnits).toBe(1);
});
test("an old first death cannot become this night's knife passive", () => {
  const f = fixture();
  f.life(12).alive = false;
  night(f, 1);
  expect(() => commitAnimalPufferKnifeDeath(f.world, 1, ["wolf_kill"], () => true)).toThrow();
  expect(animalAuthoritySnapshot(f.world)!.puffer.knifeDeathDay).toBeNull();
  night(f, 2);
  expect(() => commitAnimalPufferKnifeDeath(f.world, 2, ["wolf_kill"], () => true)).toThrow();
  expect(animalBeautyLinkBlocked(f.world, 2)).toBe(false);
});
test("starting/open night cannot commit a knife passive; its normal handoff can", () => {
  const f = fixture();
  beginAnimalNight(f.world, 1, () => true);
  f.life(12).alive = false;
  expect(() => commitAnimalPufferKnifeDeath(f.world, 1, ["wolf_kill"], () => true)).toThrow();
  closeAnimalNight(f.world, 1, "normal");
  commitAnimalPufferKnifeDeath(f.world, 1, ["wolf_kill"], () => true);
  expect(animalAuthoritySnapshot(f.world)!.puffer.knifeDeathDay).toBe(1);
});
for (const mutation of ["weight", "getter"] as const)
  test(`malformed living voter ${mutation} cannot be silently omitted from the complete electorate`, () => {
    const f = fixture();
    night(f, 1);
    const token = beginAnimalExileUnit(f.world, 1, "exile", () => true);
    const votes = ballots(f).filter((v) => v.actorId !== 2),
      voting = f.world.getComponent<VotingRightComponent>(2, COMPONENT.VotingRight)!;
    let calls = 0;
    if (mutation === "weight") voting.weight = 2;
    else
      Object.defineProperty(voting, "weight", {
        enumerable: true,
        get() {
          calls++;
          return 2;
        },
      });
    expect(() => recordAnimalBallotRound(f.world, token, 1, votes)).toThrow(
      "animal_ballot_round_invalid",
    );
    expect(calls).toBe(0);
    expect(animalAuthoritySnapshot(f.world)!.unit!.ballots).toEqual([]);
  });
test("accepted raw ballots are captured before the first external phase guard", () => {
  const f = fixture();
  night(f, 1);
  let armed = false;
  const votes = ballots(f),
    token = beginAnimalExileUnit(f.world, 1, "exile", () => {
      if (armed) {
        Object.assign(votes[1]!, { targetId: 12, abstain: false, weight: 1 });
      }
      return true;
    });
  armed = true;
  recordAnimalBallotRound(f.world, token, 1, votes);
  sealAnimalBallots(f.world, token);
  expect(animalPufferChoiceActor(f.world, token)).toBeNull();
  expect(animalAuthoritySnapshot(f.world)!.unit!.ballots[0]!.votes[1]).toEqual({
    actorId: 2,
    targetId: null,
    abstain: true,
    weight: 0,
  });
});
