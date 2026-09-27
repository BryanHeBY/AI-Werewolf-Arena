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
} from "../core";
import type { ResolvedAgentRuntimeProfile } from "./config/contracts";
import type { ResolvedGameSetup } from "./config/resolve_game_setup";
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
  const context = bootstrapGame(setup.boardConfig);
  const profilesByActor = selectPlayerProfiles(context.world, setup);
  const sessionId = buildSessionId();
  const recordRoot = setup.options.recordRootDir ?? resolveDefaultRecordRoot();
  const replayManager = await SessionRecordManager.create({
    sessionId,
    board: setup.options.board,
    startedAtIso: new Date().toISOString(),
  }, recordRoot);

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
      if (options.streamEvents) presentStreamEvents(delta, options.printPrivateEvents, log);
    };
    let agentRuntime: PlayerAgentRuntime | undefined;
    let heartbeat: NodeJS.Timeout | undefined;
    let streamTimer: NodeJS.Timeout | undefined;
    let timedOut = false;

    try {
      agentRuntime = await createPlayerAgentRuntime({
        world: context.world,
        boardConfig: setup.boardConfig,
        profilesByActor,
        acpWorkspaceRoot: path.join(recordRoot, sessionId, "acp-workspaces"),
        llmTimeoutMs: options.llmTimeoutMs,
        trace: options.trace,
        colorizeLogs: options.color,
        printLlmIo: options.printLlmIo,
        printThinking: options.printThinking,
        defaultForceJsonResponse: setup.defaultProfile.forceJsonResponse ?? true,
        createAcpUpdateObserver: options.printThinking
          ? (actorId) => createAcpConsoleLogger(actorId, log)
          : undefined,
      });
      const provider = new DeadlineAwareActionProvider(agentRuntime.provider, deadlineAtMs);
      log(`[run_game] start board=${options.board} replay_session_id=${sessionId} record_dir=${replayManager.sessionDir}`, "info");

      if (options.trace) {
        heartbeat = setInterval(() => {
          const snapshot = context.phaseManager.getSnapshot();
          log(`[run_game] heartbeat day=${snapshot.day} phase=${snapshot.phase} gameOver=${snapshot.gameOver} elapsed_ms=${Date.now() - startedAt}`, "muted");
        }, 5000);
      }
      streamTimer = setInterval(() => {
        try {
          flushEvents();
        } catch (error) {
          failures.push(error);
          if (streamTimer) clearInterval(streamTimer);
        }
      }, 1000);

      while (!context.phaseManager.getSnapshot().gameOver && failures.length === 0) {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= options.maxRuntimeMs) {
          timedOut = true;
          log(`[run_game] runtime_timeout elapsed_ms=${elapsed}, stop current run and output partial state`, "warn");
          break;
        }
        await context.phaseManager.runSingleCycle(provider, options.maxDays);
        const snapshot = context.phaseManager.getSnapshot();
        log(`[run_game] cycle day=${snapshot.day} phase=${snapshot.phase} gameOver=${snapshot.gameOver} elapsed_ms=${Date.now() - startedAt}`, "info");
      }
    } catch (error) {
      failures.push(error);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (streamTimer) clearInterval(streamTimer);
      try {
        flushEvents();
      } catch (error) {
        failures.push(error);
      }
      try {
        await agentRuntime?.close();
      } catch (error) {
        failures.push(error);
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
          await replayManager.writeDebugSummary(await buildDebugSummaryMarkdown(summaryInput, setup.audit));
        } catch (error) {
          log(`[audit] debug_summary_failed err=${String(error)}`, "warn");
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
    profiles.set(id,
      setup.playerProfiles[String(id)]
        ?? (role ? setup.roleProfiles[role] : undefined)
        ?? setup.defaultProfile,
    );
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
    };
  });
}
