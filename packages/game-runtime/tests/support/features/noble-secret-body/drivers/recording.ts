/**
 * 测试 driver：负责原贵族／不死之身受控执行及录制。输入为原固定角色、动作与局部 store；输出保留原请求和录制前缀，独立预期不由此 driver 生成，不调用模型。
 */
import { nobleLiteralPlans } from "../builders/literal-plans";
import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { bootstrapGame } from "../../../../../src/app/bootstrap";
import { COMPONENT } from "../../../../../src/domain";
import { Camp } from "../../../../../src/domain";
import { Role } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import type { ActionRequest } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { nobleSecretBodyTwelveConfig } from "../../../../../src/rulesets/presets/noble-secret-body-twelve";
import { SessionRecordManager } from "../../../../../src/recording/session/recorder";
import { runWithSessionRecorder } from "../../../../../src/recording/session/context";
import { beginGameReproduction } from "../../../../../src/app/simulation/reproduction-context";
import { captureCheckpoint } from "../../../../../src/app/simulation/reproduction-context";
import { currentEngineVersion } from "../../../../../src/app/simulation/reproduction-context";
import { parseReproductionRecord } from "../../../../../src/recording/reproduction/format";
import { replayReproduction } from "../../../../../src/app/simulation/replay-reproduction";
import { demonNightChoice } from "../../demon-hunter/drivers/actions";
import { createTestTempDirectory } from "../../../drivers/temp-directories";

export async function recordNobleLiteral(
  name = "expiry",
  locale: "zh-CN" | "en" = "zh-CN",
  options: {
    wolf?: "standard" | "no_blast_no_self_knife";
    repeat?: "awa_nonconsecutive_nights_v1" | "awa_repeat_v1";
    failureStage?: string;
    failureDay?: number;
    badgeChoice?: "missing" | "invalid";
    blastDay?: number;
  } = {},
) {
  const config = nobleSecretBodyTwelveConfig(options.wolf, options.repeat),
    game = bootstrapGame(config, {
      locale,
      random: createRandom(`noble-literal:${name}`),
      fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
    }),
    root = await createTestTempDirectory("awa-noble-ledger-");
  let manager: SessionRecordManager | undefined;
  try {
    manager = await SessionRecordManager.create(
      {
        sessionId: "game",
        board: "awa_noble_secret_body_12_v1",
        startedAtIso: new Date().toISOString(),
        locale,
        random: game.random.metadata,
      },
      root,
    );
    const activeManager = manager;
    await runWithSessionRecorder(activeManager, async () => {
      const trace = beginGameReproduction(activeManager, game, {
        engine: await currentEngineVersion(),
        boardId: "awa_noble_secret_body_12_v1",
        ...(void config, {}),
        locale,
        maxDays: 8,
      });
      for (let cycle = 1; cycle <= 8 && !game.phaseManager.getSnapshot().gameOver; cycle++) {
        let failure: unknown;
        try {
          await game.phaseManager.runSingleCycle(
            {
              getAction: (q) =>
                trace.decide(q, {
                  async getAction(r: ActionRequest): Promise<ToolCall | null> {
                    const n = nobleLiteralPlans[name]![r.context.day - 1];
                    if (!n) throw Error("noble_literal_plan_exhausted");
                    if (
                      r.actorId === 1 &&
                      r.context.day === options.blastDay &&
                      r.context.stage === "on_pre_vote" &&
                      r.allowedTools.includes("self_destruct")
                    )
                      return {
                        name: "self_destruct",
                        args: { confirm: true, reason: "Literal skipped-vote restart." },
                      };
                    if (
                      r.context.day === (options.failureDay ?? 2) &&
                      r.context.stage === options.failureStage
                    )
                      return null;
                    if (r.allowedTools.includes("protect_secret_body"))
                      return { name: "protect_secret_body", args: { target_id: n.body } };
                    if (r.allowedTools.includes("choose_servant"))
                      return { name: "choose_servant", args: { target_id: n.servant } };
                    if (r.allowedTools.includes("check_identity"))
                      return { name: "check_identity", args: { target_id: 7 } };
                    if (r.allowedTools.includes("vote"))
                      return {
                        name: "vote",
                        args: {
                          target_id: r.actorId === n.exile ? null : n.exile,
                          abstain: n.exile === null || r.actorId === n.exile,
                        },
                      };
                    if (name === "badge_reveal") {
                      if (r.allowedTools.includes("run_for_sheriff"))
                        return { name: "run_for_sheriff", args: { run: r.actorId === 5 } };
                      if (r.allowedTools.includes("vote_for_sheriff"))
                        return { name: "vote_for_sheriff", args: { target_id: 5, abstain: false } };
                      if (r.allowedTools.includes("choose_badge_successor"))
                        return options.badgeChoice === "missing"
                          ? null
                          : {
                              name: "choose_badge_successor",
                              args: { target_id: options.badgeChoice === "invalid" ? 999 : 2 },
                            };
                    }
                    if (r.allowedTools.includes("choose_direction"))
                      return { name: "choose_direction", args: { direction: "clockwise" } };
                    if (r.allowedTools.includes("speak"))
                      return {
                        name: "speak",
                        args: {
                          text: locale === "en" ? "Literal role evidence." : "字面角色证据。",
                        },
                      };
                    return demonNightChoice(r, 3, {
                      knife: n.knife,
                      hunt: n.hunt,
                      potion: n.potion,
                    });
                  },
                }),
            },
            8,
          );
        } catch (error) {
          failure = error;
          trace.noteFailure("cycle", error);
          if (!options.failureStage) throw error;
        }
        trace.checkpoint(
          captureCheckpoint(
            game.world,
            game.phaseManager.getSnapshot(),
            cycle,
            failure === undefined,
            game.phaseManager.getEvents().length,
            failure,
          ),
          game.phaseManager.getEvents(),
        );
        trace.build();
        if (failure) break;
      }
      const snapshot = game.phaseManager.getSnapshot();
      if (
        !options.failureStage &&
        (!snapshot.gameOver || snapshot.result?.reason === "max_days_reached")
      )
        throw Error("noble_literal_not_natural");
      await activeManager.finalize({
        endedAtIso: new Date().toISOString(),
        winner: snapshot.result?.winner ?? null,
        finishReason: options.failureStage ? "runtime_error" : snapshot.result!.reason,
        ...(snapshot.result ? { gameResult: snapshot.result } : {}),
        players: game.world.entityIds().map((id) => ({
          player_id: id,
          role: game.world.getComponent(id, COMPONENT.Role)!.role,
          camp: game.world.getComponent(id, COMPONENT.Camp)!.camp,
          alive: game.world.getComponent(id, COMPONENT.Alive)!.alive,
        })),
      });
    });
    const record = parseReproductionRecord(
        JSON.parse(await readFile(manager.sessionDir + "/reproduction.json", "utf8")),
      ),
      replay = await replayReproduction(record, root + "/tape");
    return { record, replay };
  } finally {
    await manager
      ?.finalize({
        endedAtIso: new Date().toISOString(),
        winner: game.phaseManager.getSnapshot().result?.winner ?? null,
        finishReason: "runtime_error",
        players: [],
      })
      .catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
}
