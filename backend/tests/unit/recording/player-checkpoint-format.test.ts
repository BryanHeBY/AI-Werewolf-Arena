/**
 * 单元测试验证完整玩家格式的未知私态、optional 组件、refine 与延后 JSON 拒绝边界。
 * 输入为手写归档对象和公共 bootstrap 的零周期 checkpoint；预期是字面字段、原错误与
 * getter 轨迹，不从另一生产 schema 生成答案。只执行格式／捕获／Trace，不推进对局、
 * 消费资源、写文件或调用模型；格式准入不当作机制因果或行动授权。
 */
import { expect, test } from "bun:test";
import { z } from "zod";
import { Camp, Role, COMPONENT } from "../../../src/domain";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { createRecordedPlayerSchema } from "../../../src/recording/reproduction/checkpoint/player-format";
import type { RecordedPlayerState } from "../../../src/recording/reproduction/format";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { captureCheckpoint } from "../../../src/app/simulation/reproduction-context";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

const format = createRecordedPlayerSchema(
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.record(z.string(), z.json()),
);

const player = (): RecordedPlayerState => ({
  id: 7,
  seat: 7,
  name: "literal-player",
  role: Role.Villager,
  camp: Camp.Good,
  alive: true,
  privateState: {},
  victory: { affiliations: [{ kind: "faction", faction: Camp.Good }] },
  vote: { weight: 1, canVote: true },
  badge: { isSheriff: false, destroyed: false, voteWeight: 1 },
  marks: [],
});

test("player format keeps retained slots and JSON metadata without role filtering or optional defaults", () => {
  const input = {
    ...player(),
    privateState: {
      thief: { policy: "lui_meme_thief_two_extra_villagers_v1", remaining: 0, choice: 1 },
      abilities: {
        "gift:literal": {
          id: "gift:literal", kind: "seer_check",
          source: { kind: "copy", actorId: 3, abilityId: "native:seer_check" },
          sourceDisclosed: false, activation: "lucky", startsOnDay: 1,
          maxUses: 1, uses: 0, lastUsedDay: null, disabled: false, deathExpired: false,
          state: { lastTarget: null, lastIsWerewolf: null, history: [] },
          extraMetadata: { note: "kept" },
        },
      },
      custom: { labels: ["literal", null, 2] },
    },
    wallNote: {
      instanceId: "wall:1:7",
      source: { kind: "wall_event", eventId: "awa_wall_notes_v1", day: 1 },
      remaining: 1, expired: false,
    },
    debatePenalty: { day: 2, sourceId: 3, lifeVersion: 0 },
    lovers: {
      actorId: 4, day: 1, policy: "netease_2017_cupid_follows_lovers_v1",
      pairIds: [2, 3], pairCamps: [Camp.Good, Camp.Wolf], groupId: "cupid_lovers", mixed: true,
    },
    badge: { isSheriff: true, destroyed: false, voteWeight: 1.5, handoffPolicy: "awa_holder_choice_v1" },
  };
  const result = format.parse(input);
  expect<unknown>(result).toEqual(input);
  expect(result.privateState).not.toBe(input.privateState);
  expect(result.privateState.thief).toEqual({
    policy: "lui_meme_thief_two_extra_villagers_v1", remaining: 0, choice: 1,
  });
  const absent = format.parse(player());
  expect(Object.hasOwn(absent, "wallNote")).toBe(false);
  expect(Object.hasOwn(absent, "debatePenalty")).toBe(false);
  expect(Object.hasOwn(absent, "lovers")).toBe(false);
  expect(Object.hasOwn(absent.badge, "handoffPolicy")).toBe(false);
});

test("ordinary checkpoint and Trace capture precede the strict JSON rejection at build", () => {
  const game = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
    locale: "en",
  });
  const role = game.world.getComponent(5, COMPONENT.Role)!,
    raw = role.privateState as Record<string, unknown>, reads: string[] = [];
  raw.optional = undefined;
  Object.defineProperty(raw, "legal", {
    enumerable: true,
    get() { reads.push("private-getter"); return { note: "literal" }; },
  });
  const events = game.phaseManager.getEvents(),
    checkpoint = captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, events.length);
  let changes = 0;
  const trace = new ReproductionTrace({
    engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
    random: game.random.metadata,
    ruleset: RULESET, boardId: "format_boundary", normalizedBoard: game.boardConfig as import("@ai-werewolf-arena/game-contract").BoardConfig,
    locale: "en", maxDays: 1, dealMode: "fixed",
    players: checkpoint.players.map(({ id, name, role, camp }) => ({ id, name, role, camp })),
  }, () => { changes++; });
  // 原捕获可保 undefined；不让新格式在 checkpoint 追加之前提前拒绝或改写 live 容器。
  trace.checkpoint(checkpoint, events);
  expect(reads).toEqual(["private-getter"]);
  expect(changes).toBe(1);
  expect(Object.hasOwn(checkpoint.players[4]!.privateState, "optional")).toBe(true);
  expect(checkpoint.players[4]!.privateState.optional).toBeUndefined();
  expect(checkpoint.players[4]!.privateState.legal).toEqual({ note: "literal" });
  expect(() => trace.build()).toThrow("reproduction_record_invalid");
  expect(reads).toEqual(["private-getter"]);
  expect(changes).toBe(1);
  expect(Object.hasOwn(raw, "optional")).toBe(true);
});

test("player format retains the independent Lovers and Wall ownership refine errors", () => {
  const lovers = {
    actorId: 4, day: 1, policy: "netease_2017_cupid_follows_lovers_v1",
    pairIds: [2, 3], pairCamps: [Camp.Good, Camp.Wolf], groupId: "cupid_lovers", mixed: true,
  }, wallNote = {
    instanceId: "wall:1:7",
    source: { kind: "wall_event", eventId: "awa_wall_notes_v1", day: 1 }, remaining: 1, expired: false,
  };
  const badLovers = format.safeParse({ ...player(), lovers: { ...lovers, mixed: false } });
  expect(badLovers.success).toBe(false);
  if (!badLovers.success)
    expect(badLovers.error.issues.map(({ message, path }) => ({ message, path }))).toEqual([
      { message: "reproduction_lovers_invalid", path: ["lovers"] },
    ]);
  const badWall = format.safeParse({ ...player(), wallNote: { ...wallNote, instanceId: "wall:1:8" } });
  expect(badWall.success).toBe(false);
  if (!badWall.success)
    expect(badWall.error.issues.map(({ message, path }) => ({ message, path }))).toEqual([
      { message: "reproduction_wall_owner_invalid", path: [] },
    ]);
  expect(format.safeParse({ ...player(), lovers, wallNote }).success).toBe(true);
});
