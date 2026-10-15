/**
 * 单元测试验证普通狼准入组合的可写表身份、原访问器顺序和首失败前缀。
 * 输入为真实内存 World、角色目录、原婚礼安装以及测试自有 getter；输出采用字面规则码与 trace。
 * 只校验既有上下文，不执行狼刀、自爆或付款；派生表／访问器的临时改动在 finally 恢复。
 * 候选名单、成员知识与角色标签不制造回合许可，预期不由生产校验函数生成。
 */
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { ActionWindow, Camp, Phase, Role, RuleError, type ToolCall } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createRoleComponent } from "../../../src/domain/components/role";
import { RoleCatalog } from "../../../src/rulesets/roles/catalog";
import { WOLF_VALIDATION_RULES } from "../../../src/rulesets/wolf-tool-admission";
import { WOLF_VALIDATION_RULES as publicRules, ORDINARY_WOLF_CONTRIBUTIONS } from "../../../src/features/wolf/ability-ports";
import { WOLF_BEAUTY_ROLE_PROFILE } from "../../../src/features/wolf-beauty/profile";
import { WILD_CHILD_ROLE_PROFILE } from "../../../src/features/wild-child/profile";
import type { ValidationRuleContext } from "../../../src/engine/actions/validation-contracts";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { ghostBrideBoard, ghostBrideDeck } from "../../support/features/ghost-bride/builders/scenario";

test("retired wolf rule module cannot resolve while the canonical owner remains available", () => {
  // 路径作为解析器输入验证退休，源码本身不保留未解析的 import；先核新入口以确认解析基点有效。
  expect(Bun.resolveSync("../../../src/rulesets/wolf-tool-admission", import.meta.dir)).toBe(
    fileURLToPath(new URL("../../../src/rulesets/wolf-tool-admission.ts", import.meta.url)),
  );
  expect(() =>
    Bun.resolveSync("../../../src/game/mechanisms/roles/wolf/validation_rules", import.meta.dir),
  ).toThrow();
});

const permissions = { recognizedByPack: true, recognizes: "pack" as const, canChat: true, canVoteForKill: true };
function fixture(trace: string[] = []) {
  const world = new World();
  const players = [Role.Wolf, Role.Villager, Role.Villager].map((kind, i) => {
    const id = world.createEntity(), role = createRoleComponent(kind);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, { camp: i === 0 ? Camp.Wolf : Camp.Good });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    return { id, role };
  });
  const profile = {
    role: Role.Wolf, camp: Camp.Wolf, label: "literal", skillBrief: "literal",
    get wolfTeam() {
      trace.push("wolfTeam");
      return function(this: unknown, role: typeof players[0]["role"], currentWorld?: World) {
        expect(this).toBeUndefined();
        expect(role).toBe(players[0]!.role);
        expect(currentWorld).toBe(world);
        trace.push("permission");
        return permissions;
      };
    },
    canSelfDestruct: true,
  };
  const roleCatalog = new RoleCatalog([profile], []);
  const context: ValidationRuleContext = {
    world, actorId: 1, role: players[0]!.role, roleCatalog, day: 1, phase: Phase.Night,
    toolCall: { name: "kill_vote", args: { target_id: 2, abstain: false } },
  };
  return { world, players, profile, context };
}

test("canonical writable table preserves shared identity and derived capture versus late callback", () => {
  const f = fixture(), trace: string[] = [];
  expect(publicRules).toBe(WOLF_VALIDATION_RULES);
  expect(ORDINARY_WOLF_CONTRIBUTIONS.runtime.validationRules).toBe(WOLF_VALIDATION_RULES);
  const captured = WILD_CHILD_ROLE_PROFILE.runtime.validationRules!.kill_vote;
  expect(captured).toBe(WOLF_VALIDATION_RULES.kill_vote);
  const original = Object.getOwnPropertyDescriptor(WOLF_VALIDATION_RULES, "kill_vote")!;
  try {
    Object.defineProperty(WOLF_VALIDATION_RULES, "kill_vote", {
      configurable: true,
      get() {
        trace.push("rule");
        return function(this: unknown, ctx: ValidationRuleContext) {
          expect(this).toBe(WOLF_VALIDATION_RULES);
          expect(ctx).toBe(f.context);
          trace.push("call");
          return { code: RuleError.GhostBrideUnavailable };
        };
      },
    });
    expect(WOLF_BEAUTY_ROLE_PROFILE.runtime.validationRules!.kill_vote!(f.context)).toEqual({ code: RuleError.GhostBrideUnavailable });
    expect(WOLF_BEAUTY_ROLE_PROFILE.runtime.validationRules!.kill_vote!(f.context)).toEqual({ code: RuleError.GhostBrideUnavailable });
    expect(WILD_CHILD_ROLE_PROFILE.runtime.validationRules!.kill_vote).toBe(captured);
    expect(captured!(f.context)).toBeNull();
    expect(trace).toEqual(["rule", "call", "rule", "call"]);
  } finally {
    Object.defineProperty(WOLF_VALIDATION_RULES, "kill_vote", original);
  }
  expect(Object.getOwnPropertyDescriptor(WOLF_VALIDATION_RULES, "kill_vote")).toEqual(original);
});

test("knife keeps three args reads, two late targets and the first thrown prefix without paying", () => {
  const trace: string[] = [], f = fixture(trace), rule = WOLF_VALIDATION_RULES.kill_vote!;
  const failure = new Error("literal_second_knife_target_failure"), before = JSON.stringify(f.players[0]!.role.privateState);
  let targetReads = 0, fail = true, pass = false;
  const call: ToolCall = {
    get name(): "kill_vote" { trace.push("name"); return "kill_vote"; },
    get args() {
      trace.push("args");
      return {
        get abstain() { trace.push("abstain"); return pass; },
        get target_id() {
          trace.push("target");
          if (++targetReads === 2 && fail) throw failure;
          return 2;
        },
      };
    },
  };
  const context: ValidationRuleContext = {
    get world() { trace.push("world"); return f.world; },
    get actorId() { trace.push("actorId"); return 1; },
    get day() { trace.push("day"); return 1; },
    get ghostBrideScope() { trace.push("scope"); return undefined; },
    get role() { trace.push("role"); return f.players[0]!.role; },
    get roleCatalog() { trace.push("catalog"); return f.context.roleCatalog; },
    get toolCall() { trace.push("toolCall"); return call; },
    get phase() { trace.push("phase"); return Phase.Night; },
  };
  const prefix = ["world", "actorId", "day", "scope", "role", "catalog", "toolCall", "phase", "wolfTeam", "permission", "name", "args", "abstain"];
  const original = Object.getOwnPropertyDescriptor(f.world, "getAliveEntityIds");
  Object.defineProperty(f.world, "getAliveEntityIds", {
    configurable: true,
    get() { trace.push("rosterMethod"); return function(this: World) { expect(this).toBe(f.world); trace.push("roster"); return [1, 2, 3]; }; },
  });
  try {
    expect(() => rule(context)).toThrow(failure);
    expect(trace).toEqual([...prefix, "args", "target", "args", "target"]);
    expect(JSON.stringify(f.players[0]!.role.privateState)).toBe(before);
    fail = false; targetReads = 0; trace.length = 0;
    expect(rule(context)).toBeNull();
    expect(trace).toEqual([...prefix, "args", "target", "args", "target", "rosterMethod", "roster"]);
    pass = true; targetReads = 0; trace.length = 0;
    expect(rule(context)).toBeNull();
    expect(trace).toEqual(prefix);
    expect(targetReads).toBe(0);
  } finally {
    if (original) Object.defineProperty(f.world, "getAliveEntityIds", original);
    else delete (f.world as Partial<World>).getAliveEntityIds;
  }
});

test("wedding takes precedence while self destruct retains phase-window and confirmation short circuits", () => {
  const { world } = bootstrapGame(ghostBrideBoard(), { fixedRoles: ghostBrideDeck });
  const role = world.getComponent(2, COMPONENT.Role)!, trace: string[] = [];
  const catalog = new RoleCatalog([{
    role: Role.Wolf, camp: Camp.Wolf, label: "literal", skillBrief: "literal",
    get wolfTeam(): typeof permissions { throw new Error("ordinary_permission_must_not_run"); },
    get canSelfDestruct(): boolean { throw new Error("ordinary_blast_must_not_run"); },
  }], []);
  const married: ValidationRuleContext = {
    world, actorId: 2, role, roleCatalog: catalog, phase: Phase.Day,
    // 没有原婚礼回合／日次，必须由婚礼权威拒绝，不能回落普通狼刀或自爆资格。
    toolCall: { name: "kill_vote", args: { target_id: 3, abstain: false } },
  };
  expect(WOLF_VALIDATION_RULES.kill_vote!(married)).toEqual({ code: RuleError.GhostBrideUnavailable });
  expect(WOLF_VALIDATION_RULES.self_destruct!(married)).toEqual({ code: RuleError.WolfBlastOnly });
  const f = fixture();
  const original = Object.getOwnPropertyDescriptor(f.profile, "canSelfDestruct")!;
  Object.defineProperty(f.profile, "canSelfDestruct", { configurable: true, get() { trace.push("capability"); return true; } });
  const context: ValidationRuleContext = {
    world: f.world, role: f.players[0]!.role, roleCatalog: f.context.roleCatalog, actorId: 1,
    phase: Phase.Day, actionWindow: ActionWindow.OnPreVote,
    allowSelfDestruct: true,
    // 此 getter 夹具只构造准入实际读取的 confirm，不经过完整工具 schema；局部类型断言不添加未读 reason。
    get toolCall(): ToolCall {
      return { get name(): "self_destruct" { trace.push("name"); return "self_destruct"; }, get args() { trace.push("args"); return { get confirm(): true { trace.push("confirm"); return true; } } as Extract<ToolCall, { name: "self_destruct" }>["args"]; } };
    },
  };
  try {
    expect(WOLF_VALIDATION_RULES.self_destruct!(context)).toEqual({ code: RuleError.BlastPhase });
    expect(trace).toEqual(["capability"]);
    context.phase = Phase.Voting; context.allowSelfDestruct = false; trace.length = 0;
    expect(WOLF_VALIDATION_RULES.self_destruct!(context)).toEqual({ code: RuleError.BlastDisabled });
    expect(trace).toEqual(["capability"]);
    context.allowSelfDestruct = true; trace.length = 0;
    expect(WOLF_VALIDATION_RULES.self_destruct!(context)).toBeNull();
    expect(trace).toEqual(["capability", "name", "args", "confirm"]);
  } finally {
    Object.defineProperty(f.profile, "canSelfDestruct", original);
  }
});
