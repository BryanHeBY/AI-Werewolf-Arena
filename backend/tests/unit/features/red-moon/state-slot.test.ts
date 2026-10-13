/**
 * 单元测试验证赤月使徒数据槽的原接受集合、实际初始化顺序与审计／三写失败前缀。
 * 输入为手写状态、原角色贡献、可观察描述符和 JSON 方法；输出以字面数据、引用及轨迹核对。
 * JSON 方法只在同步用例内临时替换并在 finally 恢复；不生成生产 oracle、不执行模型或完整对局。
 * 写入用例直接检查数据命令，不把它当原体／夜／请求租约或资源付款的授权测试。
 */
import { expect, test } from "bun:test";
import { Camp, Role, type RedMoonState } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../../src/core/domain/components/role";
import type {
  RoleInitContext,
  RoleInitializationComponent,
} from "../../../../src/game/mechanisms/roles/contracts";
import { RED_MOON_ROLE_PROFILE } from "../../../../src/game/mechanisms/roles/red_moon_apostle/profile";
import {
  RED_MOON_STATE_SLOT,
  readRedMoonShadow,
  encodeRedMoonShadow,
  writeRedMoonTransition,
} from "../../../../src/game/mechanisms/roles/red_moon_apostle/state-slot";

const literalState = (): RedMoonState => ({
  policy: "awa_red_moon_demon_v1",
  lastWolfBlastPolicy: "ends_game",
  blastDay: null,
  exileDay: null,
  expirySettled: false,
});

test("schema retains the original readonly and nonenumerable data while rejecting getters and proxies", () => {
  const state = literalState();
  Object.defineProperty(state, "blastDay", { enumerable: false });
  Object.freeze(state);
  const role: RoleComponent = {
    role: Role.RedMoonApostle,
    camp: Camp.Wolf,
    privateState: { redMoon: state },
  };
  expect(RED_MOON_STATE_SLOT.schema(state)).toBe(state);
  expect(RED_MOON_STATE_SLOT.get(role)).toBe(state);
  expect(RED_MOON_STATE_SLOT.invalidations.readCurrent(role)).toBe(state);
  expect(RED_MOON_STATE_SLOT.schema({ ...literalState(), extra: true })).toBeUndefined();
  let reads = 0;
  const accessor = literalState();
  Object.defineProperty(accessor, "exileDay", {
    get() {
      reads++;
      throw new Error("literal_payload_getter");
    },
  });
  expect(RED_MOON_STATE_SLOT.schema(accessor)).toBeUndefined();
  expect(
    RED_MOON_STATE_SLOT.schema(
      new Proxy(literalState(), {
        getOwnPropertyDescriptor() {
          reads++;
          throw new Error("literal_payload_proxy");
        },
      }),
    ),
  ).toBeUndefined();
  expect(reads).toBe(0);
});

test("the real profile reads the installation left side before policy and retains its failure prefix", () => {
  const trace: string[] = [],
    privateState: Record<string, unknown> = {};
  const role: RoleInitializationComponent = {
    role: Role.RedMoonApostle,
    camp: Camp.Wolf,
    get privateState() {
      trace.push("left:privateState");
      return privateState;
    },
  };
  const context: RoleInitContext = {
    get boardConfig() {
      trace.push("right:boardConfig");
      return undefined;
    },
  };
  RED_MOON_ROLE_PROFILE.runtime.init!(role, context);
  expect(trace).toEqual(["left:privateState", "right:boardConfig"]);
  expect(privateState.redMoon).toEqual({
    policy: "awa_red_moon_demon_v1",
    lastWolfBlastPolicy: "ends_game",
    blastDay: null,
    exileDay: null,
    expirySettled: false,
  });
  const failure = new Error("literal_install_left_failure");
  Object.defineProperty(role, "privateState", {
    get() {
      trace.push("left:failure");
      throw failure;
    },
  });
  trace.length = 0;
  expect(() => RED_MOON_ROLE_PROFILE.runtime.init!(role, context)).toThrow(failure);
  expect(trace).toEqual(["left:failure"]);
});

test("shadow codecs capture JSON callees before delayed string or spread reads", () => {
  const parse = JSON.parse,
    stringify = JSON.stringify,
    trace: string[] = [];
  try {
    const decoded = readRedMoonShadow(() => {
      trace.push("read:audit");
      JSON.parse = () => {
        throw new Error("parser_lookup_moved_after_read");
      };
      return '{"other":"retained","redMoon":{"blastDay":null}}';
    });
    expect(decoded).toEqual({ other: "retained", redMoon: { blastDay: null } });
    const original = {
      get other() {
        trace.push("read:spread");
        JSON.stringify = () => {
          throw new Error("stringifier_lookup_moved_after_spread");
        };
        return "retained";
      },
    };
    const encoded = encodeRedMoonShadow(original, literalState());
    expect(encoded).toBe(
      '{"other":"retained","redMoon":{"policy":"awa_red_moon_demon_v1","lastWolfBlastPolicy":"ends_game","blastDay":null,"exileDay":null,"expirySettled":false}}',
    );
    expect(trace).toEqual(["read:audit", "read:spread"]);
  } finally {
    JSON.parse = parse;
    JSON.stringify = stringify;
  }
});

test("three-field write preserves the captured state and the first write if the second rejects", () => {
  const state = literalState(),
    trace: unknown[] = [],
    failure = new Error("literal_second_write_failure");
  let blast: number | null = null;
  Object.defineProperties(state, {
    blastDay: {
      get: () => blast,
      set(value: number | null) {
        trace.push(["write:blast", value]);
        blast = value;
      },
    },
    exileDay: {
      get: () => null,
      set() {
        trace.push("write:exile");
        throw failure;
      },
    },
  });
  const next: RedMoonState = {
    policy: "awa_red_moon_demon_v1",
    lastWolfBlastPolicy: "ends_game",
    get blastDay() {
      trace.push("read:blast");
      return 3;
    },
    get exileDay() {
      trace.push("read:exile");
      return null;
    },
    get expirySettled(): boolean {
      throw new Error("third_field_must_not_be_read");
    },
  };
  expect(() => writeRedMoonTransition(state, next)).toThrow(failure);
  expect(trace).toEqual(["read:blast", ["write:blast", 3], "read:exile", "write:exile"]);
  expect(blast as number | null).toBe(3);
  expect(state.expirySettled).toBe(false);
});
