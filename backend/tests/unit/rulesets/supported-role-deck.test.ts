/**
 * 单元测试验证有限牌组 owner 的字面板子、精确底牌与只读查询轨迹。手写拒绝、额外牌、复制和查询顺序是预期；少量 bootstrap 用例验证原 locale／fork／拒绝／抽样时点，不推进阶段、读私有配置或调用模型。
 */
import { expect, test } from "bun:test";
import { Camp, Role, WinCondition, type BoardConfig } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame, type BootstrapOptions } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import type { RandomSource } from "../../../src/domain/random";
import {
  getDefaultRoleCatalog,
  getDefaultRoleContributions,
} from "../../../src/game/mechanisms/roles/role-catalog-assembly";
import { supportsWallRoles } from "../../../src/game/mechanisms/events/wall_notes/authority";
import {
  buildSupportedRoleDeck,
  type SupportedRoleDeckCatalog,
} from "../../../src/rulesets/supported-role-deck";

const board = (): BoardConfig => ({
  boardSize: 6,
  enableSheriff: false,
  winConditions: [WinCondition.SlaughterCity, WinCondition.WolfReachHalf],
  hooks: {
    onDaybreak: false,
    onPreElection: false,
    onPreVote: false,
    onPerSpeechGap: false,
  },
  roleSetups: [
    { role: Role.Wolf, count: 2 },
    { role: Role.Villager, count: 2 },
    { role: Role.Seer, count: 1 },
    { role: Role.Guard, count: 1 },
  ],
});
const cards = [Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard];
const supported = (config: BoardConfig, fixed?: readonly Role[]) =>
  buildSupportedRoleDeck(config, fixed, getDefaultRoleCatalog, supportsWallRoles);

/** Compile-only: metadata contributors expose reads, not mutation or runtime assembly. */
function readPortTypes(catalog: SupportedRoleDeckCatalog) {
  // @ts-expect-error The support owner cannot assign a profile's configured count limit.
  catalog.requireMetadata(Role.Wolf).maxCount = 2;
  // @ts-expect-error The support owner cannot mutate supported-role metadata.
  catalog.requireMetadata(Role.Wolf).supportedBoardRoles!.push(Role.Wolf);
  // @ts-expect-error The support owner cannot replace the catalog's query method.
  catalog.requireMetadata = () => ({});
}

test("supported assembly returns original ordered cards and does not mutate inputs or profiles", () => {
  const config = board(),
    before = structuredClone(config),
    catalog = getDefaultRoleCatalog(),
    profile = catalog.requireMetadata(Role.Wolf);
  expect(supported(config)).toEqual(cards);
  expect(config).toEqual(before);
  expect(catalog.requireMetadata(Role.Wolf)).toBe(profile);
  expect(getDefaultRoleContributions().length).toBe(55);
});

test("catalog factory and require calls retain both original passes and query receiver", () => {
  const trace: string[] = [],
    metadata = {};
  const catalog: SupportedRoleDeckCatalog = {
    requireMetadata(role) {
      expect(this).toBe(catalog);
      trace.push(`require:${role}`);
      return metadata;
    },
    getCamp() {
      throw new Error("no_camp_query_for_ordinary_deck");
    },
  };
  const factory = () => {
    trace.push("catalog");
    return catalog;
  };
  expect(buildSupportedRoleDeck(board(), undefined, factory, supportsWallRoles)).toEqual(cards);
  expect(trace).toEqual([
    "catalog",
    "require:wolf",
    "catalog",
    "require:villager",
    "catalog",
    "require:seer",
    "catalog",
    "require:guard",
    "catalog",
    "require:wolf",
    "catalog",
    "require:villager",
    "catalog",
    "require:seer",
    "catalog",
    "require:guard",
  ]);
  expect(Object.isFrozen(metadata)).toBe(false);
});

test("event support rejects before catalog reads and receives the same built card sequence", () => {
  let catalogCalls = 0;
  const observed: (readonly Role[])[] = [];
  expect(() =>
    buildSupportedRoleDeck(
      { ...board(), events: { pack: "awa_wall_notes_once_v1" } },
      undefined,
      () => {
        catalogCalls++;
        throw new Error("catalog_must_remain_unread");
      },
      (deck) => {
        observed.push(deck);
        return false;
      },
    ),
  ).toThrow("event_pack_combination_not_supported");
  expect(catalogCalls).toBe(0);
  expect(observed).toEqual([cards]);
});

test("literal preset, count, goal, combination, size and fixed-deck refusals keep their codes", () => {
  const cases: [config: BoardConfig, message: string, fixed?: readonly Role[]][] = [
    [
      { ...board(), roleSetups: [{ role: Role.NightNoble, count: 1 }] },
      "noble_secret_body_preset_invalid",
    ],
    [
      {
        ...board(),
        roleSetups: [
          { role: Role.Bear, count: 2 },
          { role: Role.Wolf, count: 2 },
          { role: Role.Villager, count: 2 },
        ],
      },
      "role_count_exceeds_limit: bear",
    ],
    [
      {
        ...board(),
        winConditions: [WinCondition.WolfReachHalf],
        roleSetups: [
          { role: Role.CursedFox, count: 1 },
          { role: Role.Wolf, count: 2 },
          { role: Role.Villager, count: 3 },
        ],
      },
      "role_win_condition_not_supported: cursed_fox",
    ],
    [
      {
        ...board(),
        winConditions: [WinCondition.SlaughterCity],
        roleSetups: [
          { role: Role.CursedFox, count: 1 },
          { role: Role.MechanicalWolf, count: 1 },
          { role: Role.Wolf, count: 1 },
          { role: Role.Villager, count: 3 },
        ],
      },
      "role_combination_not_supported: cursed_fox",
    ],
    [{ ...board(), boardSize: 5 }, "Role setup mismatch: boardSize=5, roles=6"],
    [board(), "fixed_role_deck_mismatch", Array(6).fill(Role.Wolf)],
  ];
  for (const [config, message, fixed] of cases) {
    expect(() => supported(config, fixed)).toThrow(message);
  }
});

test("Thief and Shapeshifter append two literal villagers before exact fixed-card validation", () => {
  for (const role of [Role.Thief, Role.Shapeshifter]) {
    const config: BoardConfig = {
      ...board(),
      winConditions: [WinCondition.SlaughterCity],
      roleSetups: [
        { role, count: 1 },
        { role: Role.Wolf, count: 2 },
        { role: Role.Villager, count: 2 },
        { role: Role.Seer, count: 1 },
      ],
    };
    const expected = [
      role,
      Role.Wolf,
      Role.Wolf,
      Role.Villager,
      Role.Villager,
      Role.Seer,
      Role.Villager,
      Role.Villager,
    ];
    expect(supported(config)).toEqual(expected);
    expect(() => supported(config, expected.slice(0, 6))).toThrow("fixed_role_deck_mismatch");
    const fixed = Object.freeze([...expected].reverse()),
      actual = supported(config, fixed);
    expect<readonly Role[]>(actual).toEqual(fixed);
    expect(actual).not.toBe(fixed);
    expect(Object.isFrozen(actual)).toBe(false);
  }
});

function tracedRandom(trace: string[], forkFailure?: Error): RandomSource {
  const random: RandomSource = {
    metadata: {
      seed: "literal",
      algorithm: "mulberry32-fnv1a-utf16-v1",
      streamPolicy: "named-path-v1",
      path: [],
    },
    next() {
      trace.push("draw");
      return 0;
    },
    fork(name) {
      trace.push(`fork:${name}`);
      if (forkFailure) throw forkFailure;
      return random;
    },
  };
  return random;
}

test("actual bootstrap retains fixed/random selection, original initialization and deal draw position", () => {
  for (const mode of ["fixed", "random"] as const) {
    const trace: string[] = [],
      random = tracedRandom(trace),
      config = board(),
      rows = config.roleSetups,
      fixed = [Role.Wolf, Role.Seer, Role.Villager, Role.Wolf, Role.Guard, Role.Villager];
    Object.defineProperty(config, "roleSetups", {
      get() {
        trace.push("roleSetups");
        return rows;
      },
    });
    const options: BootstrapOptions = {
      get locale(): BootstrapOptions["locale"] {
        trace.push("locale");
        return "en";
      },
      get random() {
        trace.push("random");
        return random;
      },
      get fixedRoles() {
        trace.push("fixedRoles");
        return mode === "fixed" ? fixed : undefined;
      },
    };
    // Same original getter input is now refused before invocation at the owned-data boundary.
    // The fixed/random initialization and 18-read before-policy traces remain in Git7e59ee68
    // and /tmp/awa-c21-supported-deck-bootstrap-before.json; no fixture input is replaced.
    expect(() => bootstrapGame(config, options)).toThrow("rule_parameters_not_data");
    expect(trace).toEqual(["locale", "random", "fixedRoles", "fork:deal"]);
  }
});

test("actual bootstrap rejects after deal fork without any random draw", () => {
  const trace: string[] = [],
    random = tracedRandom(trace);
  const config = board(),
    rows = config.roleSetups;
  config.boardSize = 5;
  Object.defineProperty(config, "roleSetups", {
    get() {
      trace.push("roleSetups");
      return rows;
    },
  });
  // Preserve the original accessor input; data refusal now precedes its old size error.
  expect(() => bootstrapGame(config, { random })).toThrow("rule_parameters_not_data");
  expect(trace).toEqual(["fork:deal"]);
});

test("original locale and fork failures precede support queries and preserve error identity", () => {
  for (const stage of ["locale", "fork"] as const) {
    const trace: string[] = [],
      failure = new Error(`literal_${stage}`),
      random = tracedRandom(trace, failure),
      config = board();
    Object.defineProperty(config, "roleSetups", {
      get() {
        trace.push("unexpected_support_read");
        throw new Error("support_not_reached");
      },
    });
    const options: BootstrapOptions = {
      get locale(): BootstrapOptions["locale"] {
        trace.push("locale");
        if (stage === "locale") throw failure;
        return "en";
      },
      get random() {
        trace.push("random");
        return random;
      },
      get fixedRoles() {
        trace.push("fixedRoles");
        return undefined;
      },
    };
    let caught: unknown;
    try {
      bootstrapGame(config, options);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(trace).toEqual(
      stage === "locale" ? ["locale"] : ["locale", "random", "fixedRoles", "fork:deal"],
    );
  }
});
