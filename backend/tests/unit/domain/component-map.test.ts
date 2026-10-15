/**
 * 单元测试：验证 World 类型槽与原引用／生命所有权。输入为十一种组件名、原对象和死亡许可修订，字面顺序、对象身份及版本为预期；编译正反例检查统一槽推断与旧任意泛型拒绝，不更改角色规则、传输或序列化句柄。
 */
import { createAliveComponent, createCampComponent } from "../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { COMPONENT, Camp, Phase, Role, World, aliveLifeVersion, createIdentityComponent, type AliveComponent, type CampComponent, type ComponentMap, type ComponentName, type RoleComponent } from "../../../src/domain";
import { createRoleComponent } from "../../../src/agents/observation/role-presentation";

function compilerExamples(world: World, actorId: number) {
  const alive = createAliveComponent(),
    camp = createCampComponent(Camp.Good),
    role = createRoleComponent(Role.Villager);
  world.addComponent(actorId, COMPONENT.Alive, alive);
  world.addComponent(actorId, COMPONENT.Camp, { ...camp, customExtra: { original: true } });
  world.addComponent(actorId, COMPONENT.Role, { ...role, customExtra: "unchanged width" });
  const inferred: AliveComponent | undefined = world.getComponent(actorId, COMPONENT.Alive);
  if (inferred) {
    const aliveFlag: boolean = inferred.alive;
    // @ts-expect-error Alive 槽不携带角色私有容器。
    inferred.privateState;
    void aliveFlag;
  }
  // @ts-expect-error 错误槽不能从值反向推断出任意组件类型。
  world.addComponent(actorId, COMPONENT.Alive, camp);
  // @ts-expect-error Camp 不能满足 Role 的完整组件结构。
  world.addComponent(actorId, COMPONENT.Role, camp);
  // @ts-expect-error Role 的独有字段不能装入 Camp 槽。
  world.addComponent(actorId, COMPONENT.Camp, role);
  // @ts-expect-error 缺少必需字段不能退回任意类型重载。
  world.addComponent(actorId, COMPONENT.Role, { role: Role.Wolf });
  // @ts-expect-error 接收变量的类型不能把 Alive 槽改成 Camp。
  const wrong: CampComponent | undefined = world.getComponent(actorId, COMPONENT.Alive);
  const unionName: typeof COMPONENT.Role | typeof COMPONENT.Camp =
    actorId > 1 ? COMPONENT.Role : COMPONENT.Camp;
  // @ts-expect-error 值推断不能把具名槽联合扩成 Alive 槽。
  world.addComponent(actorId, unionName, alive);
  // @ts-expect-error 实体 ID 仍是数字，任意实体参数不能进入槽。
  world.addComponent("actor", COMPONENT.Alive, alive);
  // @ts-expect-error 未知来源对象不能成为实体 ID。
  world.getComponent({ actorId }, COMPONENT.Role);
  // @ts-expect-error 机器槽名仍是闭合的十一种名称。
  world.getComponent(actorId, "ForeignComponent");
  // @ts-expect-error 旧调用方任意 RoleComponent 泛型不再能覆盖 Camp 槽。
  const legacy: RoleComponent | undefined = world.getComponent<RoleComponent>(
    actorId,
    COMPONENT.Camp,
  );
  // @ts-expect-error 旧单一任意组件泛型不能绕过具名槽写入约束。
  world.addComponent<RoleComponent>(actorId, COMPONENT.Camp, role);
  type SameKeys = keyof ComponentMap extends ComponentName
    ? ComponentName extends keyof ComponentMap
      ? true
      : false
    : false;
  const closedMap: SameKeys = true;
  void [wrong, legacy, closedMap];
}
void compilerExamples;

test("eleven existing slot IDs and inferred reads preserve mutable original references", () => {
  expect(Object.values(COMPONENT)).toEqual([
    "IdentityComponent",
    "RoleComponent",
    "CampComponent",
    "AliveComponent",
    "VotingRightComponent",
    "StatusMarksComponent",
    "BadgeComponent",
    "VictoryComponent",
    "LoversComponent",
    "WallNoteComponent",
    "DebatePenaltyComponent",
  ]);
  expect(Object.isFrozen(COMPONENT)).toBe(false);
  const world = new World(),
    actorId = world.createEntity(),
    identity = createIdentityComponent(actorId, 1, "Raw {player} name"),
    role = createRoleComponent(Role.Villager),
    camp = createCampComponent(Camp.Good);
  expect(world.getComponent(actorId, COMPONENT.Identity)).toBeUndefined();
  world.addComponent(actorId, COMPONENT.Identity, identity);
  world.addComponent(actorId, COMPONENT.Role, role);
  world.addComponent(actorId, COMPONENT.Camp, camp);
  expect(world.getComponent(actorId, COMPONENT.Identity)).toBe(identity);
  expect(world.getComponent(actorId, COMPONENT.Role)).toBe(role);
  expect(world.getComponent(actorId, COMPONENT.Camp)).toBe(camp);
  world.getComponent(actorId, COMPONENT.Identity)!.name = "Untranslated name";
  expect(identity.name).toBe("Untranslated name");
  world.removeComponent(actorId, COMPONENT.Identity);
  expect(world.getComponent(actorId, COMPONENT.Identity)).toBeUndefined();
  expect(world.hasEntity(actorId)).toBe(true);
});

test("typed Alive reads retain original factory life revisions and death-permission retirement", () => {
  const world = new World(),
    actorId = world.createEntity(),
    life = createAliveComponent(false);
  world.addComponent(actorId, COMPONENT.Role, createRoleComponent(Role.Hunter));
  world.addComponent(actorId, COMPONENT.Alive, life);
  const original = world.openDeathAction(actorId, "shoot", Phase.Day, 1);
  expect(world.getComponent(actorId, COMPONENT.Alive)).toBe(life);
  expect(world.hasDeathAction(actorId, "shoot", Phase.Day, 1, original.id)).toBe(true);
  world.getComponent(actorId, COMPONENT.Alive)!.alive = true;
  world.getComponent(actorId, COMPONENT.Alive)!.alive = false;
  expect(aliveLifeVersion(life)).toBe(2);
  expect(world.hasDeathAction(actorId, "shoot", Phase.Day, 1, original.id)).toBe(false);
  const later = world.openDeathAction(actorId, "shoot", Phase.Day, 1);
  original.close();
  expect(world.hasDeathAction(actorId, "shoot", Phase.Day, 1, later.id)).toBe(true);
  const replacement = createAliveComponent(false);
  world.addComponent(actorId, COMPONENT.Alive, replacement);
  expect(world.getComponent(actorId, COMPONENT.Alive)).toBe(replacement);
  expect(aliveLifeVersion(replacement)).toBe(0);
  expect(world.hasDeathAction(actorId, "shoot", Phase.Day, 1, later.id)).toBe(false);
  expect(world.activeDeathActionCount).toBe(0);
});

test("typed signatures leave original invalid-locale and missing-entity errors intact", () => {
  // 此处非法运行输入是原测试样本，工厂仍保留原校验。
  expect(() => new World("unsupported" as "en")).toThrow("game_locale_invalid");
  const world = new World();
  expect(() => world.addComponent(99, COMPONENT.Alive, createAliveComponent())).toThrow(
    "Entity 99 does not exist",
  );
  expect(world.getComponent(99, COMPONENT.Alive)).toBeUndefined();
});
