/**
 * 负责板子不可变所有权单元测试；输入为字面配置、属性描述符 canary 和受控双处理器夜晚。
 * 输出由手写冻结、身份、拒绝与平票预期核对，区分原动态更改与显式固定参数策略。
 * 不调用模型、私有配置或完整对局。
 */
import { expect, test } from "bun:test";
import { Role, type ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { BoardParameters, bindBoardParameters } from "../../../src/rulesets/board-parameters";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { NightPipeline } from "../../../src/engine/phases/night-pipeline";
import { NightStageRegistry } from "../../../src/rulesets/night-stage-plan";
import type { NightStageHandler } from "../../../src/engine/night/contracts";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { createRandom } from "../../../src/domain/random";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { type ReproductionMetadata } from "../../../src/recording/reproduction/format";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import { beginGameReproduction } from "../../../src/app/simulation/reproduction-context";
import { fragrantPairSeerTwelveConfig } from "../../../src/rulesets/presets/fragrant-pair-seer-twelve";

/** Compile-only: the execution view exposes no nested board mutation. */
function readonlyViewTypes(board: ReadonlyBoardConfig) {
  // @ts-expect-error Owned runtime rules cannot replace a top-level parameter.
  board.enableSheriff = true;
  // @ts-expect-error Owned runtime rules cannot append role rows.
  board.roleSetups.push({ role: Role.Wolf, count: 1 });
  // @ts-expect-error Owned runtime rules cannot change a role-row count.
  board.roleSetups[0]!.count = 7;
  // @ts-expect-error Owned runtime rules cannot change a nested tie policy.
  board.tieBreaker!.wolfKillVote = "no_kill";
}

test("owned data freezes deeply while caller and detached archive DTO stay mutable", () => {
  const input = structuredClone(sixPlayerMvpConfig);
  input.winCondition = undefined;
  const parameters = BoardParameters.compile(input),
    before = structuredClone(input);
  expect(parameters.board).toEqual(before);
  expect(Object.hasOwn(parameters.board, "winCondition")).toBe(true);
  expect(Object.isFrozen(parameters.board)).toBe(true);
  expect(Object.isFrozen(parameters.board.roleSetups)).toBe(true);
  expect(Object.isFrozen(parameters.board.roleSetups[0])).toBe(true);
  expect(Object.isFrozen(input)).toBe(false);
  expect(Object.isFrozen(input.roleSetups)).toBe(false);
  input.roleSetups[0]!.count = 3;
  const encoded = parameters.encode();
  encoded.roleSetups[0]!.count = 9;
  expect(parameters.board.roleSetups[0]!.count).toBe(2);
  expect(encoded).not.toBe(parameters.board);
});

test("one World identity accepts same/equal data and refuses implicit parameter revision", () => {
  const worldIdentity = {},
    input = structuredClone(sixPlayerMvpConfig),
    first = bindBoardParameters(worldIdentity, input);
  expect(bindBoardParameters(worldIdentity, first.board)).toBe(first);
  expect(bindBoardParameters(worldIdentity, structuredClone(input))).toBe(first);
  input.enableSheriff = true;
  expect(() => bindBoardParameters(worldIdentity, input)).toThrow(
    "rule_parameters_revision_not_supported",
  );
  expect(bindBoardParameters(worldIdentity, first.board)).toBe(first);
});

test("unused known getter and hostile data are refused without evaluating getters or proxies", () => {
  let reads = 0,
    traps = 0;
  const input = structuredClone(sixPlayerMvpConfig);
  Object.defineProperty(input, "cupid", {
    enumerable: true,
    get() {
      reads++;
      throw new Error("unused_getter_never_invoked");
    },
  });
  // Before-policy evidence accepted this exact known unused getter with zero reads.
  expect(() => bootstrapGame(input)).toThrow("rule_parameters_not_data");
  const proxy = new Proxy(structuredClone(sixPlayerMvpConfig), {
    getPrototypeOf() {
      traps++;
      throw new Error("proxy_not_reflected");
    },
    ownKeys() {
      traps++;
      throw new Error("proxy_not_reflected");
    },
  });
  expect(() => BoardParameters.compile(proxy)).toThrow("rule_parameters_not_data");
  const iterator = structuredClone(sixPlayerMvpConfig);
  Object.defineProperty(iterator.roleSetups, Symbol.iterator, {
    get() {
      reads++;
      throw new Error("array_iterator_not_invoked");
    },
  });
  expect(() => BoardParameters.compile(iterator)).toThrow("rule_parameters_not_data");
  expect(reads).toBe(0);
  expect(traps).toBe(0);
});

test("actual night uses bound parameters across await and rejects the changed next-night input", async () => {
  const input = structuredClone(sixPlayerMvpConfig);
  input.tieBreaker = { wolfKillVote: "min_id" };
  const game = bootstrapGame(input, { random: createRandom("literal-owned-night") });
  let started!: () => void, release!: () => void;
  const atAwait = new Promise<void>((resolve) => (started = resolve)),
    resumed = new Promise<void>((resolve) => (release = resolve));
  const observed: (number | null)[] = [];
  class Controlled extends NightStageRegistry {
    override getStages(): NightStageHandler[] {
      return [
        {
          id: "before",
          priority: 1,
          async execute(ctx) {
            observed.push(ctx.pickMajorityTarget({ 5: 1, 6: 1 }));
            started();
            await resumed;
          },
        },
        {
          id: "after",
          priority: 2,
          async execute(ctx) {
            observed.push(ctx.pickMajorityTarget({ 5: 1, 6: 1 }));
          },
        },
      ];
    }
  }
  const pipeline = new NightPipeline({
    world: game.world,
    events: [],
    toolGateway: new ToolGateway(),
    damageResolutionSystem: new DamageResolutionSystem(),
    stageRegistry: new Controlled(),
    random: createRandom("literal-owned-stage"),
  });
  const execution = pipeline.execute(
    input,
    {
      async getAction() {
        return null;
      },
    },
    1,
  );
  await atAwait;
  input.tieBreaker.wolfKillVote = "no_kill";
  release();
  const result = await execution;
  // The identical before-policy input produced [5, null]; fixed owned parameters produce [5, 5].
  expect(observed).toEqual([5, 5]);
  expect(result.interrupted).toBe(false);
  expect(game.boardConfig.tieBreaker!.wolfKillVote).toBe("min_id");
  await expect(
    pipeline.execute(
      input,
      {
        async getAction() {
          return null;
        },
      },
      2,
    ),
  ).rejects.toThrow("rule_parameters_revision_not_supported");
});

test("factory authenticity refuses forged prototype owners and JavaScript constructor bypass", () => {
  let reads = 0;
  const spoof = Object.create(BoardParameters.prototype);
  Object.defineProperty(spoof, "board", {
    get() {
      reads++;
      return sixPlayerMvpConfig;
    },
  });
  expect(() => bindBoardParameters({}, spoof)).toThrow("rule_parameters_not_data");
  expect(reads).toBe(0);
  const unchecked = { ...structuredClone(sixPlayerMvpConfig), boardSize: -1 };
  expect(() => Reflect.construct(BoardParameters, [unchecked])).toThrow(
    "rule_parameters_constructor_forbidden",
  );
  expect(Object.isFrozen(unchecked)).toBe(false);
});

test("native writer uses the World owner and refuses foreign context aliases before recording", () => {
  const input = structuredClone(sixPlayerMvpConfig);
  input.tieBreaker = { wolfKillVote: "min_id" };
  const context = bootstrapGame(input, { random: createRandom("literal-context-owner") });
  input.tieBreaker.wolfKillVote = "no_kill";
  const foreign = BoardParameters.compile(input);
  let captures = 0;
  const manager: SessionRecordManager = Object.create(SessionRecordManager.prototype);
  Object.defineProperty(manager, "beginReproduction", {
    value(metadata: ReproductionMetadata) {
      captures++;
      return new ReproductionTrace(metadata, () => {});
    },
  });
  const options = {
    engine: { id: "awa-engine" as const, sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
    boardId: "six_player_mvp",
    locale: "zh-CN" as const,
    maxDays: 1,
  };
  const trace = beginGameReproduction(manager, context, options);
  expect(trace.build().metadata.normalizedBoard.tieBreaker!.wolfKillVote).toBe("min_id");
  expect(() => Object.defineProperty(context, "parameters", { value: foreign })).toThrow();
  expect(() =>
    Object.defineProperty(context.parameters, "board", { value: foreign.board }),
  ).toThrow();
  for (const forged of [
    { ...context, parameters: foreign },
    { ...context, boardConfig: foreign.board },
  ]) {
    expect(() => beginGameReproduction(manager, forged, options)).toThrow(
      "rule_parameters_context_mismatch",
    );
  }
  expect(captures).toBe(1);
});

test("board schema keeps its existing zero-count row capacity beyond generic event limits", () => {
  const input = structuredClone(sixPlayerMvpConfig);
  input.roleSetups.push(...Array.from({ length: 257 }, () => ({ role: Role.Wolf, count: 0 })));
  expect(BoardParameters.compile(input).board.roleSetups.length).toBe(261);
});

test("legacy family rejection stays first while unreadable dispatch structures fail explicitly", () => {
  for (const deathActionPolicy of ["awa_knife_or_exile_v1", "awa_day_deaths_v1"]) {
    const input = {
      ...structuredClone(fragrantPairSeerTwelveConfig),
      hunter: { deathActionPolicy },
    };
    expect(() => BoardParameters.compile(input)).toThrow("fragrant_pair_seer_preset_invalid");
  }
  for (const input of [
    {},
    { ...structuredClone(sixPlayerMvpConfig), roleSetups: [null] },
    { ...structuredClone(sixPlayerMvpConfig), roleSetups: {} },
    { ...structuredClone(sixPlayerMvpConfig), winConditions: {} },
  ]) {
    expect(() => BoardParameters.compile(input)).toThrow("rule_parameters_invalid");
  }
});
