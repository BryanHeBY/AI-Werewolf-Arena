/**
 * 负责单元验证迁出的夜能力投影读取边界。输入为手写来源、可观测 getter 和失败点，
 * 输出由字面读取轨迹、脱离 DTO 与原错误断言核对；不复制生产分支或生成 golden。
 * 投影不写库存或授权，测试不启动 World、对局、模型、实际转移或文件记录。
 */
import { expect, test } from "bun:test";
import { Role, type AbilitySource } from "@ai-werewolf-arena/game-contract";
import type { NightAbilityReadView } from "../../../src/game/mechanisms/roles/abilities";
import {
  projectAbilitySource,
  projectNightAbility,
} from "../../../src/game/observation/night-ability-projection";

for (const scenario of [
  { kind: "native", disclosed: false, reads: ["kind"], expected: { kind: "native" } },
  {
    kind: "native",
    disclosed: true,
    reads: ["kind", "kind", "role"],
    expected: { kind: "native", role: Role.Wolf },
  },
  {
    kind: "gift",
    disclosed: true,
    reads: ["kind", "kind", "kind", "actorId"],
    expected: { kind: "gift", actorId: 2 },
  },
  {
    kind: "copy",
    disclosed: true,
    reads: ["kind", "kind", "kind", "actorId", "abilityId"],
    expected: { kind: "copy", actorId: 2, abilityId: "origin:check" },
  },
  {
    kind: "transfer",
    disclosed: true,
    reads: ["kind", "kind", "kind", "actorId", "abilityId"],
    expected: { kind: "transfer", actorId: 2, abilityId: "origin:check" },
  },
] as const) {
  test(`source ${scenario.kind}/${scenario.disclosed} preserves repeated reads and hidden fields`, () => {
    const trace: string[] = [];
    const origin = {
      get kind() {
        trace.push("kind");
        return scenario.kind;
      },
      get role() {
        trace.push("role");
        if (!scenario.disclosed) throw new Error("hidden_role_read");
        return Role.Wolf;
      },
      get actorId() {
        trace.push("actorId");
        return 2;
      },
      get abilityId() {
        trace.push("abilityId");
        return "origin:check";
      },
    } as AbilitySource;
    expect(projectAbilitySource(origin, scenario.disclosed)).toEqual(scenario.expected);
    expect(trace).toEqual(scenario.reads as unknown as string[]);
  });
}

function observedGuard(trace: string[], failActivation = false): NightAbilityReadView<"guard"> {
  const value: NightAbilityReadView<"guard"> = {
    id: "gift:controlled",
    kind: "guard",
    state: { lastTarget: 3 },
    source: { kind: "gift", actorId: 2 },
    sourceDisclosed: false,
    startsOnDay: 1,
    expiresAfterDay: 5,
    maxUses: 1,
    uses: 0,
    lastUsedDay: null,
    disabled: false,
    activation: "lucky",
    deathExpired: false,
  };
  return new Proxy(value, {
    get(target, key, receiver) {
      trace.push(String(key));
      if (key === "activation" && failActivation) throw failure;
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor(target, key) {
      trace.push(`descriptor:${String(key)}`);
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
}
const failure = new Error("controlled_metadata_read_failure");

test("metadata and status preserve independent descriptor reads before payload projection", () => {
  const trace: string[] = [],
    ability = observedGuard(trace),
    dto = projectNightAbility(ability, 2);
  expect(trace).toEqual([
    "id",
    "source",
    "sourceDisclosed",
    "startsOnDay",
    "expiresAfterDay",
    "expiresAfterDay",
    "maxUses",
    "uses",
    "lastUsedDay",
    "descriptor:nightSuppression",
    "disabled",
    "activation",
    "activation",
    "deathExpired",
    "deathExpired",
    "descriptor:nightSuppression",
    "disabled",
    "deathExpired",
    "startsOnDay",
    "expiresAfterDay",
    "expiresAfterDay",
    "maxUses",
    "uses",
    "maxUses",
    "lastUsedDay",
    "kind",
    "kind",
    "state",
  ]);
  expect(dto).toEqual({
    id: "gift:controlled",
    source: { kind: "gift" },
    startsOnDay: 1,
    expiresAfterDay: 5,
    maxUses: 1,
    uses: 0,
    lastUsedDay: null,
    disabled: false,
    activation: "lucky",
    deathExpired: false,
    status: "active",
    kind: "guard",
    state: { lastTarget: 3 },
  });
  expect(dto.state).not.toBe(ability.state);
});

test("metadata failure retains the exact read prefix without reaching status or payload", () => {
  const trace: string[] = [],
    ability = observedGuard(trace, true);
  expect(() => projectNightAbility(ability, 2)).toThrow(failure);
  expect(trace).toEqual([
    "id",
    "source",
    "sourceDisclosed",
    "startsOnDay",
    "expiresAfterDay",
    "expiresAfterDay",
    "maxUses",
    "uses",
    "lastUsedDay",
    "descriptor:nightSuppression",
    "disabled",
    "activation",
  ]);
});

// 旧函数出口退休；类型 import 被擦除，不让运行单元为 API 反例加载不存在的 value binding。
import type {
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectAbilitySource as OldLeafSource,
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectNightState as OldLeafState,
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectNightAbility as OldLeafAbility,
} from "../../../src/game/mechanisms/roles/abilities";
import type {
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectAbilitySource as OldMechanismsSource,
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectNightState as OldMechanismsState,
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectNightAbility as OldMechanismsAbility,
} from "../../../src/game/mechanisms";
import type {
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectAbilitySource as OldGameSource,
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectNightState as OldGameState,
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectNightAbility as OldGameAbility,
} from "../../../src/game";
import type {
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectAbilitySource as OldBackendSource,
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectNightState as OldBackendState,
  // @ts-expect-error 旧公开观察函数已退休，不能通过类型导入保留桥。
  projectNightAbility as OldBackendAbility,
} from "../../../src";
type RetiredFunctions = [
  typeof OldLeafSource,
  typeof OldLeafState,
  typeof OldLeafAbility,
  typeof OldMechanismsSource,
  typeof OldMechanismsState,
  typeof OldMechanismsAbility,
  typeof OldGameSource,
  typeof OldGameState,
  typeof OldGameAbility,
  typeof OldBackendSource,
  typeof OldBackendState,
  typeof OldBackendAbility,
];
void (null as unknown as RetiredFunctions);
