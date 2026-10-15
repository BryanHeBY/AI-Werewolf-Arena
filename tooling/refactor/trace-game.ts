/**
 * 负责在子进程中驱动一个固定构建的字面场景。输入为构建根、场景和入口布局；输出为录制及严格复现轨迹。
 * 每份构建创建自己的装配、运行许可和记录器，并使用自己的严格复现入口，不重写源码或归档引擎指纹。
 * 固定 Date.now 使逻辑时间可比较，真实定时器和通信生命周期仍需另外验收；产物写入调用方提供的临时目录。
 */
import { readFile, mkdir, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { literalAction, type LiteralTranscript, type TranscriptRequest } from "./transcripts";

export interface BuildLayout {
  // 布局只解决迁移后的模块位置；load 逐项核对相对路径及 realpath，不允许跨出本构建根。
  bootstrap: string;
  core: string;
  recorder: string;
  recordingContext: string;
  reproductionContext: string;
  reproduction: string;
  replay: string;
}
export const originalLayout: BuildLayout = {
  bootstrap: "backend/src/app/bootstrap.ts",
  core: "backend/src/core/index.ts",
  recorder: "backend/src/recording/session_recorder.ts",
  recordingContext: "backend/src/recording/recording_context.ts",
  reproductionContext: "backend/src/runtime/simulation/reproduction_context.ts",
  reproduction: "backend/src/recording/reproduction.ts",
  replay: "backend/src/runtime/simulation/replay_reproduction.ts",
};
export interface TraceScenario {
  id: string;
  board: unknown;
  boardId: string;
  fixedRoles: string[];
  seed: string;
  locale: "zh-CN" | "en";
  maxDays: number;
  transcript: LiteralTranscript;
}

async function runTrace(
  root: string,
  inputPath: string,
  output: string,
  layout: BuildLayout,
): Promise<void> {
  const originalNow = Date.now;
  Date.now = () => 1_700_000_000_000;
  root = await realpath(root);
  const load = async (name: keyof BuildLayout) => {
    const relative = layout[name];
    if (
      typeof relative !== "string" ||
      path.isAbsolute(relative) ||
      relative.split(/[\\/]/).includes("..")
    )
      throw Error("differential_layout_invalid");
    const file = await realpath(path.join(root, relative));
    if (!file.startsWith(`${root}${path.sep}`)) throw Error("differential_layout_escaped");
    return import(pathToFileURL(file).href);
  };
  const [bootstrap, core, recording, context, reproductionContext, reproduction, replay] =
    await Promise.all([
      load("bootstrap"),
      load("core"),
      load("recorder"),
      load("recordingContext"),
      load("reproductionContext"),
      load("reproduction"),
      load("replay"),
    ]);
  const input: TraceScenario = JSON.parse(await readFile(inputPath, "utf8"));
  // 在加载可能捕获时钟的机制前已替换 Date.now；原生定时器本身没有替换。
  await mkdir(output, { recursive: true });
  const game = bootstrap.bootstrapGame(input.board, {
    fixedRoles: input.fixedRoles,
    random: core.createRandom(input.seed),
    locale: input.locale,
  });
  const manager = await recording.SessionRecordManager.create(
    {
      sessionId: input.id,
      board: input.boardId,
      locale: input.locale,
      startedAtIso: "2023-11-14T22:13:20.000Z",
      random: game.random.metadata,
    },
    path.join(output, "record"),
  );
  try {
    await context.runWithSessionRecorder(manager, async () => {
      const trace = reproductionContext.beginGameReproduction(manager, game, {
        engine: await reproductionContext.currentEngineVersion(root),
        boardId: input.boardId,
        boardConfig: input.board,
        locale: input.locale,
        maxDays: input.maxDays,
      });
      let failed = false;
      let faultConsumed = 0;
      let literalFailure: unknown;
      // 失败场景只承认指定字面动作抛出的同一错误；其它异常不能伪装成预期故障。
      for (
        let cycle = 1;
        cycle <= input.maxDays && !game.phaseManager.getSnapshot().gameOver;
        cycle++
      ) {
        let failure: unknown;
        try {
          await game.phaseManager.runSingleCycle(
            {
              getAction: (request: TranscriptRequest) =>
                trace.decide(request, {
                  getAction: async (issued: TranscriptRequest) => {
                    try {
                      return literalAction(issued, input.transcript);
                    } catch (error) {
                      if (
                        issued.context.stage === input.transcript.failureStage &&
                        error instanceof Error &&
                        error.message === "literal_decision_failure"
                      ) {
                        faultConsumed++;
                        literalFailure = error;
                      }
                      throw error;
                    }
                  },
                }),
            },
            input.maxDays,
          );
        } catch (error) {
          if (input.transcript.failureStage && error !== literalFailure)
            throw Error("differential_unexpected_failure");
          failure = error;
          failed = true;
          trace.noteFailure("cycle", error);
          if (!input.transcript.failureStage) throw error;
        }
        trace.checkpoint(
          reproductionContext.captureCheckpoint(
            game.world,
            game.phaseManager.getSnapshot(),
            cycle,
            !failed,
            game.phaseManager.getEvents().length,
            failure,
          ),
          game.phaseManager.getEvents(),
        );
        if (failed) break;
      }
      const snapshot = game.phaseManager.getSnapshot();
      if (!failed && (!snapshot.gameOver || snapshot.result?.reason === "max_days_reached"))
        throw Error("differential_not_natural_terminal");
      if (input.transcript.failureStage && (!failed || faultConsumed !== 1))
        throw Error("differential_fault_not_consumed");
      await manager.finalize({
        endedAtIso: "2023-11-14T22:13:20.000Z",
        winner: snapshot.result?.winner ?? null,
        finishReason: failed ? "runtime_error" : snapshot.result.reason,
        ...(snapshot.result ? { gameResult: snapshot.result } : {}),
        players: reproductionContext
          .captureCheckpoint(game.world, snapshot, 0, !failed, game.phaseManager.getEvents().length)
          .players.map((p: { id: number; role: string; camp: string; alive: boolean }) => ({
            player_id: p.id,
            role: p.role,
            camp: p.camp,
            alive: p.alive,
          })),
      });
    });
    const record = reproduction.parseReproductionRecord(
      JSON.parse(await readFile(path.join(manager.sessionDir, "reproduction.json"), "utf8")),
    );
    const strictReplay = await replay.replayReproduction(
      record,
      path.join(output, "strict-replay"),
    );
    await writeFile(
      path.join(output, "trace.json"),
      JSON.stringify({ record, strictReplay }, null, 2) + "\n",
    );
  } finally {
    // 兜底 finalize 不覆盖主异常；这里仅吞其补救失败，正常路径的必需 finalize 仍会向外报错。
    await manager
      .finalize({
        endedAtIso: "2023-11-14T22:13:20.000Z",
        winner: null,
        finishReason: "runtime_error",
        players: [],
      })
      .catch(() => undefined);
    Date.now = originalNow;
  }
}

if (import.meta.main) {
  const [root, input, output, layoutPath] = process.argv.slice(2);
  if (!root || !input || !output)
    throw Error("usage: trace-game.ts <build-root> <scenario.json> <scratch> [layout.json]");
  await runTrace(
    root,
    input,
    output,
    layoutPath ? JSON.parse(await readFile(layoutPath, "utf8")) : originalLayout,
  );
}
