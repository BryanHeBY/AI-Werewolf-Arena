/**
 * Noble／Secret Body state-snapshot 单元测试使用既有内存夹具、原回调和显式坏变体，在原生 owner／frame／reader 边界隔离核对。原字面预期、身份快照及拒绝断言为依据，不重新生成；不装配游戏循环、不运行模型或实体传输，保留支持文件、夹具字节、政策及状态。
 */
import {
  createNobleState,
  chooseServant,
  endServant,
  readNobleState,
  createSecretBodyState,
  chooseBodyTarget,
  readSecretBodyState,
  spendBodyForNight,
} from "../../../../src/features/noble-secret-body/state";
import { expect, test } from "bun:test";

const living = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
for (const kind of ["expired", "cleared", "target_dead"] as const)
  test("no servant re-open on the actual terminal day " + kind, () => {
    const n2 = chooseServant(createNobleState(), 2, 6, 1, living),
      closed = endServant(n2, "servant:night:2", 3, kind);
    expect(readNobleState(closed)).toEqual(closed);
    expect(chooseServant(closed, 4, 7, 1, living).contracts.at(-1)?.createdNight).toBe(4);
    expect(() => chooseServant(closed, 3, 7, 1, living)).toThrow("night_noble_unavailable");
  });
test("reader rejects a phantom null choice during a still-occupied terminal night", () => {
  const n2 = chooseServant(createNobleState(), 2, 6, 1, living),
    closed = endServant(n2, "servant:night:2", 3, "expired");
  expect(readNobleState(closed)).toEqual(closed);
  expect(readNobleState({ ...closed, lastChoice: { day: 3, targetId: null } })).toBeUndefined();
});
for (const kind of ["body", "servant"] as const)
  test(kind + " target list getter is not executed", () => {
    let reads = 0;
    const roster: number[] = [];
    Object.defineProperty(roster, "0", {
      enumerable: true,
      get() {
        reads++;
        return 6;
      },
    });
    roster.length = 1;
    const call = () =>
      kind === "body"
        ? chooseBodyTarget(createSecretBodyState(), 1, 6, roster)
        : chooseServant(createNobleState(), 2, 6, 1, roster);
    let rejected = false;
    try {
      call();
    } catch {
      rejected = true;
    }
    expect({ rejected, reads }).toEqual({ rejected: true, reads: 0 });
  });
for (const kind of ["body", "servant"] as const)
  test(kind + " forged includes cannot admit target outside a real roster", () => {
    let reads = 0;
    const fake = {
      includes() {
        reads++;
        return true;
      },
    } as any;
    const call = () =>
      kind === "body"
        ? chooseBodyTarget(createSecretBodyState(), 1, 99, fake)
        : chooseServant(createNobleState(), 2, 99, 1, fake);
    let rejected = false;
    try {
      call();
    } catch {
      rejected = true;
    }
    expect({ rejected, reads }).toEqual({ rejected: true, reads: 0 });
  });

const live = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
test("state readers reject top-level Proxy and revoked Proxy without traps", () => {
  let calls = 0;
  const p = new Proxy(createNobleState(), {
    ownKeys() {
      calls++;
      throw Error("trap");
    },
    get() {
      calls++;
      throw Error("trap");
    },
    getPrototypeOf() {
      calls++;
      throw Error("trap");
    },
  });
  expect(readNobleState(p)).toBeUndefined();
  expect(readSecretBodyState(p)).toBeUndefined();
  expect(calls).toBe(0);
  const r = Proxy.revocable({}, {});
  r.revoke();
  expect(readNobleState(r.proxy)).toBeUndefined();
  expect(readSecretBodyState(r.proxy)).toBeUndefined();
});
test("nested terminal/choice/body getters stay unread", () => {
  let reads = 0;
  const n = chooseServant(createNobleState(), 2, 6, 1, live);
  Object.defineProperty(n.contracts[0]!.status, "kind", {
    get() {
      reads++;
      return "pending";
    },
  });
  expect(readNobleState(n)).toBeUndefined();
  const b = chooseBodyTarget(createSecretBodyState(), 1, 6, live);
  Object.defineProperty(b.lastChoice!, "targetId", {
    get() {
      reads++;
      return 6;
    },
  });
  expect(readSecretBodyState(b)).toBeUndefined();
  const c = createSecretBodyState();
  Object.defineProperty(c.body, "kind", {
    get() {
      reads++;
      return "intact";
    },
  });
  expect(readSecretBodyState(c)).toBeUndefined();
  expect(reads).toBe(0);
});
test("contract arrays reject hidden custom properties and sparse slots", () => {
  const n = chooseServant(createNobleState(), 2, 6, 1, live);
  const a = structuredClone(n);
  Object.defineProperty(a.contracts, Symbol.iterator, {
    value: function* () {
      throw Error("iterator");
    },
  });
  expect(readNobleState(a)).toBeUndefined();
  const b = structuredClone(n);
  delete b.contracts[0];
  expect(readNobleState(b)).toBeUndefined();
});
test("returned states and terminal transitions have no aliases back into raw history", () => {
  const n = chooseServant(createNobleState(), 2, 6, 1, live),
    snapshot = readNobleState(n)!;
  n.contracts[0]!.targetId = 99;
  n.lastChoice!.targetId = 99;
  expect(snapshot.contracts[0]!.targetId).toBe(6);
  expect(snapshot.lastChoice!.targetId).toBe(6);
  const closed = endServant(snapshot, "servant:night:2", 2, "cleared");
  (snapshot.contracts[0]!.status as any).kind = "expired";
  expect(closed.contracts[0]!.status).toEqual({ kind: "cleared", day: 2 });
  const body = chooseBodyTarget(createSecretBodyState(), 2, 6, live),
    spent = spendBodyForNight(body, 2, 5, { targetId: 5, cause: "poison" });
  body.lastChoice!.targetId = 99;
  expect(spent.lastChoice).toEqual({ day: 2, targetId: 6 });
});
test("extra parallel body inventory and inconsistent discriminants are rejected", () => {
  const b = createSecretBodyState();
  expect(readSecretBodyState({ ...b, remaining: 1 })).toBeUndefined();
  expect(readSecretBodyState({ ...b, body: { kind: "intact", remaining: 1 } })).toBeUndefined();
  expect(
    readSecretBodyState({
      ...b,
      body: { kind: "night_spent", day: 1, targetId: 6, cause: "poison" },
    }),
  ).toBeUndefined();
  expect(
    readSecretBodyState({ ...b, body: { kind: "exile_revealed", day: 1, remaining: 0 } }),
  ).toBeUndefined();
});
test("contract ID, expiry, duplicate and revival states are rejected", () => {
  const n = chooseServant(createNobleState(), 2, 6, 1, live);
  for (const change of [
    (x: any) => (x.contracts[0].id = "servant:night:3"),
    (x: any) => (x.contracts[0].expiresNight = 4),
    (x: any) => x.contracts.push(structuredClone(x.contracts[0])),
    (x: any) => (x.contracts[0].status = { kind: "expired", day: 2 }),
  ]) {
    const copy = structuredClone(n);
    change(copy);
    expect(readNobleState(copy)).toBeUndefined();
  }
});
