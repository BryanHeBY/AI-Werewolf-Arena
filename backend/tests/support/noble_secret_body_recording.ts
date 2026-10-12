/**
 * Noble recording scenario support verify drive literal Noble/Body choices and owned lifecycle recording.
 * Input: Original plan/locale/stock policies, fixed scripts and scoped temporary session files.
 * Output and independent oracle: Outputs actual causal records/checkpoints and strict replay; handwritten expected death/resource state remains separate from the driver.
 * The driver owns its allocated recorder/transport lifetime; callers own expected rules and all production state writers remain unchanged.
 */
import { readFile, rm } from "node:fs/promises";
import { bootstrapGame } from "../../src/app/bootstrap";
import {
  COMPONENT,
  Camp,
  Role,
  PotionType,
  createRandom,
  type ActionRequest,
  type ToolCall,
} from "../../src/core";
import { nobleSecretBodyTwelveConfig } from "../../src/runtime/scenarios/noble_secret_body_twelve";
import { SessionRecordManager } from "../../src/recording/session_recorder";
import { runWithSessionRecorder } from "../../src/recording/recording_context";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../src/runtime/simulation/reproduction_context";
import { parseReproductionRecord } from "../../src/recording/reproduction";
import { replayReproduction } from "../../src/runtime/simulation/replay_reproduction";
import { demonNightChoice } from "./demon_hunter_scenarios";
import { createTestTempDirectory } from "./drivers/temp-directories";
export interface NobleLiteralNight {
  body: number | null;
  servant: number | null;
  knife: number | null;
  hunt: number | null;
  exile: number | null;
  potion?: { target: number; type: PotionType };
}
export const nobleLiteralPlans: Record<string, readonly NobleLiteralNight[]> = {
  blast_skips_vote: [
    { body: 6, servant: null, knife: null, hunt: null, exile: 10 },
    { body: 7, servant: 6, knife: null, hunt: null, exile: 11 },
    { body: 6, servant: null, knife: null, hunt: null, exile: 11 },
    { body: null, servant: null, knife: null, hunt: null, exile: 12 },
  ],
  expiry: [
    { body: 6, servant: null, knife: null, hunt: null, exile: 10 },
    { body: 7, servant: 6, knife: null, hunt: null, exile: 11 },
    { body: 6, servant: null, knife: null, hunt: null, exile: 12 },
    { body: null, servant: 7, knife: null, hunt: null, exile: 1 },
  ],
  new_and_old_clear: [
    { body: null, servant: null, knife: null, hunt: null, exile: 10 },
    { body: null, servant: 6, knife: null, hunt: 6, exile: 11 },
    { body: null, servant: 12, knife: null, hunt: null, exile: 6 },
    { body: null, servant: null, knife: 12, hunt: 12, exile: 1 },
  ],
  two_sources: [
    { body: null, servant: null, knife: null, hunt: null, exile: 10 },
    { body: 7, servant: 5, knife: null, hunt: null, exile: 11 },
    {
      body: 6,
      servant: null,
      knife: 6,
      hunt: null,
      exile: 12,
      potion: { target: 6, type: PotionType.Poison },
    },
    { body: null, servant: 7, knife: null, hunt: null, exile: 1 },
  ],
  pending_last_wolf: [
    { body: null, servant: null, knife: null, hunt: null, exile: 10 },
    { body: null, servant: 7, knife: null, hunt: 12, exile: 11 },
    { body: null, servant: null, knife: null, hunt: null, exile: 1 },
  ],
  badge_reveal: [
    { body: 6, servant: null, knife: null, hunt: null, exile: 5 },
    { body: null, servant: null, knife: null, hunt: null, exile: 10 },
    { body: null, servant: null, knife: null, hunt: null, exile: 5 },
    { body: null, servant: null, knife: 12, hunt: 11, exile: 1 },
  ],
};
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
        boardConfig: config,
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
          role: game.world.getComponent<{ role: Role }>(id, COMPONENT.Role)!.role,
          camp: game.world.getComponent<{ camp: Camp }>(id, COMPONENT.Camp)!.camp,
          alive: game.world.getComponent<{ alive: boolean }>(id, COMPONENT.Alive)!.alive,
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
