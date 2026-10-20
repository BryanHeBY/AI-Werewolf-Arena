/**
 * 负责原雾鸦受控执行与录制测试驱动；输入为字面行动计划及原 fixture 句柄。
 * 输出为原驱动回调、轨迹、缓存与清理；具体传输、复盘或脚本行动保持原生命周期。
 * 手写 oracle 持有预期结果，不引入计费模型或生产状态写入器。
 */
import type { ReproductionRecord } from "../../../../../src/recording/reproduction/format";
import { expect } from "bun:test";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { createRandom } from "../../../../../src/domain";
import type { ActionRequest } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { ReproductionTrace } from "../../../../../src/recording/reproduction/trace";
import { captureCheckpoint } from "../../../../../src/app/simulation/reproduction-context";
import { mistRecording } from "./recording";
import { mistBoard } from "../builders/board";
import { mistAction } from "./actions";
import { MIST_ROLES } from "../builders/board";

const cache = new Map<
  string,
  Promise<{
    published: ReproductionRecord;
    pending: ReproductionRecord;
    settled: ReproductionRecord;
  }>
>();

export function mistPrefix(
  stage: string,
  day = 1,
  mistPass = false,
  actor?: number,
  override?: (request: ActionRequest) => ToolCall | null | undefined,
) {
  const key = stage + day + String(mistPass) + String(actor);
  if (!override && cache.has(key)) return cache.get(key)!;
  const result = (async () => {
    const seed = "mist-raven-real-runtime";
    const board = await mistBoard();
    const game = bootstrapGame(board.config, {
      locale: "en",
      random: createRandom(seed),
      fixedRoles: MIST_ROLES,
    });
    const trace = new ReproductionTrace((await mistRecording()).metadata, () => {});
    const cp = (cycle: number, complete: boolean) =>
      trace.checkpoint(
        captureCheckpoint(
          game.world,
          game.phaseManager.getSnapshot(),
          cycle,
          complete,
          game.phaseManager.getEvents().length,
          ...(complete ? [] : [new Error("review_boundary")]),
        ),
        game.phaseManager.getEvents(),
      );
    cp(0, true);
    let pending: ReproductionRecord | undefined, settled: ReproductionRecord | undefined;
    for (let cycle = 1; cycle <= day; cycle++) {
      try {
        await game.phaseManager.runSingleCycle(
          {
            getAction: async (q: ActionRequest) => {
              const boundary =
                q.context.stage === stage &&
                q.context.day === day &&
                (actor === undefined || q.actorId === actor);
              const answer = await trace.decide(q, {
                async getAction(req: ActionRequest): Promise<ToolCall | null> {
                  if (boundary) {
                    pending = structuredClone(trace.build());
                    throw new Error("review_boundary");
                  }
                  const chosen = override?.(req);
                  if (chosen !== undefined) return chosen;
                  return mistPass && req.context.stage === "alchemist_mist"
                    ? { name: "cast_mist", args: { target_ids: null } }
                    : mistAction(req, "linked");
                },
              });
              if (q.context.day === day) settled = structuredClone(trace.build());
              return answer;
            },
          },
          8,
        );
        cp(cycle, true);
      } catch (e) {
        expect(String(e)).toContain("review_boundary");
        cp(cycle, false);
        break;
      }
    }
    expect(pending).toBeDefined();
    expect(settled).toBeDefined();
    return { published: structuredClone(trace.build()), pending: pending!, settled: settled! };
  })();
  if (!override) cache.set(key, result);
  return result;
}
