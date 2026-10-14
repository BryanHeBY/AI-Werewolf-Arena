/**
 * 单元测试：负责验证赠枪公开入口与唯一生命周期 owner 共享原实例及授权账本。
 * 输入为字面角色／生命、实际授予／武装／转移命令和故障事件数组；输出以独立引用、
 * 枪权、事件顺序及已付失败前缀验收。首次死亡后收尾，复活不能刷新旧原体权限。
 * 不执行完整死亡波、模型、传输或文件录制，也不使用生产规则生成预期。
 */
import { createAliveComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { Camp, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";

import * as publicGun from "../../../../src/game/mechanisms/roles/death_abilities";
import * as owner from "../../../../src/game/mechanisms/roles/death-gun-lifecycle";
import { projectDeathGun } from "../../../../src/game/mechanisms/roles/player_state";

function fixture() {
  const world = new World("en"),
    ids = Array.from({ length: 3 }, () => world.createEntity());
  for (const id of ids) {
    world.addComponent(id, COMPONENT.Role, createRoleComponent(Role.Villager));
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  return {
    world,
    donor: ids[0]!,
    recipient: ids[1]!,
    destination: ids[2]!,
    events: [] as GameEvent[],
  };
}

test("public functions retain the actual lifecycle references and both entries authorize the same gun", () => {
  const f = fixture();
  expect(publicGun.grantDeathGun).toBe(owner.grantDeathGun);
  expect(publicGun.armDeathGun).toBe(owner.armDeathGun);
  expect(publicGun.transferDeathGun).toBe(owner.transferDeathGun);
  expect(publicGun.projectDeathGun).toBe(projectDeathGun);
  const gun = owner.grantDeathGun(f.world, f.donor, f.recipient, 1, f.events);
  publicGun.armDeathGun(f.world, f.recipient, gun, 2, f.events);
  expect(owner.activeDeathGun(f.world, f.recipient, gun.id, 2)).toBe(gun);
  const received = publicGun.transferDeathGun(
    f.world,
    f.recipient,
    f.destination,
    gun.id,
    f.events,
  );
  expect(received).not.toBe(gun);
  expect(owner.deathGunOwnerCurrent(f.world, f.recipient, gun)).toBe(false);
  expect(owner.activeDeathGun(f.world, f.destination, gun.id, 2)).toBe(received);
  expect(received.source).toEqual({ kind: "transfer", actorId: f.recipient, abilityId: gun.id });
  expect(
    f.events.filter((e) => e.type === "death_ability_changed").map((e) => e.payload.operation),
  ).toEqual(["granted", "armed", "transferred_out", "granted"]);
});

test("transfer publication failure leaves the original installed, retired and ownership prefix committed", () => {
  const f = fixture(),
    gun = publicGun.grantDeathGun(f.world, f.donor, f.recipient, 1, f.events);
  publicGun.armDeathGun(f.world, f.recipient, gun, 2, f.events);
  const failure = new Error("original_transfer_publication_failure");
  const events: GameEvent[] = [];
  Object.defineProperty(events, "push", {
    value(...rows: GameEvent[]) {
      if (
        rows.some(
          (e) => e.type === "death_ability_changed" && e.payload.operation === "transferred_out",
        )
      )
        throw failure;
      return Array.prototype.push.apply(events, rows);
    },
  });
  expect(() => owner.transferDeathGun(f.world, f.recipient, f.destination, gun.id, events)).toThrow(
    failure,
  );
  expect(owner.allDeathGuns(f.world.getComponent(f.recipient, COMPONENT.Role))).toEqual([]);
  const received = owner.findDeathGun(f.world.getComponent(f.destination, COMPONENT.Role), gun.id)!;
  expect(received).not.toBe(gun);
  expect(received.remaining).toBe(1);
  expect(received.armedOnNight).toBe(2);
  expect(owner.deathGunOwnerCurrent(f.world, f.destination, received)).toBe(true);
  expect(owner.deathGunOwnerCurrent(f.world, f.recipient, gun)).toBe(false);
  expect(
    (
      f.world.getComponent(f.recipient, COMPONENT.Role)!.privateState as {
        retiredDeathAbilityIds: string[];
      }
    ).retiredDeathAbilityIds,
  ).toEqual([gun.id]);
  expect(events).toEqual([]);
});

test("first-death rows retain armed authority until expiry and revival cannot reactivate the captured body", () => {
  const f = fixture(),
    gun = owner.grantDeathGun(f.world, f.donor, f.recipient, 1, f.events);
  owner.armDeathGun(f.world, f.recipient, gun, 2, f.events);
  const life = f.world.getComponent(f.recipient, COMPONENT.Alive)!;
  life.alive = false;
  const rows = publicGun.firstDeathGuns(f.world, f.recipient);
  expect(rows[0]!.gun).toBe(gun);
  expect(owner.captureDeathGun(f.world, f.recipient, gun, 2, () => true).isEligible()).toBe(true);
  publicGun.finishDeathGuns(rows, f.events);
  expect(gun.remaining).toBe(0);
  expect(gun.disabled).toBe(true);
  expect(gun.deathExpired).toBe(true);
  life.alive = true;
  expect(owner.deathGunOwnerCurrent(f.world, f.recipient, gun)).toBe(false);
  expect(publicGun.activeDeathGun(f.world, f.recipient, gun.id, 2)).toBeUndefined();
  expect(
    f.events.filter((e) => e.type === "death_ability_changed").map((e) => e.payload.operation),
  ).toEqual(["granted", "armed", "disabled"]);
});
