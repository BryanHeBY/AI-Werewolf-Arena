/**
 * Unit tests for noble-secret-body; Isolated noble-secret-body player-projection contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { Phase } from "../../../../src/domain/identity";
import { nobleBodyAuthorityFixture } from "../../../support/features/noble-secret-body/drivers/authority";
import {
  beginNobleBodyNight,
  openSecretBodyChoice,
  openServantChoice,
  clearServantFromHunt,
  expireServantAtNightEnd,
  closeNobleBodyNight,
  resolveSecretBodyDamage,
  consumeSecretBodyExile,
  getNobleBodyPlayerState,
  snapshotNobleBodyAuthority,
} from "../../../../src/features/noble-secret-body/authority";

function bodyDay(spend: boolean, cause: "wolf_kill" | "servant_expiry" = "wolf_kill") {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 3);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  resolveSecretBodyDamage(f.world, 1, spend ? { 3: [cause] } : {});
  return f;
}
test("same public day and choice remain indistinguishable until next-night notice", () => {
  const spent = bodyDay(true),
    intact = bodyDay(false);
  expect(snapshotNobleBodyAuthority(spent.world).body.body.kind).toBe("night_spent");
  expect(snapshotNobleBodyAuthority(intact.world).body.body.kind).toBe("intact");
  for (const phase of [Phase.Day, Phase.Voting, Phase.GameOver]) {
    expect(getNobleBodyPlayerState(spent.world, 2, phase)).toEqual(
      getNobleBodyPlayerState(intact.world, 2, phase),
    );
    expect(getNobleBodyPlayerState(spent.world, 2, phase)?.state.awaitingNightReport).toBe(true);
  }
  const notices = beginNobleBodyNight(spent.world, 2, () => true);
  expect(notices.find((n) => n.kind === "secret_body")?.known).toMatchObject({
    resource: "spent",
    lastNotifiedNight: 2,
  });
  expect(() => openSecretBodyChoice(spent.world, 2)).toThrow("secret_body_unavailable");
  expect(getNobleBodyPlayerState(spent.world, 2, Phase.Night)?.state).toMatchObject({
    resource: "spent",
    awaitingNightReport: false,
  });
  expect(
    snapshotNobleBodyAuthority(spent.world).notices.filter((n) => n.actorId === 2),
  ).toHaveLength(2);
});
test("next-night spent report omits actual protected target and damage cause", () => {
  const knife = bodyDay(true),
    expiry = bodyDay(true, "servant_expiry");
  beginNobleBodyNight(knife.world, 2, () => true);
  beginNobleBodyNight(expiry.world, 2, () => true);
  expect(getNobleBodyPlayerState(knife.world, 2, Phase.Night)).toEqual(
    getNobleBodyPlayerState(expiry.world, 2, Phase.Night),
  );
  const dto = getNobleBodyPlayerState(expiry.world, 2, Phase.Night)!;
  expect(JSON.stringify(dto)).not.toContain("servant_expiry");
  expect(Object.keys(dto.state)).toEqual([
    "protectionRepeatPolicy",
    "lastNotifiedNight",
    "resource",
    "publicRevealDay",
    "lastChoice",
    "awaitingNightReport",
  ]);
  expect(dto.state.lastChoice).toEqual({ day: 1, targetId: 3 });
});
test("noble knows creation immediately but hunt clear only at next-night notice", () => {
  const kept = nobleBodyAuthorityFixture(),
    cleared = nobleBodyAuthorityFixture();
  for (const f of [kept, cleared]) {
    f.night(1);
    f.finish(1);
    f.night(2, null, 3);
  }
  const creation = getNobleBodyPlayerState(kept.world, 1, Phase.Night);
  expect(creation?.kind).toBe("night_noble");
  if (creation?.kind === "night_noble")
    expect(creation.state.contracts[0]!.status).toEqual({ kind: "pending" });
  clearServantFromHunt(cleared.world, 2, 3);
  for (const f of [kept, cleared]) f.finish(2);
  expect(getNobleBodyPlayerState(kept.world, 1, Phase.Day)).toEqual(
    getNobleBodyPlayerState(cleared.world, 1, Phase.Day),
  );
  const notice = beginNobleBodyNight(cleared.world, 3, () => true).find(
    (n) => n.kind === "night_noble",
  );
  expect(notice?.known).toMatchObject({
    lastNotifiedNight: 3,
    contracts: [{ status: { kind: "cleared", day: 2 } }],
  });
  expect(() => openServantChoice(cleared.world, 3).commit(4)).not.toThrow();
  const keptNotice = beginNobleBodyNight(kept.world, 3, () => true).find(
    (n) => n.kind === "night_noble",
  );
  expect(keptNotice?.known).toMatchObject({ contracts: [{ status: { kind: "pending" } }] });
  expect(() => openServantChoice(kept.world, 3)).toThrow("night_noble_unavailable");
});
test("actual expiry stays hidden through the day and spent-next-night still receives notice", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  f.finish(2);
  beginNobleBodyNight(f.world, 3, () => true);
  openSecretBodyChoice(f.world, 3).commit(3);
  const before = getNobleBodyPlayerState(f.world, 1, Phase.Day);
  expireServantAtNightEnd(f.world, 3);
  closeNobleBodyNight(f.world, 3, "normal");
  resolveSecretBodyDamage(f.world, 3, { 3: ["servant_expiry"] });
  expect(getNobleBodyPlayerState(f.world, 1, Phase.Day)).toEqual(before);
  const notices = beginNobleBodyNight(f.world, 4, () => true);
  expect(notices).toHaveLength(2);
  expect(notices.find((n) => n.kind === "secret_body")?.known).toMatchObject({ resource: "spent" });
  expect(notices.find((n) => n.kind === "night_noble")?.known).toMatchObject({
    contracts: [{ status: { kind: "expired", day: 3 } }],
  });
});
test("original dead actors receive no new private notice", () => {
  const f = bodyDay(false);
  f.life(1).alive = false;
  f.life(2).alive = false;
  expect(beginNobleBodyNight(f.world, 2, () => true)).toEqual([]);
  expect(snapshotNobleBodyAuthority(f.world).knowledge.body.lastNotifiedNight).toBe(1);
  expect(snapshotNobleBodyAuthority(f.world).knowledge.noble.lastNotifiedNight).toBe(1);
});
test("public exile immediately updates known resource but preserves historical notices and choice", () => {
  const f = bodyDay(false);
  const before = snapshotNobleBodyAuthority(f.world).notices;
  expect(consumeSecretBodyExile(f.world, 1)).toEqual({ actorId: 2, day: 1 });
  expect(getNobleBodyPlayerState(f.world, 2, Phase.Day)?.state).toMatchObject({
    resource: "exile_revealed",
    publicRevealDay: 1,
    awaitingNightReport: false,
    lastChoice: { day: 1, targetId: 3 },
  });
  expect(f.life(2).alive).toBe(true);
  expect(snapshotNobleBodyAuthority(f.world).notices).toEqual(before);
});
test("projection and notice history are detached and deeply frozen", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  const dto = getNobleBodyPlayerState(f.world, 1, Phase.Day)!;
  expect(Object.isFrozen(dto.state)).toBe(true);
  if (dto.kind === "night_noble") {
    expect(Object.isFrozen(dto.state.contracts)).toBe(true);
    expect(Object.isFrozen(dto.state.contracts[0]!.status)).toBe(true);
    expect(Reflect.set(dto.state.contracts[0]!.status, "kind", "cleared")).toBe(false);
  }
  const historical = snapshotNobleBodyAuthority(f.world).notices;
  clearServantFromHunt(f.world, 2, 3);
  f.finish(2);
  beginNobleBodyNight(f.world, 3, () => true);
  expect(historical.at(-2)?.known.lastNotifiedNight).toBe(2);
  expect(getNobleBodyPlayerState(f.world, 4, Phase.Day)).toBeNull();
});
test("failed or duplicate begin never commits a notification", () => {
  const f = nobleBodyAuthorityFixture();
  expect(() => beginNobleBodyNight(f.world, 1, () => false)).toThrow();
  expect(snapshotNobleBodyAuthority(f.world).notices).toEqual([]);
  beginNobleBodyNight(f.world, 1, () => true);
  const before = snapshotNobleBodyAuthority(f.world);
  expect(() => beginNobleBodyNight(f.world, 1, () => true)).toThrow();
  expect(snapshotNobleBodyAuthority(f.world)).toEqual(before);
});
