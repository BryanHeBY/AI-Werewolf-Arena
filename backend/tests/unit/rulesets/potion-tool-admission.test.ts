/**
 * 单元测试验证用药准入组合的可写规则引用、当前实例目标策略及原日期／getter 轨迹。
 * 输入为真实内存组件、明确能力元数据和手写访问器；预期是字面拒绝码与未付款库存。
 * 不运行对局或模型，不用生产准入程序生成 oracle；魔术师 frame 仅建立原内存映射状态。
 */
import { expect, test } from "bun:test";
import { Camp, Role, Phase, PotionType, RuleError, StatusMark, WitchSelfHealRule } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { StatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import { WITCH_VALIDATION_RULES } from "../../../src/rulesets/potion-tool-admission";
import { WITCH_ROLE_PROFILE } from "../../../src/game/mechanisms/roles/witch/profile";
import { setWitchState } from "../../../src/game/mechanisms/roles/witch/ports";
import { findNightAbility, type NightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { RoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import type { ToolRule, ValidationRuleContext } from "../../../src/game/mechanisms/validation/contracts";
import { createMagicianState } from "../../../src/game/mechanisms/roles/magician/state-slot";
import { installMagicianBoard, beginMagicianNight, commitMagicianExchange } from "../../../src/game/mechanisms/roles/magician/night_frame";

function fixture(actorRole: Role = Role.Villager) {
  const world = new World(), roles = [actorRole, Role.Magician, Role.Villager];
  const players = roles.map((kind) => {
    const id = world.createEntity(), role = createRoleComponent(kind, Camp.Good);
    if (kind === Role.Magician) Object.assign(role.privateState, { magician: createMagicianState(1, "original") });
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, { id, seat: id, name: "literal-" + id, sessionId: "literal-" + id });
    return { id, role };
  });
  const actor = players[0]!;
  setWitchState(actor.role, { heal: 1, poison: 1, canSelfHeal: false, selfHealRule: WitchSelfHealRule.Disabled, healUsedThisNight: false, poisonUsedThisNight: false });
  const ability = findNightAbility(actor.role, "potion") as NightAbility<"potion">;
  const catalog = new RoleCatalog([], []);
  function context(target: number, potion: PotionType = PotionType.None): ValidationRuleContext {
    return { world, actorId: actor.id, role: actor.role, roleCatalog: catalog, day: 1, phase: Phase.Night, toolCall: { name: "use_potion", args: { target_id: target, potion_type: potion } } };
  }
  return { world, players, actor, ability, catalog, context };
}

test("profile keeps canonical writable table and registry reads its current rule after construction", () => {
  const f = fixture(Role.Witch), trace: string[] = [];
  expect(WITCH_ROLE_PROFILE.runtime.validationRules).toBe(WITCH_VALIDATION_RULES);
  const catalog = new RoleCatalog([{ role: Role.Witch, camp: Camp.Good, label: "literal", skillBrief: "literal", validationRules: WITCH_VALIDATION_RULES }], []);
  const registry = new ToolValidationRuleRegistry(undefined, catalog);
  const original = Object.getOwnPropertyDescriptor(WITCH_VALIDATION_RULES, "use_potion")!;
  let chosen: ToolRule = (ctx) => { expect(ctx.roleCatalog).toBe(catalog); trace.push("first"); return { code: RuleError.ModifierUnavailable }; };
  try {
    Object.defineProperty(WITCH_VALIDATION_RULES, "use_potion", { configurable: true, get() { trace.push("rule"); return chosen; } });
    expect(registry.validate(f.context(f.actor.id))).toEqual({ code: RuleError.ModifierUnavailable });
    chosen = () => { trace.push("second"); return { code: RuleError.HealTarget }; };
    expect(registry.validate(f.context(f.actor.id))).toEqual({ code: RuleError.HealTarget });
    expect(trace).toEqual(["rule", "first", "rule", "second"]);
  } finally {
    Object.defineProperty(WITCH_VALIDATION_RULES, "use_potion", original);
  }
});

test("non-Witch potion keeps ordinary lucky and black-market none targets without paying", () => {
  const f = fixture(), rule = WITCH_VALIDATION_RULES.use_potion!;
  // 测试自有实际库存仅切换 activation 标识；不以演员角色标签制造新的 potion 资格限制。
  for (const activation of [undefined, "lucky", "black_market"] as const) {
    f.ability.activation = activation;
    const before = JSON.stringify(f.actor.role.privateState);
    expect(rule(f.context(f.actor.id))).toBeNull();
    expect(rule(f.context(3))).toEqual(activation === "lucky" ? { code: RuleError.PoisonTarget } : null);
    expect(rule(f.context(999))).toEqual(activation === undefined ? null : { code: RuleError.PoisonTarget });
    expect(JSON.stringify(f.actor.role.privateState)).toBe(before);
    expect(f.ability.state.heal).toBe(1); expect(f.ability.state.poison).toBe(1); expect(f.ability.uses).toBe(0);
  }
});

test("parameter getters retain order and missing day stays zero for the mapped heal", () => {
  const f = fixture(Role.Witch), trace: string[] = [];
  installMagicianBoard(f.world); beginMagicianNight(f.world, 1); commitMagicianExchange(f.world, 2, 1, null);
  const marks = new StatusMarksComponent(); marks.add(StatusMark.WolfKillMark);
  f.world.addComponent(3, COMPONENT.StatusMarks, marks);
  const base = f.context(3, PotionType.Heal), context: ValidationRuleContext = {
    roleCatalog: f.catalog,
    get world() { trace.push("world"); return base.world; },
    get actorId() { trace.push("actorId"); return base.actorId; },
    get role() { trace.push("role"); return base.role; },
    get toolCall() { trace.push("toolCall"); return base.toolCall; },
    get day() { trace.push("day"); return undefined; },
    get abilityId() { trace.push("abilityId"); return undefined; },
    get phase() { trace.push("phase"); return base.phase; },
  };
  const before = JSON.stringify(f.actor.role.privateState);
  expect(() => WITCH_VALIDATION_RULES.use_potion!(context)).toThrow("magician_night_unsettled");
  expect(trace).toEqual(["world", "actorId", "role", "toolCall", "day", "abilityId", "phase"]);
  expect(WITCH_VALIDATION_RULES.use_potion!(base)).toBeNull();
  expect(JSON.stringify(f.actor.role.privateState)).toBe(before);
  expect(f.ability.state.heal).toBe(1);
});
