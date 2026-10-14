/**
 * 单元测试验证查验准入组合的可写表、注册时点、实际受赠库存和 getter 首失败轨迹。
 * 输入为真实内存 World／组件、公开安装命令及测试自有访问器；输出用字面拒绝码和 trace 验收。
 * 库存、生命与历史仍由原 owner 持有，本层只验证准入，不执行查验、付款、完整对局或模型。
 * 预期不由生产 callback 生成，临时修改的规则／状态 descriptor 在 finally 恢复。
 */
import { expect, test } from "bun:test";
import { Camp, Role, Phase, RuleError, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { SEER_VALIDATION_RULES } from "../../../src/rulesets/seer-tool-admission";
import { SEER_ROLE_PROFILE } from "../../../src/game/mechanisms/roles/seer/profile";
import { setSeerState } from "../../../src/game/mechanisms/roles/seer/ports";
import { findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";
import { recordOwnNightAction } from "../../../src/game/mechanisms/roles/night_action_history";
import { RoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import { ToolValidationRuleRegistry } from "../../../src/game/mechanisms/validation/tool_validation_rule_registry";
import type { ToolRule, ValidationRuleContext } from "../../../src/game/mechanisms/validation/contracts";

function fixture() {
  const world = new World();
  const players = [Role.Seer, Role.Villager, Role.Villager].map((kind) => {
    const id = world.createEntity(), role = createRoleComponent(kind, Camp.Good);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    return { id, role };
  });
  const seer = players[0]!;
  setSeerState(seer.role, { lastTarget: null, lastIsWerewolf: null, history: [] });
  const native = findNightAbility(seer.role, "seer_check")!;
  const events: GameEvent[] = [];
  const catalog = new RoleCatalog([], []);
  function context(actorId: number, targetId: number, abilityId?: string): ValidationRuleContext {
    return {
      world, actorId, role: players[actorId - 1]!.role, roleCatalog: catalog,
      day: 1, abilityId, phase: Phase.Night,
      toolCall: { name: "check_identity", args: { target_id: targetId } },
    };
  }
  function gift() {
    return grantNightAbility(world, 2, {
      id: "gift:literal-check", kind: "seer_check", activation: "lucky",
      state: { lastTarget: null, lastIsWerewolf: null, history: [] },
      source: { kind: "gift", actorId: seer.id }, startsOnDay: 1, maxUses: 1,
    }, events);
  }
  return { world, players, seer, native, catalog, events, context, gift };
}

test("profile keeps one writable table while registry distinguishes late role rule from captured fallback", () => {
  const f = fixture(), trace: string[] = [];
  expect(SEER_ROLE_PROFILE.runtime.validationRules).toBe(SEER_VALIDATION_RULES);
  const catalog = new RoleCatalog([
    {
      role: Role.Seer, camp: Camp.Good, label: "literal", skillBrief: "literal",
      get validationRules() { trace.push("table"); return SEER_VALIDATION_RULES; },
    },
    { role: Role.Villager, camp: Camp.Good, label: "literal", skillBrief: "literal" },
  ], []);
  const registry = new ToolValidationRuleRegistry(undefined, catalog);
  expect(trace).toEqual(["table", "table"]);
  trace.length = 0;
  const gift = f.gift(), original = Object.getOwnPropertyDescriptor(SEER_VALIDATION_RULES, "check_identity")!;
  let chosen: ToolRule = function (this: unknown, ctx) {
    expect(this).toBeUndefined();
    expect(ctx.roleCatalog).toBe(catalog);
    trace.push("first");
    return { code: RuleError.ModifierUnavailable };
  };
  try {
    Object.defineProperty(SEER_VALIDATION_RULES, "check_identity", {
      configurable: true,
      get() { trace.push("rule"); return chosen; },
    });
    expect(registry.validate(f.context(1, 3))).toEqual({ code: RuleError.ModifierUnavailable });
    // 其它角色缺同名贡献，走构造时捕获的原 callback；并非重新读取现在的表。
    expect(registry.validate(f.context(2, 3, gift.id))).toBeNull();
    chosen = () => { trace.push("second"); return { code: RuleError.CheckTarget }; };
    expect(registry.validate(f.context(1, 3))).toEqual({ code: RuleError.CheckTarget });
    expect(trace).toEqual(["table", "rule", "first", "table", "rule", "second"]);
    expect(gift.uses).toBe(0);
    expect(gift.state.history).toEqual([]);
  } finally {
    Object.defineProperty(SEER_VALIDATION_RULES, "check_identity", original);
  }
});

test("non-Seer granted check uses actual inventory and actor history without paying or adding a role gate", () => {
  const f = fixture(), rule = SEER_VALIDATION_RULES.check_identity!;
  expect(rule(f.context(2, 3, "gift:literal-check"))).toEqual({ code: RuleError.SeerOnly });
  const gift = f.gift(), before = JSON.stringify(f.players[1]!.role.privateState);
  expect(findNightAbility(f.players[1]!.role, "seer_check", gift.id)).toBe(gift);
  expect(rule(f.context(2, 3, gift.id))).toBeNull();
  expect(rule(f.context(2, 2, gift.id))).toEqual({ code: RuleError.LuckyTargetRepeat });
  expect(rule(f.context(2, 999, gift.id))).toEqual({ code: RuleError.CheckTarget });
  // 已接受的原生目标也限制同一行动者的幸运查验；账本不是付款或额外库存。
  recordOwnNightAction(f.world, 2, 1, "check", 3, false);
  expect(rule(f.context(2, 3, gift.id))).toEqual({ code: RuleError.LuckyTargetRepeat });
  expect(JSON.stringify(f.players[1]!.role.privateState)).toBe(before);
  expect(gift.uses).toBe(0);
  expect(gift.state.history).toEqual([]);
  expect(f.events.map((event) => event.type)).toEqual(["ability_changed"]);
});

test("parameter getters and three target reads preserve phase short circuit and first thrown prefix", () => {
  const f = fixture(), rule = SEER_VALIDATION_RULES.check_identity!, trace: string[] = [];
  const original = Object.getOwnPropertyDescriptor(f.native, "state")!, state = f.native.state;
  const before = JSON.stringify(f.seer.role.privateState), failure = new Error("literal_second_target_failure");
  let phase: Phase = Phase.Night, targetReads = 0, failOnRead = 0;
  const context: ValidationRuleContext = {
    roleCatalog: f.catalog,
    get world() { trace.push("world"); return f.world; },
    get actorId() { trace.push("actorId"); return f.seer.id; },
    get role() { trace.push("role"); return f.seer.role; },
    get toolCall() {
      trace.push("toolCall");
      return {
        get name(): "check_identity" { trace.push("name"); return "check_identity"; },
        get args() {
          trace.push("args");
          return {
            get target_id() {
              trace.push("target");
              const targetId = [3, 2, 3][targetReads++]!;
              if (targetReads === failOnRead) throw failure;
              return targetId;
            },
          };
        },
      };
    },
    get day() { trace.push("day"); return undefined; },
    get abilityId() { trace.push("abilityId"); return undefined; },
    get phase() { trace.push("phase"); return phase; },
  };
  try {
    Object.defineProperty(f.native, "state", { configurable: true, get() { trace.push("state"); return state; } });
    expect(rule(context)).toBeNull();
    expect(trace).toEqual([
      "world", "actorId", "role", "toolCall", "day", "abilityId", "phase",
      "name", "args", "target", "state", "args", "target", "args", "target",
    ]);
    expect(targetReads).toBe(3);
    trace.length = 0; targetReads = 0; phase = Phase.Day;
    expect(rule(context)).toEqual({ code: RuleError.AbilityPhase });
    expect(trace).toEqual(["world", "actorId", "role", "toolCall", "day", "abilityId", "phase"]);
    expect(targetReads).toBe(0);
    trace.length = 0; targetReads = 0; phase = Phase.Night; failOnRead = 2;
    expect(() => rule(context)).toThrow(failure);
    expect(trace).toEqual([
      "world", "actorId", "role", "toolCall", "day", "abilityId", "phase",
      "name", "args", "target", "state", "args", "target",
    ]);
    expect(targetReads).toBe(2);
  } finally {
    Object.defineProperty(f.native, "state", original);
  }
  expect(JSON.stringify(f.seer.role.privateState)).toBe(before);
});
