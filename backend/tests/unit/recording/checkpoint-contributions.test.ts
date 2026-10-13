/**
 * 单元测试验证完整 checkpoint 贡献装配的字段、克隆、原读取顺序及失败前缀。
 * 输入是手工内存 World、普通自定义私有状态和受控 getter；字面字段名单、原体引用、
 * 组件读取序列及原异常构成独立预期，不以另一个生产快照生成答案。
 * 不推进对局、不写文件或调用模型；特殊权威分支由原有 bounded checkpoint 案例覆盖。
 */
import { expect, test } from "bun:test";
import { captureCheckpoint } from "../../../src/runtime/simulation/reproduction_context";
import { auditData } from "../../../src/recording/checkpoint/animal-audit";
import { World } from "../../../src/core/domain/world";
import { COMPONENT, type ComponentName } from "../../../src/core/domain/components/names";
import { createIdentityComponent } from "../../../src/core/domain/entities/player";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { createBadgeComponent } from "../../../src/core/domain/components/badge";
import { createVotingRightComponent } from "../../../src/core/domain/components/voting_right";
import { createVictoryComponent } from "../../../src/core/domain/components/victory";
import { createStatusMarksComponent } from "../../../src/core/domain/components/status_marks";
import {
  Role,
  Camp,
  Phase,
  StatusMark,
  type RuntimeSnapshot,
} from "@ai-werewolf-arena/game-contract";
import type { RoleInitializationComponent } from "../../../src/game/mechanisms/roles/contracts";

function fixture() {
  const world = new World("en"),
    id = world.createEntity(),
    role = createRoleComponent(Role.Villager, Camp.Good),
    privateState = { custom: [{ amount: 2 }] },
    marks = createStatusMarksComponent("en");
  (role as RoleInitializationComponent).privateState = privateState;
  marks.add(StatusMark.GuardMark);
  world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, 4, "literal-name"));
  world.addComponent(id, COMPONENT.Role, role);
  world.addComponent(id, COMPONENT.Alive, createAliveComponent(true, "en"));
  world.addComponent(id, COMPONENT.Badge, createBadgeComponent(false, false, "en"));
  world.addComponent(id, COMPONENT.VotingRight, createVotingRightComponent(1, true, "en"));
  world.addComponent(
    id,
    COMPONENT.Victory,
    createVictoryComponent([{ kind: "faction", faction: "good" }]),
  );
  world.addComponent(id, COMPONENT.StatusMarks, marks);
  const snapshot: RuntimeSnapshot = { day: 3, phase: Phase.Day, gameOver: false, result: null };
  return { world, id, role, privateState, snapshot };
}

test("the complete assembly preserves exact schema2 keys, snapshot reference and detached custom private state", () => {
  const f = fixture(),
    checkpoint = captureCheckpoint(f.world, f.snapshot, 2, true, 9);
  expect(Object.keys(checkpoint)).toEqual([
    "cycle",
    "complete",
    "snapshot",
    "eventCount",
    "players",
  ]);
  expect(checkpoint.snapshot).toBe(f.snapshot);
  expect(Object.keys(checkpoint.players[0]!)).toEqual([
    "id",
    "seat",
    "name",
    "role",
    "camp",
    "alive",
    "privateState",
    "victory",
    "vote",
    "badge",
    "marks",
  ]);
  expect(checkpoint.players).toEqual([
    {
      id: 1,
      seat: 4,
      name: "literal-name",
      role: Role.Villager,
      camp: Camp.Good,
      alive: true,
      privateState: { custom: [{ amount: 2 }] },
      victory: { affiliations: [{ kind: "faction", faction: "good" }] },
      vote: { weight: 1, canVote: true },
      badge: { isSheriff: false, destroyed: false, voteWeight: 1.5 },
      marks: [StatusMark.GuardMark],
    },
  ]);
  f.privateState.custom[0]!.amount = 11;
  expect(checkpoint.players[0]!.privateState).toEqual({ custom: [{ amount: 2 }] });
  expect(checkpoint.players[0]!.privateState).not.toBe(f.privateState);
});

test("ordinary player contributions retain original repeated component lookups and failure fields precede players", () => {
  const f = fixture(),
    reads: ComponentName[] = [],
    original = f.world.getComponent.bind(f.world);
  f.world.addComponent(f.id, COMPONENT.DebatePenalty, { day: 3, sourceId: 7, lifeVersion: 0 });
  f.world.getComponent = ((id: number, name: ComponentName) => {
    reads.push(name);
    return original(id, name);
  }) as typeof f.world.getComponent;
  const checkpoint = captureCheckpoint(
    f.world,
    f.snapshot,
    2,
    false,
    9,
    new TypeError("raw-detail"),
  );
  expect(Object.keys(checkpoint)).toEqual([
    "cycle",
    "complete",
    "snapshot",
    "eventCount",
    "failure",
    "players",
  ]);
  expect(checkpoint.failure).toEqual({ name: "TypeError", code: "cycle_failed" });
  expect(checkpoint.players[0]!.debatePenalty).toEqual({ day: 3, sourceId: 7, lifeVersion: 0 });
  expect(reads).toEqual([
    COMPONENT.Identity,
    COMPONENT.Role,
    COMPONENT.Badge,
    COMPONENT.VotingRight,
    COMPONENT.WallNote,
    COMPONENT.Alive,
    COMPONENT.DebatePenalty,
    COMPONENT.DebatePenalty,
    COMPONENT.Lovers,
    COMPONENT.Victory,
    COMPONENT.StatusMarks,
  ]);
});

test("plain custom-state clone exceptions stop before later player fields and retain the original exception", () => {
  const f = fixture(),
    reads: string[] = [],
    failure = new Error("test_private_clone_failed"),
    original = f.world.getComponent.bind(f.world);
  Object.defineProperty(f.privateState, "blocked", {
    enumerable: true,
    get() {
      reads.push("clone-getter");
      throw failure;
    },
  });
  f.world.getComponent = ((id: number, name: ComponentName) => {
    reads.push(name);
    return original(id, name);
  }) as typeof f.world.getComponent;
  let caught: unknown;
  try {
    captureCheckpoint(f.world, f.snapshot, 2, false, 9, failure);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBe(failure);
  expect(reads).toEqual([
    COMPONENT.Identity,
    COMPONENT.Role,
    COMPONENT.Badge,
    COMPONENT.VotingRight,
    COMPONENT.WallNote,
    COMPONENT.Alive,
    "clone-getter",
  ]);
  expect(f.world.getComponent(f.id, COMPONENT.Role)).toBe(f.role);
});

test("animal audit contribution keeps own-data selection, omitted undefined and zero getter reads", () => {
  let reads = 0;
  const data = {
    canVote: true,
    weight: 1,
    optional: undefined,
    get hostile() {
      reads++;
      return 2;
    },
  };
  expect(auditData(data, ["weight", "canVote", "optional", "absent"])).toEqual({
    weight: 1,
    canVote: true,
  });
  expect(() => auditData(data, ["weight", "hostile"])).toThrow("animal_audit_data_invalid");
  expect(reads).toBe(0);
  expect(() => auditData(null, [])).toThrow("animal_audit_data_invalid");
});
