/**
 * 单元测试：验证 Pair 完整槽贡献真实接到安装、写入、失效和检查点读取。
 * 输入为原角色／authority 内存 fixture、手写历史及可控 JSON 字段错误；输出断言为字面归档和引用／错误前缀。
 * 独立预期不调用生产结算构造，不启动完整对局、传输、模型或文件持久化。
 * schema 保留原 Node 拒绝范围，codec 保留 JSON 访问顺序；失败快照不获得当前行动权限。
 * 规则边界见 docs/expansion/rules/awa-fragrant-pair-seer-twelve-v1.md。
 */
import { expect, test } from "bun:test";
import type { PairSeerState } from "@ai-werewolf-arena/game-contract";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import {
  freshPairSeerState,
  readPairSeerState,
} from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/state";
import {
  PAIR_STATE_SLOT_CONTRACT,
  installPairStateSlot,
  commitPairStateSlot,
  type PairStateSlot,
} from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/pair-state-slot";
import {
  openPairCheckChoice,
  fragrantAuthoritySnapshot,
  fragrantCheckpointPrivateState,
} from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";
import { fragrantPairOwnerFixture } from "../../../engine/fragrant_pair_seer_fixture";

test("Pair contribution uses the original schema, factory and sole append writer", () => {
  expect(PAIR_STATE_SLOT_CONTRACT.create).toBe(freshPairSeerState);
  expect(PAIR_STATE_SLOT_CONTRACT.schema).toBe(readPairSeerState);
  expect(PAIR_STATE_SLOT_CONTRACT.allowedWrites.appendCheck).toBe(commitPairStateSlot);
  expect(Object.keys(PAIR_STATE_SLOT_CONTRACT.allowedWrites)).toEqual(["appendCheck"]);
  expect(Object.isFrozen(PAIR_STATE_SLOT_CONTRACT)).toBe(true);
  let reads = 0;
  const malformed = {
    policy: "awa_fragrant_pair_seer_v1",
    get history() {
      reads++;
      return [];
    },
  };
  expect(PAIR_STATE_SLOT_CONTRACT.schema(malformed)).toBeNull();
  expect(reads).toBe(0);
  expect(
    PAIR_STATE_SLOT_CONTRACT.schema({ policy: "awa_fragrant_pair_seer_v1", history: [], extra: 1 }),
  ).toBeNull();
});

test("actual authority writes one native slot and emits detached compatible checkpoint data", () => {
  const f = fragrantPairOwnerFixture(),
    ability = findNightAbility(f.role(5), "pair_check")!,
    originalState = ability.state;
  f.open();
  openPairCheckChoice(f.world, 1).commit([2, 6]);
  const checkpoint = fragrantCheckpointPrivateState(f.world, 5, true)!;
  expect(ability.state).toBe(originalState);
  expect((f.role(5).privateState as { readonly pairSeer: unknown }).pairSeer).toBe(originalState);
  expect(Object.keys(checkpoint)).toEqual(["abilities", "pairSeer"]);
  expect(checkpoint.pairSeer).toEqual({
    policy: "awa_fragrant_pair_seer_v1",
    history: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
  });
  expect(checkpoint.pairSeer).not.toBe(originalState);
  expect(checkpoint.abilities?.["native:pair_check"]).toMatchObject({ uses: 1, lastUsedDay: 1 });
  Object.defineProperty(checkpoint.pairSeer!, "history", { value: [] });
  expect(originalState.history).toEqual([{ day: 1, targetIds: [2, 6], containsWerewolf: true }]);
  expect(fragrantAuthoritySnapshot(f.world).pairSeer).toEqual({
    policy: "awa_fragrant_pair_seer_v1",
    history: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
  });
});

test("Pair alias or payload edits revoke full reads while failed checkpoints keep committed data", () => {
  for (const change of ["alias", "history"] as const) {
    const f = fragrantPairOwnerFixture();
    if (change === "alias") {
      Object.defineProperty(f.role(5).privateState, "pairSeer", { value: freshPairSeerState() });
    } else {
      Object.defineProperty(findNightAbility(f.role(5), "pair_check")!.state, "history", {
        value: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
      });
    }
    expect(() => fragrantCheckpointPrivateState(f.world, 5, true)).toThrow(
      "fragrant_owner_revoked",
    );
    expect(fragrantCheckpointPrivateState(f.world, 5, false)?.pairSeer).toEqual({
      policy: "awa_fragrant_pair_seer_v1",
      history: [],
    });
  }
});

test("checkpoint codec preserves JSON method lookup before lazy fields without new schema reads", () => {
  const parse = Object.getOwnPropertyDescriptor(JSON, "parse")!,
    trace: string[] = [];
  try {
    Object.defineProperty(JSON, "parse", {
      configurable: true,
      get: () => {
        trace.push("parse");
        return parse.value as typeof JSON.parse;
      },
    });
    expect(
      PAIR_STATE_SLOT_CONTRACT.checkpoint.decode(() => {
        trace.push("field");
        return '{"policy":"awa_fragrant_pair_seer_v1","history":[]}';
      }),
    ).toEqual({ policy: "awa_fragrant_pair_seer_v1", history: [] });
  } finally {
    Object.defineProperty(JSON, "parse", parse);
  }
  expect(trace).toEqual(["parse", "field"]);
  const state: PairSeerState = {
    policy: "awa_fragrant_pair_seer_v1",
    get history() {
      trace.push("history");
      return [];
    },
  };
  expect(PAIR_STATE_SLOT_CONTRACT.checkpoint.encode(state)).toBe(
    '{"policy":"awa_fragrant_pair_seer_v1","history":[]}',
  );
  expect(trace).toEqual(["parse", "field", "history"]);
});

test("append writer keeps state-before-JSON-error and leaves the resource use unpaid", () => {
  const role = createRoleComponent(Role.AwakenedSeer, Camp.Good);
  installPairStateSlot(role);
  const ability = findNightAbility(role, "pair_check")!,
    failure = Error("pair_json_field_failed"),
    oldAbilityJson = JSON.stringify(ability),
    slot: PairStateSlot = {
      pairState: ability.state,
      pairAbility: ability,
      pairAbilityJson: oldAbilityJson,
      set pairJson(_value: string) {
        throw failure;
      },
    },
    next: PairSeerState = {
      policy: "awa_fragrant_pair_seer_v1",
      history: [{ day: 1, targetIds: [2, 6], containsWerewolf: true }],
    };
  expect(() => PAIR_STATE_SLOT_CONTRACT.allowedWrites.appendCheck(slot, next, 1)).toThrow(failure);
  expect(ability.state.history).toBe(next.history);
  expect(ability.uses).toBe(0);
  expect(ability.lastUsedDay).toBeNull();
  expect(slot.pairAbilityJson).toBe(oldAbilityJson);
});
