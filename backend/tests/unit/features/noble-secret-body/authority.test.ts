/**
 * 单元测试：验证夜贵族独立 authority 与原 owner／frame／reader。输入为内存 fixture、受控回调和畸形修改；原字面值、身份快照和拒绝断言为预期，不执行装配周期、模型或实体传输。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../../src/domain/components/names";

import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { Role, Camp } from "../../../../src/domain/identity";
import { nobleBodyAuthorityFixture } from "../../../support/features/noble-secret-body/drivers/authority";
import {
  beginNobleBodyNight,
  openSecretBodyChoice,
  openServantChoice,
  clearServantFromHunt,
  expireServantAtNightEnd,
  closeServantForDeath,
  resolveSecretBodyDamage,
  closeNobleBodyNight,
  snapshotNobleBodyAuthority,
  consumeSecretBodyExile,
} from "../../../../src/game/mechanisms/roles/noble_secret_body/authority";

test("original contract survives normal noble death, occupies N3, expires once before damage", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, 4, 3);
  f.finish(2);
  f.life(1).alive = false;
  beginNobleBodyNight(f.world, 3, () => true);
  openSecretBodyChoice(f.world, 3).commit(3);
  expect(() => openServantChoice(f.world, 3)).toThrow();
  const expiry = expireServantAtNightEnd(f.world, 3);
  expect(expiry).toEqual({ contractId: "servant:night:2", targetId: 3, cause: "servant_expiry" });
  expect(() => expireServantAtNightEnd(f.world, 3)).toThrow("night_noble_expiry_already_processed");
  closeNobleBodyNight(f.world, 3, "normal");
  const damage = resolveSecretBodyDamage(f.world, 3, { 3: ["servant_expiry"] });
  expect(damage).toEqual({ blocked: { targetId: 3, cause: "servant_expiry" }, sources: {} });
  expect(snapshotNobleBodyAuthority(f.world).noble.contracts[0]!.status).toEqual({
    kind: "expired",
    day: 3,
  });
});
for (const end of ["hunt", "death"] as const)
  test(`N2 ${end} closes old contract so N3 can create a new one`, () => {
    const f = nobleBodyAuthorityFixture();
    f.night(1);
    f.finish(1);
    f.night(2, null, 3);
    if (end === "hunt")
      expect(clearServantFromHunt(f.world, 2, 3)).toEqual({
        contractId: "servant:night:2",
        targetId: 3,
      });
    else {
      f.life(3).alive = false;
      expect(closeServantForDeath(f.world, 2, 3)).toEqual({
        contractId: "servant:night:2",
        targetId: 3,
      });
    }
    f.finish(2);
    f.night(3, null, 4);
    expect(snapshotNobleBodyAuthority(f.world).noble.contracts[1]).toMatchObject({
      createdNight: 3,
      targetId: 4,
      status: { kind: "pending" },
    });
  });
test("expiry followed by abort retains submitted expiry but leaves body unspent", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  f.finish(2);
  beginNobleBodyNight(f.world, 3, () => true);
  openSecretBodyChoice(f.world, 3).commit(3);
  expect(expireServantAtNightEnd(f.world, 3)?.targetId).toBe(3);
  closeNobleBodyNight(f.world, 3, "aborted");
  expect(() => resolveSecretBodyDamage(f.world, 3, { 3: ["servant_expiry"] })).toThrow(
    "noble_body_night_unavailable",
  );
  const state = snapshotNobleBodyAuthority(f.world);
  expect(state.body.body.kind).toBe("intact");
  expect(state.noble.contracts[0]!.status.kind).toBe("expired");
  expect(() => beginNobleBodyNight(f.world, 3, () => true)).toThrow("noble_body_night_unavailable");
});
test("paid body protects one source and never falls back again to itself", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 3);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  expect(
    resolveSecretBodyDamage(f.world, 1, { 3: ["poison", "wolf_kill"], 2: ["servant_expiry"] }),
  ).toEqual({
    blocked: { targetId: 3, cause: "wolf_kill" },
    sources: { 3: ["poison"], 2: ["servant_expiry"] },
  });
  const state = snapshotNobleBodyAuthority(f.world);
  expect(state.body.lastChoice).toEqual({ day: 1, targetId: 3 });
  expect(state.body.body).toEqual({ kind: "night_spent", day: 1, targetId: 3, cause: "wolf_kill" });
  expect(() => resolveSecretBodyDamage(f.world, 1, {})).toThrow(
    "secret_body_damage_already_processed",
  );
  expect(() => consumeSecretBodyExile(f.world, 1)).toThrow("secret_body_unavailable");
});
test("paid original body effect survives its caster's first actual death", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 3);
  f.life(2).alive = false;
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  expect(resolveSecretBodyDamage(f.world, 1, { 3: ["poison"] })).toEqual({
    blocked: { targetId: 3, cause: "poison" },
    sources: {},
  });
});
for (const replace of ["role", "state", "life", "revive"] as const)
  test(`awaiting body choice cannot consume replacement ${replace}`, () => {
    const f = nobleBodyAuthorityFixture();
    beginNobleBodyNight(f.world, 1, () => true);
    const choice = openSecretBodyChoice(f.world, 1);
    if (replace === "role")
      f.world.addComponent(2, COMPONENT.Role, createRoleComponent(Role.Villager));
    if (replace === "state")
      (f.roles[1]!.privateState as Record<string, unknown>).secretBody = structuredClone(
        (f.roles[1]!.privateState as { readonly secretBody?: unknown }).secretBody,
      );
    if (replace === "life") f.world.addComponent(2, COMPONENT.Alive, createAliveComponent());
    if (replace === "revive") {
      f.life(2).alive = false;
      f.life(2).alive = true;
    }
    expect(choice.isCurrent()).toBe(false);
    expect(() => choice.commit(3)).toThrow("secret_body_choice_revoked");
    closeNobleBodyNight(f.world, 1, "aborted");
  });
test("a replaced target life cannot receive pending expiry", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  f.finish(2);
  f.world.addComponent(3, COMPONENT.Alive, createAliveComponent());
  expect(() => beginNobleBodyNight(f.world, 3, () => true)).toThrow("noble_body_owner_revoked");
});
test("normal action closure waits for required steps and next night waits for final damage", () => {
  const f = nobleBodyAuthorityFixture();
  beginNobleBodyNight(f.world, 1, () => true);
  expect(() => closeNobleBodyNight(f.world, 1, "normal")).toThrow("noble_body_night_incomplete");
  openSecretBodyChoice(f.world, 1).commit(null);
  expireServantAtNightEnd(f.world, 1);
  closeNobleBodyNight(f.world, 1, "normal");
  expect(() => beginNobleBodyNight(f.world, 2, () => true)).toThrow("noble_body_night_unavailable");
  resolveSecretBodyDamage(f.world, 1, {});
  expect(() => beginNobleBodyNight(f.world, 2, () => true)).not.toThrow();
  closeNobleBodyNight(f.world, 2, "aborted");
});
test("body damage cannot consume during active action delivery or expose an early exile", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1, 3);
  expect(() => resolveSecretBodyDamage(f.world, 1, { 3: ["poison"] })).toThrow(
    "secret_body_damage_before_action_close",
  );
  expect(() => consumeSecretBodyExile(f.world, 1)).toThrow("secret_body_exile_owner_revoked");
  expect(snapshotNobleBodyAuthority(f.world).body.body.kind).toBe("intact");
  f.finish(1);
  expect(consumeSecretBodyExile(f.world, 1)).toEqual({ actorId: 2, day: 1 });
});
test("clearing an old occupied contract does not reopen its already passed choice window", () => {
  const f = nobleBodyAuthorityFixture();
  f.night(1);
  f.finish(1);
  f.night(2, null, 3);
  f.finish(2);
  beginNobleBodyNight(f.world, 3, () => true);
  openSecretBodyChoice(f.world, 3).commit(null);
  expect(clearServantFromHunt(f.world, 3, 3)?.targetId).toBe(3);
  expect(() => openServantChoice(f.world, 3)).toThrow("night_noble_unavailable");
  f.finish(3);
  f.night(4, null, 4);
  expect(snapshotNobleBodyAuthority(f.world).noble.contracts.at(-1)?.targetId).toBe(4);
});
