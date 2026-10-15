/**
 * 单元测试验证夜之贵族／秘密之身状态槽的原引用、字段次序、唯一影子和失败前缀。
 * 输入为原 factory/schema 数据、实际权威 fixture 和局部抛错的 JSON／字段写入方法。
 * 输出以手写顺序、同引用、旧影子与未提交 lease 断言验收，不生成旧预期或运行完整对局。
 * 临时方法替换在 finally 恢复；测试只观察本族数据写入，不绕过原生命、夜间或请求授权。
 */
import { expect, test } from "bun:test";
import {
  NobleBodyStateSlot,
  createNobleState,
  createSecretBodyState,
  readNobleState,
  readSecretBodyState,
  chooseServant,
  chooseBodyTarget,
  type SecretBodyState,
} from "../../../../src/features/noble-secret-body/state";
import {
  beginNobleBodyNight,
  openSecretBodyChoice,
  checkpointNobleBodyAuthority,
} from "../../../../src/features/noble-secret-body/authority";
import { nobleBodyAuthorityFixture } from "../../../support/features/noble-secret-body/drivers/authority";

const living = [1, 2, 3, 4, 5, 6];

function slot() {
  const noble = createNobleState(), body = createSecretBodyState();
  return {
    noble, body,
    value: new NobleBodyStateSlot(noble, body, readNobleState(noble)!, readSecretBodyState(body)!),
  };
}

test("canonical comparison short circuits and each shadow decode retains the JSON receiver", () => {
  const f = slot(), trace: string[] = [], stringify = Object.getOwnPropertyDescriptor(JSON, "stringify")!,
    parse = Object.getOwnPropertyDescriptor(JSON, "parse")!;
  let canonical: boolean | undefined;
  // 原引用内容变更后贵族影子不匹配；不得提前编码身体或把 schema 副本换成原槽。
  f.noble.wolfActionPolicy = "no_blast_no_self_knife";
  let nobleCopy: ReturnType<NobleBodyStateSlot["decodeNobleShadow"]> | undefined,
    bodyCopy: ReturnType<NobleBodyStateSlot["decodeBodyShadow"]> | undefined;
  try {
    Object.defineProperty(JSON, "stringify", {
      configurable: stringify.configurable, enumerable: stringify.enumerable,
      get() {
        trace.push("stringify:get");
        return function (this: typeof JSON, value: unknown): string {
          trace.push(this === JSON ? "stringify:JSON" : "stringify:wrong-receiver");
          if (value && typeof value === "object" && "protectionRepeatPolicy" in value)
            throw new Error("body_encoder_must_not_run");
          return stringify.value.call(this, value);
        };
      },
    });
    canonical = f.value.matchesCanonicalData();
    Object.defineProperty(JSON, "parse", {
      configurable: parse.configurable, enumerable: parse.enumerable,
      get() {
        trace.push("parse:get");
        return function (this: typeof JSON, text: string): unknown {
          trace.push(this === JSON ? "parse:JSON" : "parse:wrong-receiver");
          return parse.value.call(this, text);
        };
      },
    });
    nobleCopy = f.value.decodeNobleShadow();
    bodyCopy = f.value.decodeBodyShadow();
  } finally {
    Object.defineProperty(JSON, "stringify", stringify);
    Object.defineProperty(JSON, "parse", parse);
  }
  expect(f.value.nobleState).toBe(f.noble);
  expect(f.value.bodyState).toBe(f.body);
  expect(canonical).toBe(false);
  expect(trace).toEqual(["stringify:get", "stringify:JSON", "parse:get", "parse:JSON", "parse:get", "parse:JSON"]);
  expect(nobleCopy).toEqual({ policy: "awa_noble_secret_body_v1", wolfActionPolicy: "standard", lastChoice: null, contracts: [] });
  expect(bodyCopy).toEqual({ policy: "awa_noble_secret_body_v1", protectionRepeatPolicy: "awa_nonconsecutive_nights_v1", lastChoice: null, body: { kind: "intact" } });
  expect(nobleCopy).not.toBe(f.noble);
  expect(bodyCopy).not.toBe(f.body);
});

test("body fields are written in original order before encoding failure leaves the old shadow", () => {
  const f = slot(), prepared = chooseBodyTarget(f.body, 1, 3, living), trace: string[] = [],
    descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!, failure = new Error("body_encoding_failed");
  const next = {} as SecretBodyState;
  for (const key of ["policy", "protectionRepeatPolicy", "lastChoice", "body"] as const)
    Object.defineProperty(next, key, {
      enumerable: true, configurable: true,
      get() { trace.push(`field:${key}`); return prepared[key]; },
    });
  let caught: unknown;
  try {
    Object.defineProperty(JSON, "stringify", {
      configurable: descriptor.configurable, enumerable: descriptor.enumerable,
      get() {
        trace.push("stringify:get");
        return function () { trace.push("stringify:call"); throw failure; };
      },
    });
    try { f.value.commitBody(next); } catch (error) { caught = error; }
  } finally { Object.defineProperty(JSON, "stringify", descriptor); }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["field:policy", "field:protectionRepeatPolicy", "field:lastChoice", "field:body", "stringify:get", "stringify:call"]);
  expect(f.value.bodyState).toBe(f.body);
  expect(f.body.lastChoice).toBe(prepared.lastChoice);
  expect(f.body.body).toBe(prepared.body);
  expect(f.value.decodeBodyShadow()).toEqual({ policy: "awa_noble_secret_body_v1", protectionRepeatPolicy: "awa_nonconsecutive_nights_v1", lastChoice: null, body: { kind: "intact" } });
  expect(f.value.matchesCanonicalData()).toBe(false);
});

test("a later field write failure keeps earlier fields without advancing the Noble shadow", () => {
  const f = slot(), next = chooseServant(f.noble, 2, 3, 1, living), previousContracts = f.noble.contracts,
    define = Object.defineProperty, trace: string[] = [], failure = new Error("contracts_write_failed");
  let caught: unknown;
  try {
    Object.defineProperty = function (object, key, attributes) {
      if (object === f.noble) {
        trace.push(String(key));
        if (key === "contracts") throw failure;
      }
      return define(object, key, attributes);
    };
    try { f.value.commitNoble(next); } catch (error) { caught = error; }
  } finally { Object.defineProperty = define; }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["policy", "wolfActionPolicy", "lastChoice", "contracts"]);
  expect(f.noble.lastChoice).toBe(next.lastChoice);
  expect(f.noble.contracts).toBe(previousContracts);
  expect(f.value.decodeNobleShadow()).toEqual({ policy: "awa_noble_secret_body_v1", wolfActionPolicy: "standard", lastChoice: null, contracts: [] });
  expect(f.value.matchesCanonicalData()).toBe(false);
});

test("actual body choice encoding failure preserves raw choice prefix but not lease or checkpoint shadow", () => {
  const f = nobleBodyAuthorityFixture(), descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!,
    failure = new Error("actual_body_encoding_failed");
  beginNobleBodyNight(f.world, 1, () => true);
  const choice = openSecretBodyChoice(f.world, 1);
  let caught: unknown;
  try {
    JSON.stringify = function (value, replacer, space) {
      if (value && typeof value === "object" && "protectionRepeatPolicy" in value &&
        value.lastChoice?.day === 1) throw failure;
      return descriptor.value.call(this, value, replacer, space);
    };
    try { choice.commit(3); } catch (error) { caught = error; }
  } finally { Object.defineProperty(JSON, "stringify", descriptor); }
  const raw = (f.roles[1]!.privateState as { readonly secretBody?: unknown }).secretBody as SecretBodyState,
    checkpoint = checkpointNobleBodyAuthority(f.world, false);
  expect(caught).toBe(failure);
  expect(raw.lastChoice).toEqual({ day: 1, targetId: 3 });
  expect(raw.body.kind).toBe("intact");
  expect(checkpoint.body.lastChoice).toBeNull();
  expect(checkpoint.nights[0]?.bodyChosen).toBe(false);
  expect(choice.isCurrent()).toBe(false);
});
