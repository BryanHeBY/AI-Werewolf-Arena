/**
 * 单元测试负责四族首夜数据所有者的晚读取、取消和部分写入前缀。
 * 输入为原数据形状、受控 setter／descriptor 故障和原生命组件；顺序、错误对象和字段预期均为手写字面。
 * 这些数据命令不授予窗口许可，受控绑定不冒真实生命周期集成；原公开工具／选择场景另作精准验证。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "../../../src/core/domain/identity";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import { THIEF_POLICY, initializeThiefState } from "../../../src/game/mechanisms/roles/thief/state-ports";
import { SHAPESHIFTER_POLICY, cancelShapeshifterState } from "../../../src/game/mechanisms/roles/shapeshifter/state-ports";
import { freshWildChildState, commitWildChildState } from "../../../src/game/mechanisms/roles/wild_child/state-slot";
import { freshLonelyGirlState, cancelLonelyGirlState } from "../../../src/game/mechanisms/roles/lonely_girl/state-slot";
import type { WildChildReadState } from "@ai-werewolf-arena/game-contract";
import type { NightLifeScope } from "../../../src/core/domain/night_effects";

test("thief initialization obtains assignment container before deferred policy failure", () => {
  const trace: string[] = [], container: Record<string, unknown> = {}, failure = new Error("policy_failure");
  const role = { role: Role.Thief, get privateState() { trace.push("container"); return container; } };
  let thrown: unknown;
  try { initializeThiefState(role, (): typeof THIEF_POLICY => { trace.push("policy"); throw failure; }); }
  catch (error) { thrown = error; }
  expect(thrown).toBe(failure);
  expect(trace).toEqual(["container", "policy"]);
  expect(Object.hasOwn(container, "thief")).toBe(false);
});

test("shapeshifter cancellation keeps first payment when the second write fails", () => {
  const trace: string[] = [], failure = new Error("choice_write_failure");
  const raw = { policy: SHAPESHIFTER_POLICY, remaining: 1 as 0 | 1, choice: 1 as 0 | 1 | null };
  const state = new Proxy(raw, {
    getOwnPropertyDescriptor(target, key) { trace.push(`descriptor:${String(key)}`); return Reflect.getOwnPropertyDescriptor(target, key); },
    set(target, key, value) { trace.push(`write:${String(key)}`); if (key === "choice") throw failure; return Reflect.set(target, key, value); },
  });
  let thrown: unknown;
  try { cancelShapeshifterState(state); } catch (error) { thrown = error; }
  expect(thrown).toBe(failure);
  expect(trace).toEqual(["descriptor:remaining", "descriptor:choice", "write:remaining", "write:choice"]);
  expect(raw.remaining).toBe(0);
  expect(raw.choice).toBe(1);
});

test("wild child writes model before encoded expectation failure without undoing choice", () => {
  const trace: string[] = [], state = freshWildChildState(), failure = new Error("expected_write_failure");
  const model: NightLifeScope = { id: 2, life: createAliveComponent(), version: 0 };
  const choice = { day: 1 as const, targetId: 2 };
  let savedModel: NightLifeScope | null = null, expected = "before";
  const b = {
    state: state as WildChildReadState,
    get model() { return savedModel; },
    set model(value: NightLifeScope | null) { trace.push("model:write"); savedModel = value; },
    get expectedState() { return expected; },
    set expectedState(value: string) { trace.push("expected:write"); expect(value).toBe('{"policy":"awa_lui_meme_wild_child_v1","remaining":0,"status":"chosen","choice":{"day":1,"targetId":2},"eligibleNight":null,"activeFromNight":null}'); throw failure; },
  };
  let thrown: unknown;
  try { commitWildChildState(b, choice, () => { trace.push("model:read"); return model; }); }
  catch (error) { thrown = error; }
  expect(thrown).toBe(failure);
  expect(trace).toEqual(["model:read", "model:write", "expected:write"]);
  expect(state.remaining).toBe(0);
  expect(state.status).toBe("chosen");
  expect(state.choice).toBe(choice);
  expect(savedModel as NightLifeScope | null).toBe(model);
  expect(expected).toBe("before");
});

test("lonely cancellation defines each writable field and preserves the first on failure", () => {
  const trace: string[] = [], raw = freshLonelyGirlState(), failure = new Error("cancel_choice_failure");
  raw.choice = { day: 1, targetId: 2 };
  const state = new Proxy(raw, {
    getOwnPropertyDescriptor(target, key) { trace.push(`descriptor:${String(key)}`); return Reflect.getOwnPropertyDescriptor(target, key); },
    defineProperty(target, key, descriptor) { trace.push(`define:${String(key)}`); if (key === "choice") throw failure; return Reflect.defineProperty(target, key, descriptor); },
  });
  let thrown: unknown;
  try { cancelLonelyGirlState({ state }); } catch (error) { thrown = error; }
  expect(thrown).toBe(failure);
  expect(trace).toEqual(["descriptor:remaining", "define:remaining", "descriptor:choice", "define:choice"]);
  expect(raw.remaining).toBe(0);
  expect(raw.choice).toEqual({ day: 1, targetId: 2 });
});
