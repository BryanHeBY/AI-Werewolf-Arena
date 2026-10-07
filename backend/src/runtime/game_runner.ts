import { text } from "@ai-werewolf-arena/game-text";
import { formatErrorDiagnostic } from "../utils/error_diagnostic";
/** Owns one game's resources, deadline, failure policy, and final replay. */
import path from "node:path";
import { bootstrapGame } from "../app/bootstrap";
import {
  COMPONENT,
  type ActionProvider,
  type ActionRequest,
  type AliveComponent,
  type RoleComponent,
  type RuntimeSnapshot,
  type ToolCall,
  type World,
  type IdentityComponent,
  createRandom,
} from "../core";
import type { ResolvedAgentRuntimeProfile } from "./config/contracts";
import type { ResolvedGameSetup } from "./config/resolve_game_setup";
import { resolvePlayerProfile } from "./config/resolve_game_setup";
import { createAcpConsoleLogger, createConsoleLog, presentGameResult, presentStreamEvents } from "./console_presenter";
import { GameEventRecorder } from "./game_event_recorder";
import {
  buildSessionId,
  resolveDefaultRecordRoot,
  SessionRecordManager,
} from "../recording/session_recorder";
import { runWithSessionRecorder } from "../recording/recording_context";
import { buildDebugSummaryMarkdown } from "../audit/debug_summary_generator";
import { createPlayerAgentRuntime, type PlayerAgentRuntime } from "./player_agent_factory";
import { beginGameReproduction, captureCheckpoint, currentEngineVersion } from "./simulation/reproduction_context";

export interface GameRunResult {
  snapshot: RuntimeSnapshot;
  eventCount: number;
}

class DeadlineAwareActionProvider implements ActionProvider {
  constructor(
    private readonly delegate: ActionProvider,
    private readonly deadlineAtMs: number,
  ) {}

  getAction(request: ActionRequest): Promise<ToolCall | null> {
    return this.delegate.getAction({ ...request, deadlineAtMs: this.deadlineAtMs });
  }
}

/** The caller supplies a fully resolved setup; no configuration I/O happens here. */
export async function runGame(setup: ResolvedGameSetup): Promise<GameRunResult> {
  // P3 will enable the complete English prompt/transport/presentation path.
  if (setup.context.locale !== "zh-CN" || setup.context.displayLocale !== "zh-CN") throw new Error("runtime_locale_execution_not_enabled");
  const context = bootstrapGame(setup.boardConfig, {
    random: createRandom(setup.context.seed),
    playerNames: Object.fromEntries(Object.entries(setup.players).flatMap(([seat, entry]) => entry.name !== undefined ? [[seat, entry.name]] : [])),
  });
  const profilesByActor = selectPlayerProfiles(context.world, setup);
  const sessionId = buildSessionId();
  const recordRoot = setup.options.recordRootDir ?? resolveDefaultRecordRoot();
  const replayManager = await SessionRecordManager.create({
    sessionId,
    locale: setup.context.locale,
    board: setup.options.board,
    startedAtIso: new Date().toISOString(),
    random: context.random.metadata,
  }, recordRoot, setup.context.displayLocale);

  return runWithSessionRecorder(replayManager, async () => {
    const { options } = setup;
    const log = createConsoleLog(options.color);
    const startedAt = Date.now();
    const deadlineAtMs = startedAt + options.maxRuntimeMs;
    const failures: unknown[] = [];
    const eventRecorder = new GameEventRecorder({
      world: context.world,
      replayManager,
    }, context.phaseManager.getSnapshot().phase);
    const flushEvents = () => {
      const delta = eventRecorder.flush(context.phaseManager.getEvents());
      if (options.streamEvents) presentStreamEvents(delta, options.printPrivateEvents, log, setup.context.displayLocale);
    };
    let agentRuntime: PlayerAgentRuntime | undefined;
    let heartbeat: NodeJS.Timeout | undefined;
    let streamTimer: NodeJS.Timeout | undefined;
    let timedOut = false;

    try {
      const reproduction = beginGameReproduction(replayManager, context, { engine: await currentEngineVersion(),
        boardId: options.board, boardConfig: setup.boardConfig, locale: setup.context.locale, maxDays: options.maxDays, profiles: profilesByActor });
      agentRuntime = await createPlayerAgentRuntime({
        world: context.world,
        boardConfig: setup.boardConfig,
        profilesByActor,
        acpWorkspaceRoot: path.join(recordRoot, sessionId, "acp-workspaces"),
        llmTimeoutMs: options.llmTimeoutMs,
        trace: options.trace,
        displayLocale: setup.context.displayLocale,
        colorizeLogs: options.color,
        printLlmIo: options.printLlmIo,
        printThinking: options.printThinking,
        createAcpUpdateObserver: options.printThinking
          ? (actorId) => createAcpConsoleLogger(actorId, log, setup.context.displayLocale)
          : undefined,
      });
      const decisionProvider: ActionProvider = { getAction: request => reproduction.decide(request, agentRuntime!.provider) };
      const provider = new DeadlineAwareActionProvider(decisionProvider, deadlineAtMs);
      log(`[run_game] start board=${options.board} replay_session_id=${sessionId} record_dir=${replayManager.sessionDir} · ${text(setup.context.displayLocale, "runtime.start")}`, "info");

      if (options.trace) {
        heartbeat = setInterval(() => {
          const snapshot = context.phaseManager.getSnapshot();
          log(`[run_game] heartbeat day=${snapshot.day} phase=${snapshot.phase} gameOver=${snapshot.gameOver} elapsed_ms=${Date.now() - startedAt} · ${text(setup.context.displayLocale, "runtime.heartbeat")}`, "muted");
        }, 5000);
      }
      streamTimer = setInterval(() => {
        try {
          flushEvents();
        } catch (error) {
          failures.push(error);
          replayManager.noteReproductionFailure("recording", error);
          if (streamTimer) clearInterval(streamTimer);
        }
      }, 1000);

      let cycle = 0;
      while (!context.phaseManager.getSnapshot().gameOver && failures.length === 0) {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= options.maxRuntimeMs) {
          timedOut = true;
          log(`[run_game] runtime_timeout elapsed_ms=${elapsed} · ${text(setup.context.displayLocale, "runtime.timeout")}`, "warn");
          break;
        }
        cycle++;
        let complete = false;
        let cycleFailure: unknown;
        try { await context.phaseManager.runSingleCycle(provider, options.maxDays); complete = true; }
        catch (error) { cycleFailure = error; failures.push(error); replayManager.noteReproductionFailure("cycle", error); }
        try { reproduction.checkpoint(captureCheckpoint(context.world, context.phaseManager.getSnapshot(), cycle, complete, context.phaseManager.getEvents().length, cycleFailure), context.phaseManager.getEvents()); }
        catch (error) { failures.push(error); reproduction.invalidate(); replayManager.noteReproductionFailure("recording", error); }
        if (failures.length) break;
        const snapshot = context.phaseManager.getSnapshot();
        log(`[run_game] cycle day=${snapshot.day} phase=${snapshot.phase} gameOver=${snapshot.gameOver} elapsed_ms=${Date.now() - startedAt} · ${text(setup.context.displayLocale, "runtime.cycle")}`, "info");
      }
    } catch (error) {
      failures.push(error);
      replayManager.noteReproductionFailure("initialization", error);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (streamTimer) clearInterval(streamTimer);
      try {
        flushEvents();
      } catch (error) {
        failures.push(error);
        replayManager.noteReproductionFailure("recording", error);
      }
      try {
        await agentRuntime?.close();
      } catch (error) {
        failures.push(error);
        replayManager.noteReproductionFailure("cleanup", error);
      }
      try {
        const snapshot = context.phaseManager.getSnapshot();
        const summaryInput = await replayManager.finalize({
          endedAtIso: new Date().toISOString(),
          winner: snapshot.result?.winner ?? null,
          finishReason: failures.length ? "runtime_error"
            : snapshot.result?.reason ?? (timedOut ? "runtime_timeout" : "completed"),
          players: replayPlayers(context.world),
        });
        try {
          await replayManager.writeDebugSummary(await buildDebugSummaryMarkdown({ ...summaryInput, locale: setup.context.locale, displayLocale: setup.context.displayLocale }, setup.audit));
        } catch (error) {
          log(`[audit] debug_summary_failed err=${formatErrorDiagnostic(error, setup.context.displayLocale)}`, "warn");
        }
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, "game_run_failed");
    const snapshot = context.phaseManager.getSnapshot();
    const events = context.phaseManager.getEvents();
    presentGameResult({
      locale: setup.context.displayLocale,
      board: options.board,
      snapshot,
      events,
      timedOut,
      printAllEvents: options.printAllEvents,
      printChat: options.printChat,
      streamEvents: options.streamEvents,
      log,
    });
    return { snapshot, eventCount: events.length };
  });
}

function selectPlayerProfiles(
  world: World,
  setup: ResolvedGameSetup,
): Map<number, ResolvedAgentRuntimeProfile> {
  const profiles = new Map<number, ResolvedAgentRuntimeProfile>();
  for (const id of world.entityIds()) {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role;
    profiles.set(id, resolvePlayerProfile(setup, id, role));
  }
  return profiles;
}

function replayPlayers(world: World) {
  return world.entityIds().map((id) => {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
    return {
      player_id: id,
      role: role?.role ?? "unknown",
      camp: role?.camp ?? "unknown",
      alive: world.getComponent<AliveComponent>(id, COMPONENT.Alive)?.alive === true,
      name: world.getComponent<IdentityComponent>(id, COMPONENT.Identity)?.name,
    };
  });
}
