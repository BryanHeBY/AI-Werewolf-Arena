/** 只刻画已安装目标的发表失败：执行一次真实转移，核两原库存引用与day2活跃查询，不修行为或运行旧测试。 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { World } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/core/domain/world.ts";
import { COMPONENT } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/core/domain/components/names.ts";
import { createRoleComponent } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/core/domain/components/role.ts";
import { createAliveComponent } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/core/domain/components/alive.ts";
import { Role, Camp } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/core/domain/model.ts";
import type { GameEvent } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/core/domain/events.ts";
import { allNightAbilities, activeNightAbility, findNightAbility, abilityStatus } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/abilities.ts";
import { grantNightAbility, transferNightAbility } from "/home/hby/dev/AI-Werewolf-Arena/backend/src/game/mechanisms/roles/night-ability-grants.ts";
const world = new World(), origin = world.createEntity(), from = world.createEntity(), to = world.createEntity();
const originRole = createRoleComponent(Role.Seer, Camp.Good), fromRole = createRoleComponent(Role.Villager, Camp.Good), toRole = createRoleComponent(Role.Villager, Camp.Good);
for (const [id, role] of [[origin, originRole], [from, fromRole], [to, toRole]] as const) {
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Alive, createAliveComponent());
}
const events: GameEvent[] = [];
const original = grantNightAbility(world, from, {
  id: "gift:prefix", kind: "guard", state: { lastTarget: null },
  source: { kind: "gift", actorId: origin }, startsOnDay: 2, maxUses: 2,
}, events);
const failure = Error("literal_target_publication_failure"), trace: string[] = [];
Object.defineProperty(events, "push", { configurable: true, value(event: GameEvent) {
  trace.push(this === events ? "push:same-array" : "push:wrong-array");
  assert.equal(event.type, "ability_changed");
  if (event.type !== "ability_changed") throw Error("unexpected_literal_event");
  trace.push(event.payload.operation);
  throw failure;
} });
let caught: unknown;
try {
  transferNightAbility(world, from, to, original.id, "transfer:prefix", events, {
    kind: "guard", statePolicy: (state) => ({ ...state }),
  });
} catch (error) { caught = error; }
assert.equal(caught, failure);
assert.deepEqual(trace, ["push:same-array", "granted"]);
const sourceInstances = allNightAbilities(fromRole), targetInstances = allNightAbilities(toRole);
assert.equal(sourceInstances.length, 1);
assert.equal(targetInstances.length, 1);
const source = sourceInstances[0]!, target = targetInstances[0]!;
assert.equal(source, original);
assert.notEqual(target, original);
assert.equal(target.id, "transfer:prefix");
assert.deepEqual(source.source, { kind: "gift", actorId: origin });
assert.deepEqual(target.source, { kind: "transfer", actorId: from, abilityId: "gift:prefix" });
assert.equal(Object.hasOwn(fromRole.privateState, "retiredAbilityIds"), false);
const counters = (ability: typeof source) => ({ startsOnDay: ability.startsOnDay, maxUses: ability.maxUses, uses: ability.uses, lastUsedDay: ability.lastUsedDay, disabled: ability.disabled, state: { lastTarget: (ability.state as { lastTarget: number | null }).lastTarget } });
const expected = { startsOnDay: 2, maxUses: 2, uses: 0, lastUsedDay: null, disabled: false, state: { lastTarget: null } };
assert.deepEqual(counters(source), expected);
assert.deepEqual(counters(target), expected);
for (const [role, ability] of [[fromRole, source], [toRole, target]] as const) {
  assert.equal(findNightAbility(role, "guard", ability.id), ability);
  assert.equal(findNightAbility(role, "guard"), ability);
  assert.equal(abilityStatus(ability, 2), "active");
  assert.equal(activeNightAbility(role, "guard", 2, ability.id), ability);
  assert.equal(activeNightAbility(role, "guard", 2), ability);
}
const prefix = events.map(event => event.type === "ability_changed" ? { type: event.type, actorId: event.payload.actorId, abilityId: event.payload.abilityId, operation: event.payload.operation } : { type: event.type });
assert.deepEqual(prefix, [{ type: "ability_changed", actorId: from, abilityId: "gift:prefix", operation: "granted" }]);
const result = {
  scenario: "guard gift/maxUses2/startsDay2; one transfer, target granted publication throws",
  transferExecutions: 1, exactOriginalError: caught === failure, trace,
  source: { id: source.id, sameOriginal: source === original, counters: counters(source), statusDay2: abilityStatus(source, 2), activeById: activeNightAbility(fromRole, "guard", 2, source.id) === source, activeWithoutId: activeNightAbility(fromRole, "guard", 2) === source },
  target: { id: target.id, differentObject: target !== original, counters: counters(target), statusDay2: abilityStatus(target, 2), activeById: activeNightAbility(toRole, "guard", 2, target.id) === target, activeWithoutId: activeNightAbility(toRole, "guard", 2) === target },
  sourceNotRetired: !Object.hasOwn(fromRole.privateState, "retiredAbilityIds"), eventPrefix: prefix,
  limitation: "独立当前事实实验，0生产transfer调用方；不是生产用户bug证明，不修改原异常/前缀或转移政策。两owner与固定Git同，传递模块使用当时当前工作树。",
};
writeFileSync("/tmp/night-transfer-two-active-result.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
