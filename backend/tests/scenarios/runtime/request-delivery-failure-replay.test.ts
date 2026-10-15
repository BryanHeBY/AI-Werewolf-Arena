/**
 * 交付失败／重放集成测试验证真实请求撤权后在结算前记录错误。
 * 输入为已绑定的真实引擎请求、注入的当前性失效及 runner 录制。
 * 字面 decision_failed 部分周期、库存不变／没有伪造夜间结果构成独立预期；精确重放另核对本局录制一致性，不依赖合成重放时钟。
 * 测试不调用付费模型，也不重写预期 fixture／Tape 字节。
 */
import { expect, test, spyOn } from "bun:test";
import path from "node:path";
import { readdir } from "node:fs/promises";
import * as factory from "../../../src/app/player-agent-factory";
import { bindRequestDeliveryGuard } from "../../../src/domain";
import { parseRuntimeConfig } from "../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../src/app/config/resolve-game-setup";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { runGame } from "../../../src/app/game-runner";
import {
  readReproduction,
  replayReproduction,
} from "../../../src/app/simulation/replay-reproduction";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

test("revoked delivery on a real engine request records an error and reproduces the exact partial cycle without a replay clock", async () => {
  const root = await createTestTempDirectory("awa-delivery-failure-"),
    output = await createTestTempDirectory("awa-delivery-failure-replay-"),
    board = await loadBoardDefinition(
      path.resolve(import.meta.dir, "../../../../configs.example"),
      "six_player_mvp",
    ),
    runtime = parseRuntimeConfig({
      providers: {
        default: "synthetic",
        items: { synthetic: { type: "openai", apiKey: "synthetic-only" } },
      },
      agents: {
        default: "synthetic",
        items: { synthetic: { kind: "llm", provider: "synthetic", model: "synthetic" } },
      },
      game: { board: "six_player_mvp", seed: "delivery-failure", locale: "en" },
      debugSummary: { agent: { enabled: false } },
    }),
    setup = resolveGameSetup(
      runtime,
      {
        recordRootDir: root,
        maxDays: 3,
        maxRuntimeMs: 10_000,
        streamEvents: false,
        printThinking: false,
        color: false,
      },
      board,
    );
  let requests = 0;
  const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(async () => {
    let closed = false;
    return {
      kind: "llm",
      provider: {
        async getAction(request) {
          requests++;
          expect(request.context.stage).toBe("wolf_discussion");
          bindRequestDeliveryGuard(request, () => false);
          return {
            name: "speak_to_wolves",
            args: { text: "synthetic delayed delivery", end_chat: true },
          };
        },
      },
      get runtimeState() {
        return { closed };
      },
      async close() {
        closed = true;
      },
    };
  });
  try {
    await expect(runGame(setup)).rejects.toThrow("action_request_delivery_authority_revoked");
    const [session] = await readdir(root),
      record = await readReproduction(path.join(root, session!, "reproduction.json"));
    expect(requests).toBe(1);
    expect(record.termination!.reason).toBe("runtime_error");
    expect(record.decisions).toHaveLength(1);
    expect(record.decisions[0]!.outcome).toEqual({
      kind: "error",
      code: "decision_failed",
      name: "Error",
    });
    expect(record.checkpoints.at(-1)!.complete).toBe(false);
    expect(record.events.some((e) => e.type === "wolf_discussion")).toBe(false);
    const replay = await replayReproduction(record, output);
    expect(replay.decisionCount).toBe(1);
    expect(replay.eventCount).toBe(record.events.length);
  } finally {
    create.mockRestore();
  }
});
