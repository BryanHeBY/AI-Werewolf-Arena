import { isLocale, type Locale } from "@ai-werewolf-arena/game-catalog";
import { bootstrapGame } from "../../app/bootstrap";
import {
  DEATH_SHOT_STAGES,
  createRandom,
  randomDraws,
  type ActionProvider,
  type GameEvent,
  type RuntimeSnapshot,
} from "../../core";
import { readFile } from "node:fs/promises";
import { ObservedBot, type BotStyle } from "../../ai/agents/providers/observed_bot";
import { ObservedPlayersActionProvider } from "../../ai/agents/providers/observed_players";
import type { ResolvedBoardDefinition } from "../config/board_definition";
import { SessionRecordManager } from "../../recording/session_recorder";
import { runWithSessionRecorder } from "../../recording/recording_context";
import { GameEventRecorder } from "../game_event_recorder";
import { COMPONENT, type RoleComponent } from "../../core";
import { getWitchState } from "../../game/mechanisms/roles/private_state";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "./reproduction_context";

export interface SimulationOptions {
  locale?: Locale;
  displayLocale?: Locale;
  seeds: readonly string[];
  recordRoot: string;
  maxDays?: number;
  styles?: readonly BotStyle[];
}

export interface SimulationReport {
  board: string;
  games: Array<{
    seed: string;
    recordDir: string;
    result: RuntimeSnapshot["result"];
    natural: boolean;
    branches: Record<string, number>;
    rejects: number;
    fallbacks: number;
  }>;
  branches: Record<string, number>;
  naturallyFinished: number;
  rejects: number;
  fallbacks: number;
}

/** Counts executed skill outcomes, not merely roles present in a deal. */
function branchCounts(events: readonly GameEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const key =
      event.type === "witch_potion_used"
        ? `${event.type}.${event.payload.potionType}`
        : event.type === "guard_applied"
          ? `${event.type}.${event.payload.abstain ? "skip" : "protect"}`
          : event.type;
    counts[key] = (counts[key] ?? 0) + 1;
    if (
      event.type === "radiant_shelter_chosen" ||
      event.type === "eclipse_swallowed" ||
      event.type === "alchemist_mist_chosen" ||
      event.type === "alchemist_snake_chosen" ||
      event.type === "raven_knife_chosen"
    ) {
      const spent =
        event.type === "alchemist_mist_chosen"
          ? event.payload.targetIds !== null
          : event.payload.targetId !== null;
      const outcome = `${event.type}.${spent ? "spend" : "pass"}`;
      counts[outcome] = (counts[outcome] ?? 0) + 1;
      if (spent && event.payload.day > 1) {
        const delayed = `${event.type}.later_spend`;
        counts[delayed] = (counts[delayed] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/** Only the controller can inspect truth for assertions and recording; strategies receive DTOs. */
export async function simulateGames(
  board: ResolvedBoardDefinition,
  options: SimulationOptions,
): Promise<SimulationReport> {
  if (!options.seeds.length || new Set(options.seeds).size !== options.seeds.length)
    throw new Error("simulation_seeds_invalid");
  const locale = options.locale ?? "zh-CN";
  if (!isLocale(locale)) throw new Error("simulation_locale_invalid");
  const maxDays = options.maxDays ?? 30;
  if (!Number.isSafeInteger(maxDays) || maxDays < 1) throw new Error("simulation_max_days_invalid");
  const styles = options.styles ?? ["active", "conservative", "competitive", "random"];
  if (
    !styles.length ||
    styles.some((style) => !["active", "conservative", "competitive", "random"].includes(style))
  )
    throw new Error("simulation_styles_invalid");
  const report: SimulationReport = {
    board: board.definition.id,
    games: [],
    branches: {},
    naturallyFinished: 0,
    rejects: 0,
    fallbacks: 0,
  };
  const batchId = crypto.randomUUID();
  const engine = await currentEngineVersion();
  for (const [index, seed] of options.seeds.entries()) {
    const random = createRandom(seed);
    const context = bootstrapGame(board.config, { random, locale });
    const strategies = new Map(
      context.playerIds.map((id) => [
        id,
        new ObservedBot(
          randomDraws(random.fork("players").fork(`id:${id}`)),
          styles[Math.floor(random.fork("styles").fork(`id:${id}`).next() * styles.length)],
        ),
      ]),
    );
    const observed = new ObservedPlayersActionProvider(context.world, strategies, board.config);
    const provider: ActionProvider = {
      async getAction(request) {
        if (context.phaseManager.getSnapshot().gameOver)
          throw new Error("simulation_action_after_game_over");
        if (
          !context.world.getAliveEntityIds().includes(request.actorId) &&
          request.context.stage !== "last_words" &&
          !DEATH_SHOT_STAGES.includes(request.context.stage) &&
          !(
            request.context.stage === "sheriff_badge_choice" &&
            request.allowedTools.includes("choose_badge_successor") &&
            context.world.hasDeathAction(
              request.actorId,
              "choose_badge_successor",
              request.phase,
              request.context.day,
              request.context.death_action_id,
            )
          )
        )
          throw new Error("simulation_unauthorized_dead_action");
        return observed.getAction(request);
      },
    };
    const manager = await SessionRecordManager.create(
      {
        sessionId: `simulation-${batchId}-${index}`,
        board: board.definition.id,
        locale: context.world.locale,
        startedAtIso: new Date().toISOString(),
        random: random.metadata,
      },
      options.recordRoot,
      options.displayLocale ?? locale,
    );
    const recorder = new GameEventRecorder(
      { world: context.world, replayManager: manager },
      context.phaseManager.getSnapshot().phase,
    );
    const summary = await runWithSessionRecorder(manager, async () => {
      const failures: unknown[] = [];
      const reproduction = beginGameReproduction(manager, context, {
        engine,
        boardId: board.definition.id,
        boardConfig: board.config,
        locale: context.world.locale,
        maxDays,
      });
      const recordedProvider: ActionProvider = {
        getAction: (request) => reproduction.decide(request, provider),
      };
      let cycle = 0;
      let priorAlive = context.world.getAliveEntityIds();
      const priorResources = new Map<number, { heal: number; poison: number }>();
      try {
        while (!context.phaseManager.getSnapshot().gameOver) {
          cycle++;
          let complete = false;
          let cycleFailure: unknown;
          try {
            await context.phaseManager.runSingleCycle(recordedProvider, maxDays);
            complete = true;
          } catch (error) {
            cycleFailure = error;
            failures.push(error);
            manager.noteReproductionFailure("cycle", error);
          }
          try {
            reproduction.checkpoint(
              captureCheckpoint(
                context.world,
                context.phaseManager.getSnapshot(),
                cycle,
                complete,
                context.phaseManager.getEvents().length,
                cycleFailure,
              ),
              context.phaseManager.getEvents(),
            );
          } catch (error) {
            failures.push(error);
            reproduction.invalidate();
            manager.noteReproductionFailure("recording", error);
          }
          if (failures.length) break;
          recorder.flush(context.phaseManager.getEvents());
          // Public controller invariants do not feed hidden truth back into decisions.
          const alive = context.world.getAliveEntityIds();
          if (alive.some((id) => !priorAlive.includes(id)))
            throw new Error("simulation_unexpected_revival");
          priorAlive = alive;
          for (const id of context.world.entityIds()) {
            const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role);
            if (!role) throw new Error("simulation_missing_role");
            const witch = getWitchState(role);
            if (witch) {
              const prior = priorResources.get(id) ?? { heal: 1, poison: 1 };
              if (
                witch.heal < 0 ||
                witch.poison < 0 ||
                witch.heal > prior.heal ||
                witch.poison > prior.poison
              )
                throw new Error("simulation_invalid_resource_transition");
              priorResources.set(id, { heal: witch.heal, poison: witch.poison });
            }
          }
        }
      } catch (error) {
        failures.push(error);
        manager.noteReproductionFailure("controller", error);
      } finally {
        try {
          recorder.flush(context.phaseManager.getEvents());
        } catch (error) {
          failures.push(error);
        }
        try {
          const snapshot = context.phaseManager.getSnapshot();
          await manager.finalize({
            endedAtIso: new Date().toISOString(),
            winner: snapshot.result?.winner ?? null,
            ...(snapshot.result ? { gameResult: snapshot.result } : {}),
            finishReason: failures.length
              ? "runtime_error"
              : (snapshot.result?.reason ?? "incomplete"),
            players: context.playerIds.map((id) => {
              const role = context.world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
              return {
                player_id: id,
                role: role.role,
                camp: role.camp,
                alive: context.world.getAliveEntityIds().includes(id),
              };
            }),
          });
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length) throw new AggregateError(failures, "simulation_game_failed");
      return manager;
    });
    // The persisted operations reflect execution acceptance, not what strategies merely attempted.
    const operations = JSON.parse(
      await readFile(`${summary.sessionDir}/logic_ops.json`, "utf8"),
    ) as { ops: Array<{ status: string }> };
    const branches = branchCounts(context.phaseManager.getEvents());
    const result = context.phaseManager.getSnapshot().result;
    const natural = result !== null && result.reason !== "max_days_reached";
    const rejects = operations.ops.filter((op) => op.status === "rejected").length;
    const fallbacks = operations.ops.filter((op) => op.status === "fallback").length;
    report.games.push({
      seed,
      recordDir: summary.sessionDir,
      result,
      natural,
      branches,
      rejects,
      fallbacks,
    });
    report.naturallyFinished += Number(natural);
    report.rejects += rejects;
    report.fallbacks += fallbacks;
    for (const [branch, count] of Object.entries(branches))
      report.branches[branch] = (report.branches[branch] ?? 0) + count;
  }
  return report;
}
