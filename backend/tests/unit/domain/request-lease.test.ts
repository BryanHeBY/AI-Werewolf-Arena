/**
 * 单元测试核对公共请求传播 owner 的四种固定读取顺序、独立多绑定及异常前缀。
 * 输入为手写晚查询、请求 getter 和别名；输出以原引用、字面 trace、同一 Error 和未读取计数为 oracle。
 * 只写测试自有字段／记录，显式核 F02 失配永久拒绝与有限期限；不执行游戏、模型或领域付款。
 */
import { expect, test } from "bun:test";
import { Phase } from "../../../src/core/domain/identity";
import type { ActionRequest } from "../../../src/core/domain/actions";
import { RequestLease } from "../../../src/core/domain/request-lease";
import { inheritRequestAlias } from "../../../src/core/domain/request_delivery";

function request(phase = Phase.Night, stage: ActionRequest["context"]["stage"] = "thief"): ActionRequest {
  return {
    actorId: 1,
    phase,
    allowedTools: [],
    requiresAction: false,
    summary: "literal lease",
    // 本 fixture 只提供四协议实际读取的字段；断言不补未读 feed/constraints，也不扩大生产接受面。
    context: { day: 1, stage, wall_id: "wall:1", item_instance_id: "wall:1:1" } as ActionRequest["context"],
  } as ActionRequest;
}

test("independent bindings survive a later route failure and inherited routes remain stable", () => {
  const owner = {}, wall = {}, initial = {}, author = {}, trace: string[] = [],
    failure = new Error("literal_later_alias_route"), original = request(Phase.Voting, "wall_notes"),
    authors = new Map([[1, author]]);
  let fail = false;
  const wallLease = RequestLease.item(
    {
      active: (_owner: object) => { trace.push("wall:active"); return wall; },
      authors: (_scope: object) => authors,
      token: (_scope: object) => "wall:1",
      instanceId: (_author: object) => "wall:1:1",
      phase: () => Phase.Voting,
      stage: () => "wall_notes" as const,
      current: () => true,
    }, 10,
  );
  const initialLease = RequestLease.actorPhaseDayStage(
    {
      active: (_owner: object) => { trace.push("initial:active"); if (fail) throw failure; return initial; },
      owner: (_scope: object) => owner,
      actorId: (_scope: object) => 1,
      phase: () => Phase.Voting,
      stage: (_scope: object) => "wall_notes" as const,
      current: () => true,
    }, 20,
  );
  wallLease.bind(owner, original);
  initialLease.bind(owner, original);
  const alias = { ...original, deadlineAtMs: Date.now() + 30_000 };
  trace.length = 0;
  fail = true;
  expect(() => inheritRequestAlias(original, alias)).toThrow(failure);
  expect(trace).toEqual(["wall:active", "initial:active"]);
  expect(wallLease.scope(owner, alias)).toBe(wall);
  expect(initialLease.scope(owner, alias)).toBeUndefined();
  fail = false;
  inheritRequestAlias(original, alias);
  expect(initialLease.scope(owner, alias)).toBeUndefined();
  const descendant = { ...alias, deadlineAtMs: -1 };
  trace.length = 0;
  inheritRequestAlias(alias, descendant);
  expect(trace).toEqual(["wall:active"]);
  expect(wallLease.scope(owner, descendant)).toBeUndefined();
  expect(initialLease.scope(owner, descendant)).toBeUndefined();
});

test("four fixed protocols preserve getter order and recover their original context references", () => {
  const owner = {}, scope = {}, author = {}, authors = new Map([[1, author]]);
  for (const kind of ["initial", "wild", "lonely", "wall"] as const) {
    const trace: string[] = [], phase = kind === "wall" ? Phase.Voting : Phase.Night,
      stage = kind === "wall" ? "wall_notes" : kind === "initial" ? "thief" : kind === "wild" ? "wild_child" : "lonely_girl",
      r = request(phase, stage), context = r.context;
    let activeContext = context, activeStage: ActionRequest["context"]["stage"] = stage;
    Object.defineProperties(context, {
      stage: { enumerable: true, get: () => { trace.push("context.stage"); return activeStage; }, set: (v) => { activeStage = v; } },
      day: { enumerable: true, get: () => { trace.push("context.day"); return 1; } },
      wall_id: { enumerable: true, get: () => { trace.push("context.wall_id"); return "wall:1"; } },
      item_instance_id: { enumerable: true, get: () => { trace.push("context.instance"); return "wall:1:1"; } },
    });
    Object.defineProperties(r, {
      actorId: { enumerable: true, get: () => { trace.push("actor"); return 1; } },
      phase: { enumerable: true, get: () => { trace.push("phase"); return phase; } },
      context: { enumerable: true, get: () => { trace.push("context"); return activeContext; }, set: (v) => { activeContext = v; } },
    });
    const q = {
      active: (_owner: object) => scope,
      owner: (_scope: object) => owner,
      actorId: (_scope: object) => 1,
      phase: () => phase,
      stage: (_scope: object) => stage,
      current: (_scope: object) => { trace.push("current"); return true; },
    };
    const lease = kind === "initial" ? RequestLease.actorPhaseDayStage(q, 20)
      : kind === "wild" ? RequestLease.stagePhaseDayActor(q, 30)
      : kind === "lonely" ? RequestLease.actorPhaseStageDay(q, 40)
      : RequestLease.item({
        active: q.active, authors: (_scope: object) => authors,
        token: (_scope: object) => "wall:1", instanceId: (_author: object) => "wall:1:1",
        phase: q.phase, stage: () => stage, current: (_owner: object, _scope: object, _author: object) => { trace.push("current"); return true; },
      }, 10);
    // 预期逐项来自四旧绑定正文，不能由新 owner 生成读取名单。
    const bindTrace = {
      initial: ["actor", "phase", "context", "context.day", "context", "context.stage", "context"],
      wild: ["context", "context.stage", "phase", "context", "context.day", "actor", "current", "context"],
      lonely: ["actor", "phase", "context", "context.stage", "context", "context.day", "current", "context"],
      wall: ["actor", "context", "context.wall_id", "context", "context.instance", "actor", "context"],
    };
    const queryTrace = {
      initial: ["actor", "context", "phase", "context", "context.day", "context", "context.stage"],
      wild: ["actor", "context", "context", "context.stage", "context", "context.day", "phase", "current"],
      lonely: ["actor", "phase", "context", "context", "context.stage", "context", "context.day", "current"],
      wall: ["actor", "context", "context", "context.wall_id", "context", "context.instance", "phase", "context", "context.day", "context", "context.stage"],
    };
    lease.bind(owner, r);
    // 新 pin 在原登记后额外读顶层原值；四协议内原 getter 次序仍在前缀。
    expect(trace).toEqual([...bindTrace[kind], "actor", "phase", "context"]);
    trace.length = 0;
    expect(lease.scope(owner, r)).toBe(scope);
    expect(trace).toEqual([...queryTrace[kind], "actor", "phase", "context", ...((kind === "initial" || kind === "wall") ? ["current"] : [])]);
    context.stage = "literal_bad_stage" as ActionRequest["context"]["stage"];
    expect(lease.scope(owner, r)).toBeUndefined();
    context.stage = stage;
    expect(lease.scope(owner, r)).toBeUndefined();
    r.context = { ...context };
    expect(lease.scope(owner, r)).toBeUndefined();
    r.context = context;
    expect(lease.scope(owner, r)).toBeUndefined();
  }
});

test("invalid sources skip target enumeration and field exceptions leave the original binding", () => {
  const owner = {}, scope = {}, trace: string[] = [], failure = new Error("literal_alias_field_getter"),
    original = request(), lease = RequestLease.actorPhaseDayStage({
      active: (_owner: object) => scope, owner: (_scope: object) => owner,
      actorId: (_scope: object) => 1, phase: () => Phase.Night, stage: (_scope: object) => "thief" as const, current: () => true,
    }, 20);
  lease.bind(owner, original);
  Object.defineProperty(original, "actorId", { enumerable: true, get: () => { trace.push("source.actor"); return 1; } });
  const fresh = request();
  lease.bind(owner, fresh);
  Object.defineProperty(fresh, "actorId", { enumerable: true, get: () => { trace.push("source.actor"); return 1; } });
  const target = new Proxy({ ...fresh, deadlineAtMs: NaN }, {
    ownKeys(value) { trace.push("target.keys"); return Reflect.ownKeys(value); },
    get(value, key, receiver) {
      if (key === "actorId") { trace.push("target.actor"); throw failure; }
      return Reflect.get(value, key, receiver);
    },
  });
  original.context.stage = "literal_bad_stage" as ActionRequest["context"]["stage"];
  trace.length = 0;
  inheritRequestAlias(original, target);
  expect(trace).toEqual(["source.actor"]);
  original.context.stage = "thief";
  trace.length = 0;
  // 已撤原请求不复活；独立有效来源的坏 target 仍保同 Error 且不毒原。
  expect(lease.scope(owner, original)).toBeUndefined();
  expect(() => inheritRequestAlias(fresh, target)).toThrow(failure);
  expect(trace).toEqual(["source.actor", "source.actor", "target.keys", "source.actor", "target.actor"]);
  expect(lease.scope(owner, target)).toBeUndefined();
  expect(lease.scope(owner, fresh)).toBe(scope);
  // WeakMap.set 的 callee 在记录对象构造之前取得；该失败不得多读记录里的 context。
  const bindingRequest = request(), context = bindingRequest.context,
    descriptor = Object.getOwnPropertyDescriptor(WeakMap.prototype, "set")!;
  let contextReads = 0, observed: unknown;
  Object.defineProperty(bindingRequest, "context", { get: () => { contextReads++; return context; } });
  try {
    Object.defineProperty(WeakMap.prototype, "set", { configurable: true, get: () => { throw failure; } });
    try { lease.bind(owner, bindingRequest); } catch (error) { observed = error; }
  } finally {
    Object.defineProperty(WeakMap.prototype, "set", descriptor);
  }
  expect(observed).toBe(failure);
  expect(contextReads).toBe(2);
  expect(lease.scope(owner, bindingRequest)).toBeUndefined();
});
