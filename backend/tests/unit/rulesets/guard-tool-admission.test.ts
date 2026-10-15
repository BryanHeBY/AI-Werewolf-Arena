/**
 * 单元测试负责守护准入表的真实受赠库存、四次晚目标读取与削弱首失败边界。
 * 输入为原内存组件、公开赠予命令和真实学者板；预期来自字面拒绝码、读取轨迹及未付款状态。
 * 原 Registry／frame 仍拥有其运行规则，本层不复制准入算法，不运行完整对局、模型或传输。
 */
import { expect, test } from "bun:test";
import { Camp, Role, Phase, RuleError, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { GUARD_VALIDATION_RULES } from "../../../src/rulesets/guard-tool-admission";
import { GUARD_ROLE_PROFILE } from "../../../src/game/mechanisms/roles/guard/profile";
import { setGuardState } from "../../../src/game/mechanisms/roles/guard/ports";
import { findNightAbility } from "../../../src/game/mechanisms/roles/abilities";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/night-ability-grants";
import { recordOwnNightAction } from "../../../src/game/mechanisms/roles/night_action_history";
import { RoleCatalog } from "../../../src/game/mechanisms/roles/catalog";
import type { ValidationRuleContext } from "../../../src/game/mechanisms/validation/contracts";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";
import { beginScholarMentorNight, settleScholarMentorChoices, closeScholarMentorNight, commitScholarMentorChoice } from "../../../src/game/mechanisms/roles/scholar_mentor/night_frame";

function fixture() {
  const world = new World();
  const players = [Role.Guard, Role.Villager, Role.Villager].map((kind) => {
    const id = world.createEntity(), role = createRoleComponent(kind);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    return { id, role };
  });
  setGuardState(players[0]!.role, { lastTarget: null });
  const native = findNightAbility(players[0]!.role, "guard")!, catalog = new RoleCatalog([], []);
  const context = (actorId: number, targetId: number, abilityId?: string): ValidationRuleContext => ({
    world, actorId, role: players[actorId - 1]!.role, roleCatalog: catalog,
    day: 1, abilityId, phase: Phase.Night,
    toolCall: { name: "guard", args: { target_id: targetId, abstain: false } },
  });
  return { world, players, native, catalog, context };
}

test("同一可写表保四处晚目标读取与首失败轨迹，阶段拒绝不读工具参数", () => {
  const f = fixture(), rule = GUARD_VALIDATION_RULES.guard!, trace: string[] = [];
  expect(GUARD_ROLE_PROFILE.runtime.validationRules).toBe(GUARD_VALIDATION_RULES);
  expect(Object.getOwnPropertyDescriptor(GUARD_VALIDATION_RULES, "guard")!.writable).toBe(true);
  const descriptor = Object.getOwnPropertyDescriptor(f.native, "state")!, state = f.native.state;
  const failure = new Error("literal_third_guard_target_failure"), before = JSON.stringify(f.players[0]!.role.privateState);
  let phase: Phase = Phase.Night, targetReads = 0, failOnRead = 0;
  const ctx: ValidationRuleContext = {
    roleCatalog: f.catalog,
    get world() { trace.push("world"); return f.world; },
    get actorId() { trace.push("actorId"); return 1; },
    get role() { trace.push("role"); return f.players[0]!.role; },
    get toolCall() {
      trace.push("toolCall");
      return {
        get name(): "guard" { trace.push("name"); return "guard"; },
        get args() {
          trace.push("args");
          return {
            get abstain() { trace.push("abstain"); return false; },
            get target_id() {
              trace.push("target");
              targetReads++;
              if (targetReads === failOnRead) throw failure;
              return 3;
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
    expect(rule(ctx)).toBeNull();
    expect(targetReads).toBe(4);
    expect(trace).toEqual([
      "world", "actorId", "role", "toolCall", "day", "abilityId", "phase",
      "name", "args", "abstain", "args", "target", "args", "target", "state", "args", "target", "args", "target",
    ]);
    trace.length = 0; targetReads = 0; phase = Phase.Day;
    expect(rule(ctx)).toEqual({ code: RuleError.AbilityPhase });
    expect(trace).toEqual(["world", "actorId", "role", "toolCall", "day", "abilityId", "phase"]);
    trace.length = 0; targetReads = 0; phase = Phase.Night; failOnRead = 3;
    expect(() => rule(ctx)).toThrow(failure);
    expect(trace).toEqual([
      "world", "actorId", "role", "toolCall", "day", "abilityId", "phase",
      "name", "args", "abstain", "args", "target", "args", "target", "state", "args", "target",
    ]);
  } finally {
    Object.defineProperty(f.native, "state", descriptor);
  }
  expect(JSON.stringify(f.players[0]!.role.privateState)).toBe(before);
  expect(f.native.uses).toBe(0);
});

test("非守卫受赠实例保原接受面，行动者既有守护历史仍限制目标而不付款", () => {
  const f = fixture(), rule = GUARD_VALIDATION_RULES.guard!, events: GameEvent[] = [];
  expect(rule(f.context(2, 3, "gift:literal-guard"))).toEqual({ code: RuleError.GuardOnly });
  const gift = grantNightAbility(f.world, 2, {
    id: "gift:literal-guard", kind: "guard", activation: "lucky", state: { lastTarget: null },
    source: { kind: "gift", actorId: 1 }, startsOnDay: 1, maxUses: 1,
  }, events), before = JSON.stringify(f.players[1]!.role.privateState);
  expect(rule(f.context(2, 3, gift.id))).toBeNull();
  expect(rule(f.context(2, 2, gift.id))).toBeNull();
  recordOwnNightAction(f.world, 2, 1, "guard", 3, false);
  expect(rule(f.context(2, 3, gift.id))).toEqual({ code: RuleError.LuckyTargetRepeat });
  expect(JSON.stringify(f.players[1]!.role.privateState)).toBe(before);
  expect(gift.uses).toBe(0);
  expect(gift.state.lastTarget).toBeNull();
  expect(events.map((event) => event.type)).toEqual(["ability_changed"]);
});

test("真实学者未结算错误和已结算削弱均先于空守参数读取", async () => {
  const board = parseBoardDefinition(await Bun.file(new URL("../../../../configs.example/boards/awa_scholar_mentor_12_v1.json", import.meta.url)).json());
  const game = bootstrapGame(board.config, { fixedRoles: [Role.DayScholar, Role.NightMentor, Role.Seer, Role.Guard, Role.Witch, Role.Wolf, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Villager, Role.Villager] });
  const rule = GUARD_VALIDATION_RULES.guard!, role = game.world.getComponent(4, COMPONENT.Role)!;
  let reads = 0;
  const ctx: ValidationRuleContext = {
    world: game.world, role, actorId: 4, roleCatalog: new RoleCatalog([], []), day: 1, phase: Phase.Night,
    toolCall: { name: "guard", get args(): { target_id: null; abstain: true } { reads++; throw new Error("literal_empty_guard_args_must_not_read"); } },
  };
  beginScholarMentorNight(game.world, 1);
  expect(() => rule(ctx)).toThrow("scholar_mentor_night_unsettled");
  expect(reads).toBe(0);
  settleScholarMentorChoices(game.world, 1);
  closeScholarMentorNight(game.world, 1);
  beginScholarMentorNight(game.world, 2);
  commitScholarMentorChoice(game.world, 2, 1, "weaken", 4);
  commitScholarMentorChoice(game.world, 2, 2, null, null);
  settleScholarMentorChoices(game.world, 2);
  ctx.day = 2;
  expect(rule(ctx)).toEqual({ code: RuleError.ModifierUnavailable });
  expect(reads).toBe(0);
  expect(findNightAbility(role, "guard")!.uses).toBe(0);
});
