/**
 * 负责驱动夜贵族子系统的原 World fixture、有界夜选择、伤害和关闭。输入为脚本步骤、回调与资源请求，输出为原受控轨迹、句柄及边界响应。测试保留字面行动和失败预期；不运行完整对局或传输，也不引入付费模型。
 */
import { createAliveComponent, createCampComponent } from "../../../../../src/agents/observation/component-presentation";
import { World } from "../../../../../src/domain/world";
import { COMPONENT } from "../../../../../src/domain/components/names";
import { Role, Camp } from "../../../../../src/domain/identity";
import { createRoleComponent } from "../../../../../src/agents/observation/role-presentation";
import { type AliveComponent } from "../../../../../src/domain/components/alive";

import { createVictoryComponent } from "../../../../../src/domain/components/victory";
import { createIdentityComponent } from "../../../../../src/domain/entities/player";
import {
  createNobleState,
  createSecretBodyState,
} from "../../../../../src/features/noble-secret-body/state";
import {
  installNobleBodyAuthority,
  beginNobleBodyNight,
  openSecretBodyChoice,
  openServantChoice,
  expireServantAtNightEnd,
  resolveSecretBodyDamage,
  closeNobleBodyNight,
} from "../../../../../src/features/noble-secret-body/authority";
/** 显式子系统夹具：既有替身身份验证原对象所有权与实际 Camp 槽；不注册额外角色或冒整局规则验收。 */
export function nobleBodyAuthorityFixture() {
  const world = new World(),
    roles = [];
  for (let id = 1; id <= 6; id++) {
    const actual = world.createEntity(),
      camp = id === 1 ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(id === 1 ? Role.Wolf : Role.Villager);
    if (id === 1) (role.privateState as Record<string, unknown>).noble = createNobleState();
    if (id === 2)
      (role.privateState as Record<string, unknown>).secretBody = createSecretBodyState();
    world.addComponent(actual, COMPONENT.Role, role);
    world.addComponent(
      actual,
      COMPONENT.Identity,
      createIdentityComponent(actual, actual, `Synthetic ${actual}`),
    );
    world.addComponent(actual, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(
      actual,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
    world.addComponent(actual, COMPONENT.Alive, createAliveComponent());
    roles.push(role);
  }
  installNobleBodyAuthority(world, 1, 2);
  const life = (id: number) => world.getComponent(id, COMPONENT.Alive)!;
  const finish = (day: number) => {
    expireServantAtNightEnd(world, day);
    closeNobleBodyNight(world, day, "normal");
    return resolveSecretBodyDamage(world, day, {});
  };
  const night = (
    day: number,
    bodyTarget: number | null = null,
    nobleTarget: number | null = null,
  ) => {
    beginNobleBodyNight(world, day, () => true);
    openSecretBodyChoice(world, day).commit(bodyTarget);
    if (day >= 2) openServantChoice(world, day).commit(nobleTarget);
  };
  return { world, roles, life, finish, night };
}
