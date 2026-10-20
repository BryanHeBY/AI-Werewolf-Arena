/**
 * 单元测试负责验证公开名册、终端事件和三种 Agent 输出的身份映射与私有开关。
 * 输入为内存 World、字面事件、姓名和假日志；预期来自手写名单、原文与字段缺席断言。
 * 不运行完整对局、模型或真实传输，也不从生产渲染结果生成预期。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { publicPlayerRoster } from "../../../src/domain/public-player-roster";
import { COMPONENT, type GameEvent } from "../../../src/domain";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { createAgentConsoleSink } from "../../../src/adapters/console/agent-console-presenter";
import { presentStreamEvents } from "../../../src/adapters/console/console-presenter";
import { ReplaySessionAggregate } from "../../../src/recording/session/aggregate";
import {
  demonHunterBoard,
  demonHunterDeck,
} from "../../support/features/demon-hunter/builders/candidate-world";
import { captureCheckpoint } from "../../../src/app/simulation/reproduction-context";

test("未取名的审计身体拒绝后来安装的姓名 getter，失败快照仍保留原字段缺席", () => {
  const game = bootstrapGame(demonHunterBoard(6), { fixedRoles: demonHunterDeck(6) });
  const identity = game.world.getComponent(1, COMPONENT.Identity)!;
  let reads = 0;
  Object.defineProperty(identity, "name", {
    configurable: true,
    enumerable: true,
    get() {
      reads++;
      return "伪造";
    },
  });
  expect(() => captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, 0)).toThrow(
    "demon_hunter_checkpoint_metadata_revoked",
  );
  const partial = captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, false, 0);
  expect(Object.hasOwn(partial.players[0]!, "name")).toBe(false);
  expect(reads).toBe(0);
});

test("未配置昵称保留字段缺席，公开名册只含身份资料且脱离 World", () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig, {
    playerNames: { "1": "茶茶", "2": "茶茶" },
  });
  const roster = publicPlayerRoster(world);
  expect(roster).toEqual([
    { id: 1, seat: 1, name: "茶茶" },
    { id: 2, seat: 2, name: "茶茶" },
    { id: 3, seat: 3 },
    { id: 4, seat: 4 },
    { id: 5, seat: 5 },
    { id: 6, seat: 6 },
  ]);
  expect(Object.hasOwn(world.getComponent(3, COMPONENT.Identity)!, "name")).toBe(false);
  world.getComponent(1, COMPONENT.Identity)!.name = "之后的值";
  expect(roster[0]!.name).toBe("茶茶");
});

test("发言、目标、票型和三种传输标签都有昵称，玩家原文与私有开关保持原语义", () => {
  const players = [
      { id: 1, name: "茶茶" },
      { id: 2, name: "砚舟" },
    ],
    lines: string[] = [];
  const speech = "2号、Player 1、{actor}号都保持原文";
  const events: GameEvent[] = [
    { timestamp: 0, type: "day_speech", payload: { actorId: 1, text: speech } },
    {
      timestamp: 0,
      type: "sheriff_vote_summary",
      payload: { votes: [{ actorId: 1, targetId: 2, abstain: false }], winnerId: 2 },
    },
    {
      timestamp: 0,
      type: "wolf_discussion",
      audience: [1, 2],
      payload: { actorId: 1, text: "SECRET", endChat: false, round: 1 },
    },
  ];
  presentStreamEvents(events, false, (line) => lines.push(line), "zh-CN", players);
  expect(lines.join("\n")).toContain("1号·茶茶");
  expect(lines.join("\n")).toContain("2号·砚舟");
  expect(lines[0]).toEndWith(speech);
  expect(lines.join("\n")).not.toContain("SECRET");
  for (const transport of ["llm", "acp", "pi"] as const) {
    createAgentConsoleSink({
      players,
      printThinking: true,
      printLlmIo: false,
      trace: false,
      log: (line) => lines.push(line),
    })({
      visibility: "private",
      context: { transport, playerId: 1 },
      output: { type: "text", channel: "thinking", text: "1号思考" },
    });
    expect(lines.at(-1)).toContain(`[${transport}][1号·茶茶]`);
    expect(lines.at(-1)).toEndWith("1号思考");
  }
});

test("独立玩家录制也保存公开昵称，缺省档案不补默认名字", () => {
  const aggregate = new ReplaySessionAggregate({
    sessionId: "names",
    board: "test",
    startedAtIso: "2026-10-16T00:00:00Z",
    players: [{ id: 1, seat: 1, name: "茶茶" }],
  });
  for (const playerId of [1, 2])
    aggregate.recordPlayerEvent({
      playerId,
      role: "villager",
      camp: "good",
      day: 1,
      phase: "day",
      stage: "day_speech",
      requestId: "r",
      timestampMs: 0,
      event: { seq: 1, type: "day_speech", payload: { actorId: 1, text: "hello" } },
    });
  expect(aggregate.normalizedPlayerView(1)!.name).toBe("茶茶");
  expect(Object.hasOwn(aggregate.normalizedPlayerView(2)!, "name")).toBe(false);
});
