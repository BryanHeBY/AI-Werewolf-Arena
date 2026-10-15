/**
 * 单元测试：验证贵族／不死之身的独立权威重入契约。输入为原内存 owner、frame、reader 与明确非法修改；原字面预期、对象身份和拒绝断言为 oracle，不组装完整对局。
 */
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { expect, test } from "bun:test";
import { nobleBodyAuthorityFixture } from "../../../support/features/noble-secret-body/drivers/authority";
import {
  installNobleBodyAuthority,
  beginNobleBodyNight,
  openSecretBodyChoice,
  openServantChoice,
  clearServantFromHunt,
  expireServantAtNightEnd,
  resolveSecretBodyDamage,
  closeNobleBodyNight,
  snapshotNobleBodyAuthority,
  consumeSecretBodyExile,
  closeServantForDeath,
} from "../../../../src/features/noble-secret-body/authority";
// Independent A/R counterexamples, preserved after the owner boundary repairs.
test("controller validation cannot recursively seize begin ownership", () => {
  const f = nobleBodyAuthorityFixture();
  let once = false,
    innerSucceeded = false,
    innerError: unknown,
    outerError: unknown;
  try {
    beginNobleBodyNight(f.world, 1, () => {
      if (!once) {
        once = true;
        try {
          beginNobleBodyNight(f.world, 1, () => true);
          innerSucceeded = true;
        } catch (e) {
          innerError = e;
        }
      }
      return true;
    });
  } catch (e) {
    outerError = e;
  }
  expect(innerSucceeded).toBe(false);
  expect(innerError).toBeDefined();
  expect(outerError).toBeUndefined();
});
test("controller validation cannot secretly clear servant before the outer hunt receipt", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  let armed = false,
    inCallback = false,
    innerReceipt: unknown,
    innerError: unknown;
  beginNobleBodyNight(f.world, 2, () => {
    if (armed && !inCallback) {
      inCallback = true;
      try {
        innerReceipt = clearServantFromHunt(f.world, 2, 3);
      } catch (e) {
        innerError = e;
      } finally {
        inCallback = false;
      }
    }
    return true;
  });
  openSecretBodyChoice(f.world, 2).commit(null);
  openServantChoice(f.world, 2).commit(3);
  armed = true;
  const outerReceipt = clearServantFromHunt(f.world, 2, 3);
  expect(innerReceipt).toBeUndefined();
  expect(innerError).toBeDefined();
  expect(outerReceipt).toEqual({ contractId: "servant:night:2", targetId: 3 });
});
test("controller validation cannot consume Body on behalf of a different outer damage source", () => {
  const f = nobleBodyAuthorityFixture();
  let armed = false,
    inCallback = false,
    innerReceipt: unknown,
    innerError: unknown;
  beginNobleBodyNight(f.world, 1, () => {
    if (armed && !inCallback) {
      inCallback = true;
      try {
        innerReceipt = resolveSecretBodyDamage(f.world, 1, { 3: ["poison"] });
      } catch (e) {
        innerError = e;
      } finally {
        inCallback = false;
      }
    }
    return true;
  });
  openSecretBodyChoice(f.world, 1).commit(3);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  armed = true;
  let outerReceipt: unknown, outerError: unknown;
  try {
    outerReceipt = resolveSecretBodyDamage(f.world, 1, { 3: ["wolf_kill"] });
  } catch (e) {
    outerError = e;
  }
  expect(innerReceipt).toBeUndefined();
  expect(innerError).toBeDefined();
  expect(outerError).toBeUndefined();
  expect(outerReceipt).toEqual({ blocked: { targetId: 3, cause: "wolf_kill" }, sources: {} });
});
test("failed final damage after normal action close can still abort and revoke the paid effect", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 3);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  expect(() =>
    resolveSecretBodyDamage(f.world, 1, { 3: ["hunter_shot"] } as unknown as Parameters<
      typeof resolveSecretBodyDamage
    >[2]),
  ).toThrow("secret_body_sources_invalid");
  expect(() => closeNobleBodyNight(f.world, 1, "aborted")).not.toThrow();
  expect(() => resolveSecretBodyDamage(f.world, 1, { 3: ["poison"] })).toThrow(
    "noble_body_night_unavailable",
  );
  expect(snapshotNobleBodyAuthority(f.world).body.body.kind).toBe("intact");
});

test("normal action closure followed by cancellation before final body damage can close aborted", () => {
  const f = nobleBodyAuthorityFixture();
  let current = true;
  beginNobleBodyNight(f.world, 1, () => current);
  openSecretBodyChoice(f.world, 1).commit(3);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  current = false;
  expect(() => resolveSecretBodyDamage(f.world, 1, { 3: ["wolf_kill"] })).toThrow(
    "noble_body_night_unavailable",
  );
  expect(() => closeNobleBodyNight(f.world, 1, "aborted")).not.toThrow();
  const s = snapshotNobleBodyAuthority(f.world);
  expect(s.nights[0]?.status).toBe("aborted");
  expect(s.body.body.kind).toBe("intact");
  expect(() => beginNobleBodyNight(f.world, 1, () => true)).toThrow();
});
test("pending expiry cannot be silently skipped into N4", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  f.finish(2);
  expect(() => beginNobleBodyNight(f.world, 4, () => true)).toThrow();
});

const pendingN3 = () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, 4, 3);
  f.finish(2);
  beginNobleBodyNight(f.world, 3, () => true);
  openSecretBodyChoice(f.world, 3).commit(null);
  return f;
};
for (const terminal of ["expired", "cleared"] as const)
  test(`N3 occupied window remains unavailable after ${terminal}, no new lease`, () => {
    const f = pendingN3();
    if (terminal === "expired") expireServantAtNightEnd(f.world, 3);
    else clearServantFromHunt(f.world, 3, 3);
    expect(() => openServantChoice(f.world, 3)).toThrow();
  });
test("N3 occupied expiry can close then legitimately choose N4", () => {
  const f = pendingN3();
  expect(expireServantAtNightEnd(f.world, 3)?.targetId).toBe(3);
  closeNobleBodyNight(f.world, 3, "normal");
  expect(resolveSecretBodyDamage(f.world, 3, { 3: ["servant_expiry"] })).toEqual({
    blocked: null,
    sources: { 3: ["servant_expiry"] },
  });
  beginNobleBodyNight(f.world, 4, () => true);
  openSecretBodyChoice(f.world, 4).commit(null);
  expect(openServantChoice(f.world, 4).commit(4)).toEqual({
    actorId: 1,
    day: 4,
    targetId: 4,
    contractId: "servant:night:4",
  });
  expireServantAtNightEnd(f.world, 4);
  closeNobleBodyNight(f.world, 4, "normal");
  resolveSecretBodyDamage(f.world, 4, {});
  expect(
    snapshotNobleBodyAuthority(f.world).noble.contracts.map((c) => [
      c.createdNight,
      c.targetId,
      c.status.kind,
    ]),
  ).toEqual([
    [2, 3, "expired"],
    [4, 4, "pending"],
  ]);
});

test("N2 begin controller cannot consume previous day completed exile resource", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  let receipt: unknown, error: unknown;
  beginNobleBodyNight(f.world, 2, () => {
    try {
      receipt = consumeSecretBodyExile(f.world, 1);
    } catch (e) {
      error = e;
    }
    return true;
  });
  expect(receipt).toBeUndefined();
  expect(error).toBeDefined();
  expect(snapshotNobleBodyAuthority(f.world).body.body).toEqual({ kind: "intact" });
  expect(() => openSecretBodyChoice(f.world, 2).commit(3)).not.toThrow();
});

test("controller cannot steal actual first-death closing receipt", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  let armed = false,
    receipt: unknown,
    error: unknown;
  beginNobleBodyNight(f.world, 2, () => {
    if (armed)
      try {
        receipt = closeServantForDeath(f.world, 2, 3);
      } catch (e) {
        error = e;
      }
    return true;
  });
  openSecretBodyChoice(f.world, 2).commit(null);
  openServantChoice(f.world, 2).commit(3);
  f.life(3).alive = false;
  armed = true;
  expect(clearServantFromHunt(f.world, 2, 4)).toBeNull();
  expect(receipt).toBeUndefined();
  expect(error).toBeDefined();
  expect(snapshotNobleBodyAuthority(f.world).noble.contracts[0]!.status.kind).toBe("pending");
  expect(closeServantForDeath(f.world, 2, 3)).toEqual({
    contractId: "servant:night:2",
    targetId: 3,
  });
  expect(snapshotNobleBodyAuthority(f.world).noble.contracts[0]!.status).toEqual({
    kind: "target_dead",
    day: 2,
  });
});

test("controller cannot abort outer opening and caught denial leaves the outer lease usable", () => {
  const f = nobleBodyAuthorityFixture();
  let armed = false,
    error: unknown;
  beginNobleBodyNight(f.world, 1, () => {
    if (armed)
      try {
        closeNobleBodyNight(f.world, 1, "aborted");
      } catch (e) {
        error = e;
      }
    return true;
  });
  armed = true;
  const lease = openSecretBodyChoice(f.world, 1);
  lease.commit(3);
  expect(error).toBeDefined();
  expect(snapshotNobleBodyAuthority(f.world).nights[0]).toMatchObject({
    status: "open",
    bodyChosen: true,
  });
});

test("controller throw releases validation lock and external abort preserves a submitted choice", () => {
  const f = nobleBodyAuthorityFixture();
  let armed = false;
  beginNobleBodyNight(f.world, 1, () => {
    if (armed) throw Error("original_controller_error");
    return true;
  });
  openSecretBodyChoice(f.world, 1).commit(3);
  armed = true;
  expect(() => clearServantFromHunt(f.world, 1, 4)).toThrow("original_controller_error");
  expect(() => closeNobleBodyNight(f.world, 1, "aborted")).not.toThrow();
  expect(snapshotNobleBodyAuthority(f.world).body).toMatchObject({
    body: { kind: "intact" },
    lastChoice: { day: 1, targetId: 3 },
  });
});

function uninstalled() {
  const source = nobleBodyAuthorityFixture(),
    world = new World();
  for (const id of source.world.entityIds()) {
    expect(world.createEntity()).toBe(id);
    for (const name of [
      COMPONENT.Role,
      COMPONENT.Identity,
      COMPONENT.Camp,
      COMPONENT.Victory,
      COMPONENT.Alive,
    ])
      world.addComponent(id, name, source.world.getComponent(id, name)!);
  }
  return world;
}
test("baseline accepts original own-data surrogate metadata", () => {
  const world = uninstalled();
  installNobleBodyAuthority(world, 1, 2);
  beginNobleBodyNight(world, 1, () => true);
  expect(openSecretBodyChoice(world, 1).commit(3)).toEqual({ actorId: 2, day: 1, targetId: 3 });
});
test("initial missing Identity must not become a permanently valid sentinel binding", () => {
  const world = uninstalled();
  world.removeComponent(2, COMPONENT.Identity);
  expect(() => {
    installNobleBodyAuthority(world, 1, 2);
    beginNobleBodyNight(world, 1, () => true);
    openSecretBodyChoice(world, 1).commit(3);
  }).toThrow();
});
test("initial accessor Identity must not become a valid sentinel binding without reading getter", () => {
  const world = uninstalled(),
    identity = world.getComponent(2, COMPONENT.Identity)!;
  let reads = 0;
  Object.defineProperty(identity, "id", {
    configurable: true,
    enumerable: true,
    get() {
      reads++;
      return 2;
    },
  });
  expect(() => {
    installNobleBodyAuthority(world, 1, 2);
    beginNobleBodyNight(world, 1, () => true);
    openSecretBodyChoice(world, 1).commit(3);
  }).toThrow();
  expect(reads).toBe(0);
});
test("initial accessor Role kind must not become valid sentinel binding without reading getter", () => {
  const world = uninstalled(),
    role = world.getComponent(2, COMPONENT.Role)!;
  let reads = 0;
  Object.defineProperty(role, "role", {
    configurable: true,
    enumerable: true,
    get() {
      reads++;
      return "villager";
    },
  });
  expect(() => {
    installNobleBodyAuthority(world, 1, 2);
    beginNobleBodyNight(world, 1, () => true);
    openSecretBodyChoice(world, 1).commit(3);
  }).toThrow();
  expect(reads).toBe(0);
});

function commit(world: World) {
  installNobleBodyAuthority(world, 1, 2);
  beginNobleBodyNight(world, 1, () => true);
  return openSecretBodyChoice(world, 1).commit(3);
}
for (const [name, affiliations] of [
  ["unknown kind", [{ kind: "not_a_membership", faction: "good" }]],
  ["unknown faction", [{ kind: "faction", faction: "not_a_faction" }]],
  [
    "repeated membership",
    [
      { kind: "faction", faction: "good" },
      { kind: "faction", faction: "good" },
    ],
  ],
] as const)
  test(`initial Victory rejects ${name}`, () => {
    const world = uninstalled();
    // 原畸形成员样本必须原样进入存储；断言仅替代旧 unknown 写入泛型，不补齐或验证它。
    world.addComponent(3, COMPONENT.Victory, { affiliations } as unknown as import("../../../../src/domain/component-map").ComponentWrite<typeof COMPONENT.Victory>);
    expect(() => commit(world)).toThrow();
  });
test("finite noble-body owner rejects empty Victory without changing shared generic membership schema", () => {
  const world = uninstalled();
  world.addComponent(3, COMPONENT.Victory, { affiliations: [] });
  expect(() => commit(world)).toThrow();
});
test("nonactor unknown role kind must not become an original native roster identity", () => {
  const world = uninstalled();
  (world.getComponent(3, COMPONENT.Role) as unknown as Record<string, unknown>).role = "not_a_role";
  expect(() => commit(world)).toThrow();
});
test("nonactor equal invalid Camp values must not establish valid ownership", () => {
  const world = uninstalled();
  // F05b不再给Role副本写阵营；坏实际Camp仍须拒绝，合法角色与状态完整保留。
  (world.getComponent(3, COMPONENT.Camp) as unknown as Record<string, unknown>).camp = "not_a_camp";
  expect(() => commit(world)).toThrow();
});
test("nonactor Camp accessors must fail without executing getters instead of comparing invalid sentinels", () => {
  const world = uninstalled();
  let reads = 0,
    error: unknown;
  for (const name of [COMPONENT.Camp])
    Object.defineProperty(world.getComponent(3, name)!, "camp", {
      enumerable: true,
      configurable: true,
      get() {
        reads++;
        return "good";
      },
    });
  try {
    commit(world);
  } catch (e) {
    error = e;
  }
  expect(reads).toBe(0);
  expect(error).toBeDefined();
});
test("original Identity id must be its actual entity rather than another original player", () => {
  const world = uninstalled();
  (world.getComponent(2, COMPONENT.Identity) as unknown as Record<string, unknown>).id = 3;
  expect(() => commit(world)).toThrow();
});

for (const failure of ["invalid-source", "cancelled", "callback-throw"] as const)
  test(`expiry/choice survive ${failure}; old night cannot consume or mutate N4`, () => {
    const f = nobleBodyAuthorityFixture();
    f.night(1);
    f.finish(1);
    f.night(2, null, 3);
    f.finish(2);
    let mode = "current";
    beginNobleBodyNight(f.world, 3, () => {
      if (mode === "throw") throw Error("controller-ended");
      return mode === "current";
    });
    openSecretBodyChoice(f.world, 3).commit(3);
    expect(expireServantAtNightEnd(f.world, 3)).toEqual({
      contractId: "servant:night:2",
      targetId: 3,
      cause: "servant_expiry",
    });
    closeNobleBodyNight(f.world, 3, "normal");
    mode =
      failure === "cancelled" ? "cancelled" : failure === "callback-throw" ? "throw" : "current";
    const sources =
      failure === "invalid-source" ? { 3: ["unknown_cause"] } : { 3: ["servant_expiry"] };
    expect(() =>
      resolveSecretBodyDamage(
        f.world,
        3,
        sources as unknown as Parameters<typeof resolveSecretBodyDamage>[2],
      ),
    ).toThrow();
    const failed = snapshotNobleBodyAuthority(f.world);
    expect(failed.body).toMatchObject({
      lastChoice: { day: 3, targetId: 3 },
      body: { kind: "intact" },
    });
    expect(failed.noble.contracts).toHaveLength(1);
    expect(failed.noble.contracts[0]).toMatchObject({
      createdNight: 2,
      expiresNight: 3,
      status: { kind: "expired", day: 3 },
    });
    expect(failed.nights.at(-1)).toMatchObject({
      day: 3,
      status: "aborted",
      expiryProcessed: true,
      bodyChosen: true,
      bodyResolved: false,
    });
    expect(() => beginNobleBodyNight(f.world, 3, () => true)).toThrow();
    beginNobleBodyNight(f.world, 4, () => true);
    openSecretBodyChoice(f.world, 4).commit(4);
    openServantChoice(f.world, 4).commit(5);
    const next = snapshotNobleBodyAuthority(f.world);
    expect(() => resolveSecretBodyDamage(f.world, 3, { 3: ["servant_expiry"] })).toThrow();
    expect(() => closeNobleBodyNight(f.world, 3, "aborted")).not.toThrow();
    expect(snapshotNobleBodyAuthority(f.world)).toEqual(next);
    expect(() => beginNobleBodyNight(f.world, 5, () => true)).toThrow();
    expect(expireServantAtNightEnd(f.world, 4)).toBeNull();
    closeNobleBodyNight(f.world, 4, "normal");
    expect(resolveSecretBodyDamage(f.world, 4, { 4: ["poison"] })).toEqual({
      blocked: { targetId: 4, cause: "poison" },
      sources: {},
    });
    expect(snapshotNobleBodyAuthority(f.world).body.body).toEqual({
      kind: "night_spent",
      day: 4,
      targetId: 4,
      cause: "poison",
    });
  });

test("N3 abort before expiry retains original due date and blocks shifting pending effect to N4", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  f.finish(2);
  beginNobleBodyNight(f.world, 3, () => true);
  openSecretBodyChoice(f.world, 3).commit(3);
  closeNobleBodyNight(f.world, 3, "aborted");
  expect(() => beginNobleBodyNight(f.world, 4, () => true)).toThrow("noble_body_night_unavailable");
  const state = snapshotNobleBodyAuthority(f.world);
  expect(state.noble.contracts[0]).toMatchObject({
    createdNight: 2,
    expiresNight: 3,
    status: { kind: "pending" },
  });
  expect(state.body).toMatchObject({
    lastChoice: { day: 3, targetId: 3 },
    body: { kind: "intact" },
  });
  expect(() => expireServantAtNightEnd(f.world, 3)).toThrow("noble_body_night_unavailable");
});

test("caught controller reentry cannot abort outer settlement or consume twice", () => {
  const f = nobleBodyAuthorityFixture();
  let attack = false,
    attempts = 0;
  beginNobleBodyNight(f.world, 1, () => {
    if (attack) {
      attempts++;
      expect(() => resolveSecretBodyDamage(f.world, 1, { 3: ["wolf_kill"] })).toThrow(
        "noble_body_controller_reentry",
      );
      expect(() => closeNobleBodyNight(f.world, 1, "aborted")).toThrow(
        "noble_body_night_unavailable",
      );
      expect(() => beginNobleBodyNight(f.world, 2, () => true)).toThrow("noble_body_owner_revoked");
    }
    return true;
  });
  openSecretBodyChoice(f.world, 1).commit(3);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  attack = true;
  expect(resolveSecretBodyDamage(f.world, 1, { 3: ["poison"] })).toEqual({
    blocked: { targetId: 3, cause: "poison" },
    sources: {},
  });
  expect(attempts).toBe(1);
  const state = snapshotNobleBodyAuthority(f.world);
  expect(state.nights[0]).toMatchObject({ status: "normal", bodyResolved: true });
  expect(state.body.body).toEqual({ kind: "night_spent", day: 1, targetId: 3, cause: "poison" });
});
