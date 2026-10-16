/**
 * 本单元测试负责验证 Pi 来源只追加到当前 Tape3，历史 Tape2 仍只接受原两种来源，未知字段与类型继续拒绝。
 * 输入为真实初始化 World 和 Trace 写出的零周期档案；预期是手写来源、版本及精确来源拒绝码。
 * 严格重放只核初始化和已终止的零决定前缀，不冒称执行 Pi、模型工具或完整对局，也不改写冻结档案。
 */
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { bootstrapGame } from "../../../src/app/bootstrap";
import {
  captureCheckpoint,
  currentEngineVersion,
} from "../../../src/app/simulation/reproduction-context";
import { replayReproduction } from "../../../src/app/simulation/replay-reproduction";
import { createRandom } from "../../../src/domain/random";
import {
  parseReproductionRecord,
  type EngineVersion,
  type ReproductionMetadata,
} from "../../../src/recording/reproduction/format";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

function archive(
  kind: "llm" | "acp" | "pi",
  engine: EngineVersion = {
    id: "awa-engine",
    sourceHash: "a".repeat(64),
    lockHash: "b".repeat(64),
  },
) {
  const game = bootstrapGame(sixPlayerMvpConfig, {
    playerNames: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [i + 1, `Player ${i + 1}`]),
    ),
    random: createRandom("pi-metadata-zero-cycle"),
    locale: "en",
  });
  const events = game.phaseManager.getEvents();
  const initial = captureCheckpoint(
    game.world,
    game.phaseManager.getSnapshot(),
    0,
    true,
    events.length,
  );
  const metadata: ReproductionMetadata = {
    engine,
    random: game.random.metadata,
    ruleset: RULESET,
    boardId: "six_player_mvp",
    normalizedBoard: game.rulePlan.encodeParameters(),
    locale: "en",
    maxDays: 1,
    dealMode: game.dealMode,
    players: initial.players.map(({ id, name, role, camp }) => ({
      id,
      name,
      role,
      camp,
      agent: { kind, name: "literal-player", model: "literal-model" },
    })),
  };
  const trace = new ReproductionTrace(metadata, () => {});
  trace.checkpoint(initial, events);
  return {
    snapshot: game.phaseManager.getSnapshot(),
    record: trace.build({
      operations: [],
      termination: { reason: "runtime_timeout", winner: null },
    }),
  };
}

test("无昵称只扩展 Tape3，旧 Tape2 仍要求玩家元数据和 checkpoint 的姓名", () => {
  const { record } = archive("llm");
  const absent = structuredClone(record);
  for (const player of absent.metadata.players) delete player.name;
  for (const checkpoint of absent.checkpoints)
    for (const player of checkpoint.players) delete player.name;
  expect(
    parseReproductionRecord(absent).metadata.players.every(
      (player) => !Object.hasOwn(player, "name"),
    ),
  ).toBe(true);
  expect(() => parseReproductionRecord({ ...absent, schemaVersion: 2 })).toThrow(
    "reproduction_record_invalid",
  );
});

test("Tape3 appends Pi metadata and detaches the exact source without normalizing legacy kinds", () => {
  for (const kind of ["llm", "acp", "pi"] as const) {
    const { record } = archive(kind);
    const input = JSON.parse(JSON.stringify(record));
    const parsed = parseReproductionRecord(input);
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.metadata.players[0]!.agent).toEqual({
      kind,
      name: "literal-player",
      model: "literal-model",
    });
    expect(parsed).toEqual(record);
    expect(parsed.metadata.players[0]!.agent).not.toBe(input.metadata.players[0].agent);
  }
});

test("Tape2 keeps llm and acp admission while rejecting Pi rather than upgrading the old archive", () => {
  for (const kind of ["llm", "acp"] as const) {
    const legacy = { ...archive(kind).record, schemaVersion: 2 as const };
    expect(parseReproductionRecord(legacy)).toEqual(legacy);
  }
  const legacyPi = { ...archive("pi").record, schemaVersion: 2 as const };
  expect(() => parseReproductionRecord(legacyPi)).toThrow("reproduction_record_invalid");
  expect(legacyPi.schemaVersion).toBe(2);
  expect(legacyPi.metadata.players[0]!.agent!.kind).toBe("pi");
});

test("current Pi metadata rejects unknown kinds and additional backend or authentication fields", () => {
  for (const extra of [
    { kind: "future-agent" },
    { backend: "unrecorded-backend" },
    { auth: "private-canary" },
    { sessionFile: "/unapproved/session.json" },
  ]) {
    const { record } = archive("pi");
    Object.assign(record.metadata.players[0]!.agent!, extra);
    expect(() => parseReproductionRecord(record)).toThrow("reproduction_record_invalid");
  }
});

test("actual Tape3 Pi writer output parses and strictly replays only under its exact current source", async () => {
  const { record, snapshot } = archive("pi", await currentEngineVersion());
  const parsed = parseReproductionRecord(JSON.parse(JSON.stringify(record)));
  const output = await mkdtemp(path.join(os.tmpdir(), "awa-pi-metadata-replay-"));
  try {
    const restored = await replayReproduction(parsed, output);
    expect(restored.decisionCount).toBe(0);
    expect(restored.snapshot).toEqual(snapshot);
    expect(parsed.metadata.players.map((player) => player.agent?.kind)).toEqual(
      Array(6).fill("pi"),
    );
    const wrongSource = structuredClone(parsed);
    wrongSource.metadata.engine.sourceHash = "0".repeat(64);
    await expect(replayReproduction(wrongSource, output)).rejects.toThrow(
      "reproduction_engine_or_lock_incompatible",
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
