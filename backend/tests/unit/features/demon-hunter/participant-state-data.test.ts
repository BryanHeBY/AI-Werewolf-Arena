/**
 * 单元测试验证猎魔参与者数据 owner 的原引用、晚编码和失败前缀。输入为真实角色／原生库存工厂
 * 与手写委托数据、JSON／字段错误探针；预期是独立字面字段、读取轨迹、同 Error 和原引用断言。
 * 只调用已通过外层权限后使用的数据步骤，不模拟 World／lease 许可，不写档案或运行模型。
 * 全局 JSON 探针在 finally 恢复；实际资格、冻结和完整流程仍由原 authority 精准案例覆盖。
 */
import { expect, test } from "bun:test";
import { Role } from "../../../../src/domain/identity";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { installNativeAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import {
  captureDemonParticipantPrivateData, captureDemonNativeAuditData,
  commitDemonNativeParticipantData, committedPrivate, originalInventory,
  commitDemonIdiotParticipantData, type DemonParticipantStateData,
} from "../../../../src/game/mechanisms/roles/demon_hunter/participant-state-data";

function participant(role: ReturnType<typeof createRoleComponent>, id = 1, delegatedKey: DemonParticipantStateData["delegatedKey"] = null) {
  const auditPrivateJson = JSON.stringify(role.privateState);
  return {
    id,
    ...captureDemonParticipantPrivateData(role.privateState, delegatedKey, auditPrivateJson),
    victoryJson: '[{"kind":"faction","faction":"good"}]',
  };
}

test("native Guard writes original resource fields before an encoding failure leaves its safe audit unchanged", () => {
  const role = createRoleComponent(Role.Guard);
  installNativeAbility(role, "guard", { lastTarget: null, repeatPolicy: "netease_consecutive_nights_v1" });
  const ability = findNightAbility(role, "guard", "native:guard")!;
  const p = participant(role), beforeAudit = p.auditPrivateJson,
    data = captureDemonNativeAuditData(p, "native:guard"), live = ability.state,
    failure = new Error("literal_guard_encoding_failure"), trace: string[] = [],
    descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!;
  let caught: unknown, committed = false;
  Object.defineProperty(JSON, "stringify", { configurable: true, value: () => { trace.push("encode"); throw failure; } });
  try {
    commitDemonNativeParticipantData(
      p, data.original, data.abilities, data.snapshot!, data.state!, live, ability,
      "guard", "native:guard", 2, 7, undefined,
      () => { throw new Error("unexpected_guard_camp_read"); }, Array.prototype.push,
      () => { committed = true; },
    );
  } catch (error) { caught = error; }
  finally { Object.defineProperty(JSON, "stringify", descriptor); }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["encode"]);
  expect(live.lastTarget).toBe(7);
  expect(ability.uses).toBe(1);
  expect(ability.lastUsedDay).toBe(2);
  expect(ability.state).toBe(live);
  expect(p.privateState).toBe(role.privateState);
  expect(p.auditPrivateJson).toBe(beforeAudit);
  expect(committed).toBe(false);
  expect(originalInventory(p)).toBe(true);
});

test("safe private decoding resolves JSON before the audit getter and only then reads a delegated subtree", () => {
  const role = createRoleComponent(Role.NightNoble), raw = role.privateState as Record<string, unknown>;
  raw.noble = { recorded: "old" };
  raw.extension = { sentinel: "saved" };
  const p = participant(role, 4, "noble"), audit = p.auditPrivateJson,
    currentNoble = { recorded: "new" }, trace: string[] = [],
    descriptor = Object.getOwnPropertyDescriptor(JSON, "parse")!, parse = JSON.parse;
  Object.defineProperty(p, "auditPrivateJson", { configurable: true, get() { trace.push("audit-field"); return audit; } });
  Object.defineProperty(JSON, "parse", { configurable: true, get() {
    trace.push("parse-callee");
    return function(this: unknown, text: string) { trace.push(this === JSON ? "parse-json-receiver" : "wrong-receiver"); return parse(text); };
  } });
  let result!: Record<string, unknown>;
  try {
    result = committedPrivate(p, () => { trace.push("delegate"); return { nobleId: 4, bodyId: 5, noble: currentNoble, body: {} }; });
  } finally { Object.defineProperty(JSON, "parse", descriptor); }
  expect(trace).toEqual(["parse-callee", "audit-field", "parse-json-receiver", "delegate"]);
  expect(result!).toEqual({ noble: { recorded: "new" }, extension: { sentinel: "saved" } });
  expect(result!.noble).toBe(currentNoble);
  expect(raw.noble).toEqual({ recorded: "old" });
  raw.extension = { sentinel: "saved" };
  expect(originalInventory(p)).toBe(false);
  p.delegatedKey = null;
  trace.length = 0;
  const unDelegated = committedPrivate(p, () => { throw new Error("unexpected_delegate_query"); });
  expect(unDelegated).toEqual({ noble: { recorded: "old" }, extension: { sentinel: "saved" } });
  expect(trace).toEqual(["audit-field"]);
  const failure = new Error("literal_parse_lookup_failure");
  Object.defineProperty(JSON, "parse", { configurable: true, get() { throw failure; } });
  let caught: unknown;
  try { committedPrivate(p, () => { throw new Error("unexpected_after_parse_failure"); }); }
  catch (error) { caught = error; }
  finally { Object.defineProperty(JSON, "parse", descriptor); }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["audit-field"]);
});

test("late vote field failure keeps the revealed Idiot and vote prefix without advancing either audit or reference table", () => {
  const role = createRoleComponent(Role.Idiot), raw = role.privateState as { idiot?: { revealed: boolean } };
  raw.idiot = { revealed: false };
  const p = participant(role), beforeAudit = p.auditPrivateJson, beforeRefs = p.privateRefs,
    beforeInventories = p.inventoryRefs, vote = { canVote: true, weight: 1 },
    beforeVote = '{"canVote":true,"weight":1}', cp = { badge: {}, vote, badgeJson: "{}", voteJson: beforeVote },
    failure = new Error("literal_vote_weight_failure"), trace: string[] = [],
    descriptor = Object.getOwnPropertyDescriptor(JSON, "stringify")!, stringify = JSON.stringify;
  let encodes = 0, caught: unknown;
  // 原两个期望串已形成的同一点才安装晚失败；最初可写数据描述符仍是原合法输入。
  Object.defineProperty(JSON, "stringify", { configurable: true, value: (value: unknown) => {
    trace.push("encode");
    const encoded = stringify(value);
    if (++encodes === 2) Object.defineProperty(vote, "weight", { configurable: true,
      get() { return 1; }, set() { trace.push("weight-write"); throw failure; } });
    return encoded;
  } });
  try { commitDemonIdiotParticipantData(p, cp); }
  catch (error) { caught = error; }
  finally { Object.defineProperty(JSON, "stringify", descriptor); }
  expect(caught).toBe(failure);
  expect(trace).toEqual(["encode", "encode", "weight-write"]);
  expect(raw.idiot).toEqual({ revealed: true });
  expect(vote.canVote).toBe(false);
  expect(vote.weight).toBe(1);
  expect(p.auditPrivateJson).toBe(beforeAudit);
  expect(cp.voteJson).toBe(beforeVote);
  expect(p.privateRefs).toBe(beforeRefs);
  expect(p.inventoryRefs).toBe(beforeInventories);
  expect(p.privateState).toBe(role.privateState);
});
