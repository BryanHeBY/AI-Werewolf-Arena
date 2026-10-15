/**
 * 单元测试：用手写字段、getter 轨迹与错误对象验证鬼魂新娘的数据写入边界。
 * 字面预期覆盖初始化左值、两字段已付前缀及设置期／非设置期安全审计；不从生产输出生成 oracle。
 * 数据命令不授予婚礼许可，也不运行模型或完整对局；原 authority 复验另由已有精准用例检查。
 */
import { expect, spyOn, test } from "bun:test";
import * as facts from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import type { RoleInitializationComponent } from "../../../../src/rulesets/roles/contracts";
import {
  acceptGhostBrideParticipantAudit,
  consumeGhostBrideChoice,
  initializeGhostBrideState,
  refreshGhostBrideParticipantAudit,
  updateGhostBrideExpectedData,
  type GhostBrideParticipantData,
} from "../../../../src/features/ghost-bride/state";

test("initialization reads the private-state left side before creating and storing native data", () => {
  const trace: string[] = [];
  const native = { policy: facts.GHOST_BRIDE_POLICY, remaining: 1 as const, groomId: null };
  const store: Record<string, unknown> = {};
  const role: RoleInitializationComponent = {
    role: Role.GhostBride,
    get privateState() {
      trace.push("left-side");
      return store;
    },
  };
  Object.defineProperty(store, "ghostBride", {
    set(value) {
      trace.push("store");
      expect(value).toBe(native);
    },
  });
  const factory = spyOn(facts, "freshGhostBrideState").mockImplementation(() => {
    trace.push("factory");
    return native;
  });
  try {
    initializeGhostBrideState(role);
    expect(trace).toEqual(["left-side", "factory", "store"]);
  } finally {
    factory.mockRestore();
  }
});

test("groom write failure preserves the paid remaining prefix and two live state reads", () => {
  const trace: string[] = [];
  const failure = new Error("groom-write-failed");
  let remaining: 0 | 1 = 1;
  const raw: facts.GhostBrideState = {
    policy: facts.GHOST_BRIDE_POLICY,
    get remaining() {
      return remaining;
    },
    set remaining(value) {
      trace.push("remaining");
      remaining = value;
    },
    groomId: null,
  };
  Object.defineProperty(raw, "groomId", {
    set(_value) {
      trace.push("groomId");
      throw failure;
    },
  });
  const binding = {
    get state() {
      trace.push("state");
      return raw;
    },
  };
  expect(() => consumeGhostBrideChoice(binding, 2)).toThrow(failure);
  expect(trace).toEqual(["state", "remaining", "state", "groomId"]);
  expect(remaining).toBe(0 as typeof remaining);
});

test("setup rejection preserves safe audit while later native stock and late encoding remain distinct", () => {
  const original = '{"native":{"stock":1}}';
  const changed = '{"native":{"stock":0}}';
  const p: GhostBrideParticipantData = {
    state: { native: { stock: 0 } },
    stateRefs: [],
    initialPrivateState: { native: { stock: 1 } },
    expectedPrivateJson: original,
    auditPrivateJson: original,
  };
  expect(acceptGhostBrideParticipantAudit(p, changed, true)).toBe(false);
  expect(p.auditPrivateJson).toBe(original);
  expect(acceptGhostBrideParticipantAudit(p, changed, false)).toBe(true);
  expect(p.auditPrivateJson).toBe(changed);
  expect(acceptGhostBrideParticipantAudit(p, null, false)).toBe(false);
  refreshGhostBrideParticipantAudit(p, () => null);
  expect(p.auditPrivateJson).toBe(changed);

  // 左侧 participant 在 JSON callee／第二次查找前确定；第二次仍读取现场原 state。
  const trace: string[] = [];
  const rhs = { ...p, state: { native: { stock: 4 } } };
  let calls = 0;
  const participants = new Map<number, GhostBrideParticipantData>();
  participants.get = (_id) => {
    trace.push("get");
    return calls++ === 0 ? p : rhs;
  };
  updateGhostBrideExpectedData({ participants, actorId: 1 }, (value) => {
    trace.push("encode");
    expect(value).toBe(rhs.state);
    return "committed-late-data";
  });
  expect(trace).toEqual(["get", "get", "encode"]);
  expect(p.expectedPrivateJson).toBe("committed-late-data");
  expect(rhs.expectedPrivateJson).toBe(original);
});
