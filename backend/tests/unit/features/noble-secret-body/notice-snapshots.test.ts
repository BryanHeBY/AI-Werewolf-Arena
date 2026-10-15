/**
 * 单元测试验证 noble-secret-body 的独立 notice-snapshots.test 契约。输入为既有内存 fixture、原回调控制和明确非法
 * 修改；原字面预期、身份快照及拒绝断言是预期，不在迁移中重新生成。仅调用原生内存
 * owner／frame／reader，测试自有 mock／组件不运行完整对局、模型或真实传输，support／fixture 字节及政策状态不变。
 */
import { createAliveComponent } from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { Phase } from "../../../../src/domain/identity";
import { COMPONENT } from "../../../../src/domain/components/names";

import { nobleBodyAuthorityFixture } from "../../../support/features/noble-secret-body/drivers/authority";
import {
  beginNobleBodyNight,
  openSecretBodyChoice,
  openServantChoice,
  clearServantFromHunt,
  closeServantForDeath,
  expireServantAtNightEnd,
  resolveSecretBodyDamage,
  closeNobleBodyNight,
  consumeSecretBodyExile,
  getNobleBodyPlayerState,
  snapshotNobleBodyAuthority,
} from "../../../../src/features/noble-secret-body/authority";
// Read-only R/A/T cases preserved with their original inputs.
const dto = (f: ReturnType<typeof nobleBodyAuthorityFixture>, id: number, p = Phase.Day) =>
  getNobleBodyPlayerState(f.world, id, p);

test("spent Body and occupied Noble both receive notices in an entirely requestless N3; expiry remains delayed to N4", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 4);
  f.finish(1);
  f.night(2, 3, 5);
  expireServantAtNightEnd(f.world, 2);
  closeNobleBodyNight(f.world, 2, "normal");
  resolveSecretBodyDamage(f.world, 2, { 3: ["wolf_kill"] });
  const n3 = beginNobleBodyNight(f.world, 3, () => true);
  expect(n3.map((n) => [n.kind, n.actorId, n.day])).toEqual([
    ["night_noble", 1, 3],
    ["secret_body", 2, 3],
  ]);
  expect(dto(f, 2, Phase.Night)?.state).toMatchObject({ resource: "spent", lastNotifiedNight: 3 });
  expect(() => openSecretBodyChoice(f.world, 3)).toThrow("secret_body_unavailable");
  expect(() => openServantChoice(f.world, 3)).toThrow("night_noble_unavailable");
  const before = JSON.stringify(dto(f, 1));
  expect(expireServantAtNightEnd(f.world, 3)?.targetId).toBe(5);
  closeNobleBodyNight(f.world, 3, "normal");
  resolveSecretBodyDamage(f.world, 3, { 5: ["servant_expiry"] });
  expect(JSON.stringify(dto(f, 1))).toBe(before);
  const n4 = beginNobleBodyNight(f.world, 4, () => true);
  expect(n4.find((n) => n.kind === "night_noble")?.known).toMatchObject({
    contracts: [{ status: { kind: "expired", day: 3 } }],
  });
  expect(n4.find((n) => n.kind === "secret_body")?.known).toMatchObject({ resource: "spent" });
  expect(n3.find((n) => n.kind === "night_noble")?.known).toMatchObject({
    contracts: [{ status: { kind: "pending" } }],
  });
});

test("day target death stays hidden from Noble until N3 and old returned receipt is a frozen snapshot", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  const n2 = beginNobleBodyNight(f.world, 2, () => true);
  openSecretBodyChoice(f.world, 2).commit(null);
  openServantChoice(f.world, 2).commit(3);
  f.finish(2);
  const before = dto(f, 1);
  f.life(3).alive = false;
  expect(closeServantForDeath(f.world, 2, 3)).toEqual({
    contractId: "servant:night:2",
    targetId: 3,
  });
  expect(dto(f, 1)).toEqual(before);
  expect(n2.find((n) => n.kind === "night_noble")?.known).toMatchObject({
    contracts: [],
    lastChoice: null,
  });
  const n3 = beginNobleBodyNight(f.world, 3, () => true);
  const notice = n3.find((n) => n.kind === "night_noble")!;
  expect(notice.known).toMatchObject({ contracts: [{ status: { kind: "target_dead", day: 2 } }] });
  expect(Object.isFrozen(n3)).toBe(true);
  expect(Object.isFrozen(notice)).toBe(true);
  expect(Object.isFrozen(notice.known)).toBe(true);
  if (notice.kind === "night_noble") {
    expect(Reflect.set(notice.known.contracts[0]!.status, "kind", "pending")).toBe(false);
  }
  openServantChoice(f.world, 3).commit(4);
  expect(notice.known).toMatchObject({
    lastChoice: { day: 2, targetId: 3 },
    contracts: [{ status: { kind: "target_dead", day: 2 } }],
  });
  expect(dto(f, 1, Phase.Night)?.state).toMatchObject({
    lastChoice: { day: 3, targetId: 4 },
    contracts: [
      { status: { kind: "target_dead", day: 2 } },
      { targetId: 4, status: { kind: "pending" } },
    ],
  });
});

test("original actor death freezes last-known information instead of publishing terminal details", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, 4, 3);
  clearServantFromHunt(f.world, 2, 3);
  expireServantAtNightEnd(f.world, 2);
  closeNobleBodyNight(f.world, 2, "normal");
  resolveSecretBodyDamage(f.world, 2, { 4: ["poison"] });
  const before = snapshotNobleBodyAuthority(f.world).knowledge;
  f.life(1).alive = false;
  f.life(2).alive = false;
  expect(beginNobleBodyNight(f.world, 3, () => true)).toEqual([]);
  expect(snapshotNobleBodyAuthority(f.world).knowledge).toEqual(before);
  expect(dto(f, 2, Phase.Night)?.state).toMatchObject({ resource: "intact", lastNotifiedNight: 2 });
  expect(dto(f, 1, Phase.Night)?.state).toMatchObject({
    lastNotifiedNight: 2,
    contracts: [{ status: { kind: "pending" } }],
  });
});

test("different real blocking targets stay indistinguishable in both day and next-night notification", () => {
  const chosen = nobleBodyAuthorityFixture(),
    fallback = nobleBodyAuthorityFixture();
  for (const f of [chosen, fallback]) {
    f.night(1, 3);
    expireServantAtNightEnd(f.world, 1);
    closeNobleBodyNight(f.world, 1, "normal");
  }
  resolveSecretBodyDamage(chosen.world, 1, { 3: ["wolf_kill"] });
  resolveSecretBodyDamage(fallback.world, 1, { 2: ["poison"] });
  expect(snapshotNobleBodyAuthority(chosen.world).body.body).not.toEqual(
    snapshotNobleBodyAuthority(fallback.world).body.body,
  );
  expect(dto(chosen, 2)).toEqual(dto(fallback, 2));
  const a = beginNobleBodyNight(chosen.world, 2, () => true),
    b = beginNobleBodyNight(fallback.world, 2, () => true);
  expect(a.find((n) => n.kind === "secret_body")).toEqual(b.find((n) => n.kind === "secret_body"));
  expect(dto(chosen, 2, Phase.Night)).toEqual(dto(fallback, 2, Phase.Night));
});

test("successful begin notification survives later abort; failed next begin neither advances knowledge nor republishes", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 3);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  resolveSecretBodyDamage(f.world, 1, { 3: ["wolf_kill"] });
  const n2 = beginNobleBodyNight(f.world, 2, () => true);
  closeNobleBodyNight(f.world, 2, "aborted");
  const before = snapshotNobleBodyAuthority(f.world);
  expect(dto(f, 2, Phase.Night)?.state).toMatchObject({ resource: "spent", lastNotifiedNight: 2 });
  expect(() => beginNobleBodyNight(f.world, 3, () => false)).toThrow();
  expect(snapshotNobleBodyAuthority(f.world)).toEqual(before);
  expect(n2.find((n) => n.kind === "secret_body")?.known).toMatchObject({
    resource: "spent",
    lastNotifiedNight: 2,
  });
});

test("public exile updates knowledge immediately, survives later failed begin, with no actual death", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 3);
  f.finish(1);
  const prior = snapshotNobleBodyAuthority(f.world).notices;
  consumeSecretBodyExile(f.world, 1);
  expect(dto(f, 2)).toMatchObject({
    state: {
      resource: "exile_revealed",
      publicRevealDay: 1,
      awaitingNightReport: false,
      lastChoice: { day: 1, targetId: 3 },
    },
  });
  expect(f.life(2).alive).toBe(true);
  expect(snapshotNobleBodyAuthority(f.world).notices).toEqual(prior);
  expect(() => beginNobleBodyNight(f.world, 2, () => false)).toThrow();
  expect(dto(f, 2)).toMatchObject({ state: { resource: "exile_revealed", publicRevealDay: 1 } });
  const n2 = beginNobleBodyNight(f.world, 2, () => true);
  expect(n2.find((n) => n.kind === "secret_body")?.known).toMatchObject({
    resource: "exile_revealed",
    publicRevealDay: 1,
    lastNotifiedNight: 2,
  });
  expect(() => openSecretBodyChoice(f.world, 2)).toThrow("secret_body_unavailable");
});

test("begin receipts are recursively frozen and earlier receipts do not acquire later choices", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  const receipts = beginNobleBodyNight(f.world, 2, () => true),
    historical = JSON.stringify(receipts);
  const frozen = (v: unknown): void => {
    if (v && typeof v === "object") {
      expect(Object.isFrozen(v)).toBe(true);
      for (const x of Object.values(v)) frozen(x);
    }
  };
  frozen(receipts);
  openSecretBodyChoice(f.world, 2).commit(4);
  openServantChoice(f.world, 2).commit(3);
  expect(JSON.stringify(receipts)).toBe(historical);
  expect(getNobleBodyPlayerState(f.world, 1, Phase.Night)?.state.lastChoice).toEqual({
    day: 2,
    targetId: 3,
  });
});

test("God snapshot mutation has no alias to actual state, known state, notices, or night flags", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  const before = snapshotNobleBodyAuthority(f.world),
    expected = JSON.stringify(before);
  before.noble.contracts[0]!.status = { kind: "expired", day: 3 };
  before.body.body = { kind: "exile_revealed", day: 2 };
  before.notices[0]!.actorId = 123;
  before.notices.length = 0;
  before.nights[1]!.status = "aborted";
  expect(Reflect.set(before.knowledge.noble.contracts[0]!.status, "kind", "cleared")).toBe(false);
  expect(JSON.stringify(snapshotNobleBodyAuthority(f.world))).toBe(expected);
});

for (const mode of ["false", "throw", "reentrant-false"] as const)
  test(`failed begin ${mode} publishes neither known snapshot nor notices`, () => {
    const f = nobleBodyAuthorityFixture(),
      before = snapshotNobleBodyAuthority(f.world);
    let inner: unknown;
    expect(() =>
      beginNobleBodyNight(f.world, 1, () => {
        if (mode === "reentrant-false")
          try {
            beginNobleBodyNight(f.world, 1, () => true);
          } catch (e) {
            inner = e;
          }
        if (mode === "throw") throw Error("controller_original");
        return false;
      }),
    ).toThrow();
    if (mode === "reentrant-false") expect(inner).toBeDefined();
    expect(snapshotNobleBodyAuthority(f.world)).toEqual(before);
  });

test("read boundary also rejects controller reentry and successful outer begin produces one notice per living owner", () => {
  const f = nobleBodyAuthorityFixture();
  let inner: unknown, value: unknown;
  const receipts = beginNobleBodyNight(f.world, 1, () => {
    try {
      value = getNobleBodyPlayerState(f.world, 2, Phase.Night);
    } catch (e) {
      inner = e;
    }
    return true;
  });
  expect(value).toBeUndefined();
  expect(inner).toBeDefined();
  expect(receipts.map((x) => x.actorId)).toEqual([1, 2]);
  expect(snapshotNobleBodyAuthority(f.world).notices).toHaveLength(2);
});

test("revoked original state cannot start a night or silently advance notification history", () => {
  const f = nobleBodyAuthorityFixture(),
    original = (f.roles[1]!.privateState as { readonly secretBody?: unknown }).secretBody;
  (f.roles[1]!.privateState as Record<string, unknown>).secretBody = structuredClone(original);
  expect(() => beginNobleBodyNight(f.world, 1, () => true)).toThrow("noble_body_owner_revoked");
  expect(() => getNobleBodyPlayerState(f.world, 2, Phase.Day)).toThrow("noble_body_owner_revoked");
  (f.roles[1]!.privateState as Record<string, unknown>).secretBody = original;
  expect(snapshotNobleBodyAuthority(f.world).notices).toEqual([]);
  expect(snapshotNobleBodyAuthority(f.world).knowledge.body.lastNotifiedNight).toBe(0);
});

for (const alteration of ["replacement", "revive", "identity"] as const)
  test(`player known-state read cannot bypass ${alteration} ownership revocation`, () => {
    const f = nobleBodyAuthorityFixture();
    f.night(1);
    f.finish(1);
    if (alteration === "replacement")
      f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
    if (alteration === "revive") {
      f.life(2).alive = false;
      f.life(2).alive = true;
    }
    // fixture 已安装原 Identity；非空说明只恢复其类型，替换时仍按原 spread 读取。
    if (alteration === "identity")
      f.world.addComponent(2, COMPONENT.Identity, {
        ...f.world.getComponent(2, COMPONENT.Identity)!,
      });
    expect(() => getNobleBodyPlayerState(f.world, 2, Phase.Day)).toThrow(
      "noble_body_owner_revoked",
    );
  });

test("raw block source differences and aborted damage never update daytime player-known resource", () => {
  const worlds = [
    nobleBodyAuthorityFixture(),
    nobleBodyAuthorityFixture(),
    nobleBodyAuthorityFixture(),
  ];
  for (const f of worlds) {
    f.night(1, 3);
    expireServantAtNightEnd(f.world, 1);
    closeNobleBodyNight(f.world, 1, "normal");
  }
  resolveSecretBodyDamage(worlds[0]!.world, 1, { 3: ["poison"] });
  resolveSecretBodyDamage(worlds[1]!.world, 1, { 3: ["wolf_kill"] });
  expect(() =>
    resolveSecretBodyDamage(worlds[2]!.world, 1, { 3: ["invalid"] } as unknown as Parameters<
      typeof resolveSecretBodyDamage
    >[2]),
  ).toThrow();
  const a = getNobleBodyPlayerState(worlds[0]!.world, 2, Phase.Day);
  for (const f of worlds) expect(getNobleBodyPlayerState(f.world, 2, Phase.Day)).toEqual(a);
  expect(JSON.stringify(a)).not.toMatch(/poison|wolf_kill|night_spent|cause/);
});

test("cleared actual contract and God state stay independent of delayed known and historical notices", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  const before = getNobleBodyPlayerState(f.world, 1, Phase.Day),
    receipts = JSON.stringify(snapshotNobleBodyAuthority(f.world).notices);
  clearServantFromHunt(f.world, 2, 3);
  expect(getNobleBodyPlayerState(f.world, 1, Phase.Day)).toEqual(before);
  expect(snapshotNobleBodyAuthority(f.world).noble.contracts[0]!.status).toEqual({
    kind: "cleared",
    day: 2,
  });
  expect(JSON.stringify(snapshotNobleBodyAuthority(f.world).notices)).toBe(receipts);
  f.finish(2);
  f.life(1).alive = false;
  expect(beginNobleBodyNight(f.world, 3, () => true).map((n) => n.actorId)).toEqual([2]);
  expect(getNobleBodyPlayerState(f.world, 1, Phase.Day)).toEqual(before);
});

function settleDamage(
  target: number,
  cause: "wolf_kill" | "poison" | "demon_hunt" | "demon_hunt_backlash" | "servant_expiry",
) {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 3);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  resolveSecretBodyDamage(f.world, 1, { [target]: [cause] });
  return f;
}
test("known body is indistinguishable for chosen-target versus self-fallback and every source", () => {
  const expected = {
    kind: "secret_body",
    state: {
      protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
      lastNotifiedNight: 2,
      resource: "spent",
      publicRevealDay: null,
      lastChoice: { day: 1, targetId: 3 },
      awaitingNightReport: false,
    },
  } as const;
  for (const target of [2, 3])
    for (const cause of [
      "wolf_kill",
      "poison",
      "demon_hunt",
      "demon_hunt_backlash",
      "servant_expiry",
    ] as const) {
      const f = settleDamage(target, cause);
      expect(snapshotNobleBodyAuthority(f.world).body.body).toEqual({
        kind: "night_spent",
        day: 1,
        targetId: target,
        cause,
      });
      expect(getNobleBodyPlayerState(f.world, 2, Phase.Day)).toMatchObject({
        state: { resource: "intact" },
      });
      beginNobleBodyNight(f.world, 2, () => true);
      expect(getNobleBodyPlayerState(f.world, 2, Phase.Night)).toEqual(expected);
    }
});
test("D2 real target death is hidden until N3 and publishes only permitted terminal contract", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  f.finish(2);
  const before = getNobleBodyPlayerState(f.world, 1, Phase.Day);
  f.life(3).alive = false;
  closeServantForDeath(f.world, 2, 3);
  expect(snapshotNobleBodyAuthority(f.world).noble.contracts[0]?.status).toEqual({
    kind: "target_dead",
    day: 2,
  });
  expect(getNobleBodyPlayerState(f.world, 1, Phase.Day)).toEqual(before);
  const receipts = beginNobleBodyNight(f.world, 3, () => true);
  expect(receipts.find((n) => n.kind === "night_noble")?.known).toEqual({
    wolfActionPolicy: "standard",
    lastNotifiedNight: 3,
    lastChoice: { day: 2, targetId: 3 },
    contracts: [
      {
        id: "servant:night:2",
        targetId: 3,
        createdNight: 2,
        expiresNight: 3,
        status: { kind: "target_dead", day: 2 },
      },
    ],
  });
  expect(() => openServantChoice(f.world, 3).commit(4)).not.toThrow();
  expect(getNobleBodyPlayerState(f.world, 1, Phase.Night)?.state.lastChoice).toEqual({
    day: 3,
    targetId: 4,
  });
});
test("dead spent body receives neither new notice nor a silent known-state update", () => {
  const f = settleDamage(3, "poison");
  const before = snapshotNobleBodyAuthority(f.world).knowledge.body;
  f.life(2).alive = false;
  const receipts = beginNobleBodyNight(f.world, 2, () => true);
  expect(receipts.map((n) => n.actorId)).toEqual([1]);
  expect(snapshotNobleBodyAuthority(f.world).knowledge.body).toEqual(before);
  expect(getNobleBodyPlayerState(f.world, 2, Phase.Night)).toMatchObject({
    state: { resource: "intact" },
  });
});
test("receipt is deeply immutable; mutable audit envelopes and JSON roundtrip cannot modify owner", () => {
  const f = nobleBodyAuthorityFixture();
  const receipts = beginNobleBodyNight(f.world, 1, () => true);
  expect(Object.isFrozen(receipts)).toBe(true);
  expect(Object.isFrozen(receipts[0])).toBe(true);
  expect(Object.isFrozen(receipts[0]!.known)).toBe(true);
  const audit = snapshotNobleBodyAuthority(f.world),
    saved = JSON.stringify(audit);
  audit.notices[0]!.actorId = 999;
  const json = JSON.parse(saved);
  json.knowledge.body.resource = "spent";
  json.notices[0].known.lastNotifiedNight = 99;
  expect(JSON.stringify(snapshotNobleBodyAuthority(f.world))).toBe(saved);
  openSecretBodyChoice(f.world, 1).commit(3);
  f.finish(1);
  beginNobleBodyNight(f.world, 2, () => true);
  expect(receipts[1]!.known).toEqual({
    protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
    lastNotifiedNight: 1,
    resource: "intact",
    publicRevealDay: null,
    lastChoice: null,
  });
});
test("throwing begin callback leaves notification and knowledge at factory snapshot", () => {
  const f = nobleBodyAuthorityFixture(),
    before = snapshotNobleBodyAuthority(f.world);
  expect(() =>
    beginNobleBodyNight(f.world, 1, () => {
      throw Error("test-callback-stop");
    }),
  ).toThrow("test-callback-stop");
  expect(snapshotNobleBodyAuthority(f.world)).toEqual(before);
  expect(beginNobleBodyNight(f.world, 1, () => true)).toHaveLength(2);
});
