/**
 * 单元测试两种真实 profile 的初态安装顺序。输入为原角色容器、板子政策 getter 和受控槽 setter；
 * 独立字面轨迹、初态字段与同一 Error 为预期，验证左值先读取及失败时不补偿，不复制安装算法。
 * 只调用实际 init，不装配整局、运行夜能力或更新权威审计影子。
 */
import { expect, test } from "bun:test";
import { Camp, Role } from "../../../../src/core/domain/identity";
import type { RoleInitializationComponent, RoleInitContext } from "../../../../src/game/mechanisms/roles/contracts";
import { NIGHT_NOBLE_ROLE_PROFILE, AWAKENED_IDIOT_ROLE_PROFILE } from "../../../../src/game/mechanisms/roles/noble_secret_body/profile";
import { sixPlayerMvpConfig } from "../../../../src/runtime/scenarios/six_player_mvp";

const cases = [
  { profile: NIGHT_NOBLE_ROLE_PROFILE, role: Role.NightNoble, slot: "noble", configuration: "nightNoble", policy: "wolfActionPolicy", selected: "no_blast_no_self_knife" },
  { profile: AWAKENED_IDIOT_ROLE_PROFILE, role: Role.AwakenedIdiot, slot: "secretBody", configuration: "awakenedIdiot", policy: "protectionRepeatPolicy", selected: "awa_repeat_v1" },
] as const;

/** 原初始化上下文的阵营字段保留；这里只观察配置的晚读取，不依赖当前阵营查询推导预期。 */
function context(boardConfig: RoleInitContext["boardConfig"]): RoleInitContext {
  return { initialCamp: { camp: Camp.Good }, currentCamp: () => ({ camp: Camp.Good }), boardConfig };
}

test("both profile initializers read the original container before a throwing board or policy getter", () => {
  for (const item of cases) for (const point of ["board", "policy"] as const) {
    const trace: string[] = [], error = new Error("literal_install_policy_read_failure"), container: Record<string, unknown> = {};
    Object.defineProperty(container, item.slot, { set() { trace.push("write"); }, configurable: true });
    const role: RoleInitializationComponent = { role: item.role, get privateState() { trace.push("container"); return container; } };
    const selected: Record<string, unknown> = {};
    Object.defineProperty(selected, item.policy, { enumerable: true, get() { trace.push("policy"); throw error; } });
    const board = { ...sixPlayerMvpConfig };
    Object.defineProperty(board, item.configuration, { enumerable: true, get() { trace.push("board"); if (point === "board") throw error; return selected; } });
    let actual: unknown;
    try { item.profile.runtime.init!(role, context(board)); } catch (failure) { actual = failure; }
    expect(actual).toBe(error);
    expect(trace).toEqual(point === "board"
      ? ["container", "board"]
      : ["container", "board", "policy"]);
    expect(Object.getOwnPropertyDescriptor(container, item.slot)!.get).toBeUndefined();
    expect(Object.keys(container)).toEqual([]);
  }
});

test("both initializers send literal selected initial data to the original setter once and retain its Error", () => {
  for (const item of cases) {
    const trace: string[] = [], error = new Error("literal_install_slot_write_failure");
    let received: unknown;
    const container: Record<string, unknown> = {};
    Object.defineProperty(container, item.slot, { configurable: true, set(value) { trace.push("write"); received = value; throw error; } });
    const role: RoleInitializationComponent = { role: item.role, get privateState() { trace.push("container"); return container; } };
    const selected: Record<string, unknown> = { [item.policy]: item.selected };
    const board = { ...sixPlayerMvpConfig };
    Object.defineProperty(board, item.configuration, { enumerable: true, get() { trace.push("board"); return selected; } });
    let actual: unknown;
    try { item.profile.runtime.init!(role, context(board)); } catch (failure) { actual = failure; }
    expect(actual).toBe(error);
    expect(trace).toEqual(["container", "board", "write"]);
    expect(received).toEqual(item.slot === "noble"
      ? { policy: "awa_noble_secret_body_v1", wolfActionPolicy: "no_blast_no_self_knife", lastChoice: null, contracts: [] }
      : { policy: "awa_noble_secret_body_v1", protectionRepeatPolicy: "awa_repeat_v1", lastChoice: null, body: { kind: "intact" } });
    expect(role.role).toBe(item.role);
    expect(Object.keys(container)).toEqual([]);
  }
});
