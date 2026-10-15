/**
 * 负责故障场景测试，核对 runner 清空并行行动、关闭 owner 并保留原并发错误。
 * 输入为受控行动回复、原可选文件失败与真实录制清理；输出由字面单次关闭计数、聚合错误身份和可复盘前缀核对。
 * 不用生产 oracle 重生接受行动，实际文件新封装仅在原输入读取位置解包。
 */
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { expect, spyOn, test } from "bun:test";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import * as factory from "../../../../src/app/player-agent-factory";
import { parseRuntimeConfig } from "../../../../src/app/config/parse-config";
import { resolveGameSetup } from "../../../../src/app/config/resolve-game-setup";
import { loadBoardDefinition } from "../../../../src/app/config/load-board-definition";
import { runGame } from "../../../../src/app/game-runner";
import { BaselineBotActionProvider } from "../../../../src/agents/baseline/privileged";
import {
  readReproduction,
  replayReproduction,
} from "../../../../src/app/simulation/replay-reproduction";
import { ReplayFileStore } from "../../../../src/adapters/filesystem/session-file-store";
import { getSessionRecorder } from "../../../../src/recording/session/context";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";

for (const diskFailure of [false, true])
  for (const lateSuccess of [false, true])
    test(`runner drains concurrent failure/cancellation and closes once, retaining every original error (${diskFailure ? "with disk failure" : "replayable"}/${lateSuccess ? "late success" : "cancelled"})`, async () => {
      const root = await createTestTempDirectory("awa-run-multi-"),
        output = await createTestTempDirectory("awa-run-multi-replay-");
      const board = await loadBoardDefinition(
        path.resolve(process.cwd(), "../configs.example"),
        "twelve_player_standard",
      );
      const config = parseRuntimeConfig({
        providers: {
          default: "fake",
          items: { fake: { type: "openai", apiKey: "synthetic-unused" } },
        },
        agents: {
          default: "fake",
          items: { fake: { kind: "llm", provider: "fake", model: "synthetic" } },
        },
        game: { board: "twelve_player_standard", seed: "runner-concurrent" },
        debugSummary: { agent: { enabled: false } },
      });
      const setup = resolveGameSetup(
        config,
        {
          recordRootDir: root,
          maxRuntimeMs: 10000,
          maxDays: 20,
          streamEvents: false,
          color: false,
        },
        board,
      );
      const first = new TypeError("synthetic-private-first"),
        second = new RangeError("synthetic-private-second"),
        cleanup = new Error("synthetic-private-cleanup"),
        persistence = new Error("synthetic-private-disk");
      let cancel!: (value: any) => void,
        closed = 0,
        pending = 0;
      const held = new Promise<any>((done) => {
        cancel = done;
      });
      const create = spyOn(factory, "createPlayerAgentRuntime").mockImplementation(
        async (options) => {
          const baseline = new BaselineBotActionProvider(options.world);
          return {
            kind: "mixed",
            runtimeState: { closed: false },
            async close() {
              closed++;
              cancel(lateSuccess ? { name: "run_for_sheriff", args: { run: true } } : null);
              throw cleanup;
            },
            provider: {
              async getAction(request) {
                if (request.context.stage === "sheriff_nomination") {
                  if (request.actorId === 1) {
                    pending++;
                    try {
                      return await held;
                    } finally {
                      pending--;
                    }
                  }
                  if (request.actorId === 2) throw first;
                  if (request.actorId === 3) throw second;
                }
                return baseline.getAction(request);
              },
            },
          };
        },
      );
      const write = ReplayFileStore.prototype.writeJsonStrict;
      const disk = diskFailure
        ? spyOn(ReplayFileStore.prototype, "writeJsonStrict").mockImplementation(async function (
            this: ReplayFileStore,
            file,
            data,
          ) {
            if (file === "replay.json" && readReplayDocument(data).result?.reason === "runtime_error")
              throw persistence;
            return write.call(this, file, data);
          })
        : undefined;
      try {
        const failed = await runGame(setup).then(
          () => null,
          (error) => error,
        );
        expect(failed).toBeInstanceOf(AggregateError);
        expect(failed.errors).toEqual(
          diskFailure ? [first, second, cleanup, persistence] : [first, second, cleanup],
        );
        expect(closed).toBe(1);
        expect(pending).toBe(0);
        expect(getSessionRecorder()).toBeNull();
        const [session] = await readdir(root),
          directory = path.join(root, session);
        const raw = await readFile(path.join(directory, "reproduction.json"), "utf8");
        for (const error of [first, second, cleanup, persistence])
          expect(raw).not.toContain(error.message);
        const record = await readReproduction(path.join(directory, "reproduction.json"));
        expect(record.decisions.every((decision) => decision.outcome.kind !== "pending")).toBe(
          true,
        );
        expect(record.checkpoints.at(-1)!.failure!.name).toBe("TypeError");
        expect(
          record.decisions.find(
            (decision) => decision.actorId === 1 && decision.stage === "sheriff_nomination",
          )!.outcome,
        ).toEqual({ kind: "error", code: "decision_failed", name: "AbortError" });
        expect(
          record.operations.some(
            (op) =>
              op.actor_id === 1 && op.scope === "gateway" && op.input?.tool === "run_for_sheriff",
          ),
        ).toBe(false);
        expect(record.termination!.errors).toContainEqual({
          scope: "controller",
          name: "RangeError",
        });
        expect(record.termination!.errors).toContainEqual({ scope: "cleanup", name: "Error" });
        if (!diskFailure) {
          expect((await replayReproduction(record, output)).snapshot).toEqual(
            record.checkpoints.at(-1)!.snapshot,
          );
          const after = await readFile(path.join(directory, "reproduction.json"), "utf8");
          await Bun.sleep(0);
          expect(await readFile(path.join(directory, "reproduction.json"), "utf8")).toBe(after);
          const publicReplay = readReplayDocument(JSON.parse(
            await readFile(path.join(directory, "replay.json"), "utf8"),
          ));
          expect(publicReplay.result.reason).toBe("runtime_error");
        }
      } finally {
        create.mockRestore();
        disk?.mockRestore();
      }
    });
