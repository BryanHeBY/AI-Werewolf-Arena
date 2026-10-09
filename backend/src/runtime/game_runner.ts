import { initialPlayerIdentity } from "../core/domain/initial_roster";
import { inheritWildChildDeadlineRequest } from "../game/mechanisms/roles/wild_child/lifecycle";
import { initialIdentityDeal } from "../game/mechanisms/roles/initial_identity/deal";
import { inheritInitialIdentityDeadlineRequest } from "../game/mechanisms/roles/initial_identity/setup";
import { inheritWallDeadlineRequest } from "../game/mechanisms/events/wall_notes/authority";
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
import {
  createAcpConsoleLogger,
  createConsoleLog,
  presentGameResult,
  presentStreamEvents,
} from "./console_presenter";
import { GameEventRecorder } from "./game_event_recorder";
import {
  buildSessionId,
  resolveDefaultRecordRoot,
  SessionRecordManager,
} from "../recording/session_recorder";
import { runWithSessionRecorder } from "../recording/recording_context";
import { buildDebugSummaryMarkdown } from "../audit/debug_summary_generator";
import { createPlayerAgentRuntime, type PlayerAgentRuntime } from "./player_agent_factory";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "./simulation/reproduction_context";

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
    const timed = { ...request, deadlineAtMs: this.deadlineAtMs };
    inheritWallDeadlineRequest(request, timed);
    inheritInitialIdentityDeadlineRequest(request, timed);
    inheritWildChildDeadlineRequest(request, timed);
    return this.delegate.getAction(timed);
  }
}

/** The caller supplies a fully resolved setup; no configuration I/O happens here. */
export async function runGame(setup: ResolvedGameSetup): Promise<GameRunResult> {
  const context = bootstrapGame(setup.boardConfig, {
    random: createRandom(setup.context.seed),
    locale: setup.context.locale,
    playerNames: Object.fromEntries(
      Object.entries(setup.players).flatMap(([seat, entry]) =>
        entry.name !== undefined ? [[seat, entry.name]] : [],
      ),
    ),
  });
  const profilesByActor = selectPlayerProfiles(context.world, setup);
  const sessionId = buildSessionId();
  const recordRoot = setup.options.recordRootDir ?? resolveDefaultRecordRoot();
  const replayManager = await SessionRecordManager.create(
    {
      sessionId,
      locale: setup.context.locale,
      board: setup.options.board,
      startedAtIso: new Date().toISOString(),
      random: context.random.metadata,
    },
    recordRoot,
    setup.context.displayLocale,
  );

  return runWithSessionRecorder(replayManager, async () => {
    const { options } = setup;
    const log = createConsoleLog(options.color);
    const startedAt = Date.now();
    const deadlineAtMs = startedAt + options.maxRuntimeMs;
    const failures: unknown[] = [];
    const eventRecorder = new GameEventRecorder(
      {
        world: context.world,
        replayManager,
      },
      context.phaseManager.getSnapshot().phase,
    );
    const flushEvents = () => {
      const delta = eventRecorder.flush(context.phaseManager.getEvents());
      if (options.streamEvents)
        presentStreamEvents(delta, options.printPrivateEvents, log, setup.context.displayLocale);
    };
    let agentRuntime: PlayerAgentRuntime | undefined;
    let heartbeat: NodeJS.Timeout | undefined;
    let streamTimer: NodeJS.Timeout | undefined;
    let timedOut = false;
    let stopping = false;
    let closing: Promise<void> | undefined;
    const stopReason = new DOMException("game_actions_stopped", "AbortError");
    const inFlight = new Set<Promise<ToolCall | null>>();
    const actionFailures: unknown[] = [];
    const cleanupFailures: unknown[] = [];
    const closeRuntime = (): Promise<void> => {
      stopping = true;
      closing ??= Promise.resolve()
        .then(() => agentRuntime?.close())
        .catch((error) => {
          cleanupFailures.push(error);
        });
      return closing;
    };
    const drainActions = async () => {
      while (inFlight.size) await Promise.allSettled([...inFlight]);
    };

    try {
      const reproduction = beginGameReproduction(replayManager, context, {
        engine: await currentEngineVersion(),
        boardId: options.board,
        boardConfig: setup.boardConfig,
        locale: setup.context.locale,
        maxDays: options.maxDays,
        profiles: profilesByActor,
      });
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
        createAcpUpdateObserver:
          options.printThinking || options.printLlmIo
            ? (actorId) =>
                createAcpConsoleLogger(actorId, log, setup.context.displayLocale, {
                  printThinking: options.printThinking,
                  printLlmIo: options.printLlmIo,
                })
            : undefined,
      });
      const selectedProvider: ActionProvider = {
        async getAction(request) {
          if (stopping) throw stopReason;
          const action = await agentRuntime!.provider.getAction(request);
          if (stopping) throw stopReason;
          return action;
        },
      };
      const decisionProvider: ActionProvider = {
        getAction: (request) => {
          const decision = reproduction.decide(request, selectedProvider);
          let tracked!: Promise<ToolCall | null>;
          tracked = decision.then(
            (action) => {
              inFlight.delete(tracked);
              return action;
            },
            (error) => {
              inFlight.delete(tracked);
              if (error !== stopReason) actionFailures.push(error);
              // The recorder seals this decision before cancellation starts, keeping
              // the original error's causal position ahead of cancelled peers.
              void closeRuntime();
              throw error;
            },
          );
          inFlight.add(tracked);
          return tracked;
        },
      };
      const provider = new DeadlineAwareActionProvider(decisionProvider, deadlineAtMs);
      log(
        `[run_game] start board=${options.board} replay_session_id=${sessionId} record_dir=${replayManager.sessionDir} · ${text(setup.context.displayLocale, "runtime.start")}`,
        "info",
      );

      if (options.trace) {
        heartbeat = setInterval(() => {
          const snapshot = context.phaseManager.getSnapshot();
          log(
            `[run_game] heartbeat day=${snapshot.day} phase=${snapshot.phase} gameOver=${snapshot.gameOver} elapsed_ms=${Date.now() - startedAt} · ${text(setup.context.displayLocale, "runtime.heartbeat")}`,
            "muted",
          );
        }, 5000);
      }
      streamTimer = setInterval(() => {
        try {
          flushEvents();
        } catch (error) {
          failures.push(error);
          replayManager.noteReproductionFailure("recording", error);
          void closeRuntime();
          if (streamTimer) clearInterval(streamTimer);
        }
      }, 1000);

      let cycle = 0;
      while (!context.phaseManager.getSnapshot().gameOver && failures.length === 0) {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= options.maxRuntimeMs) {
          timedOut = true;
          log(
            `[run_game] runtime_timeout elapsed_ms=${elapsed} · ${text(setup.context.displayLocale, "runtime.timeout")}`,
            "warn",
          );
          break;
        }
        cycle++;
        let complete = false;
        let cycleFailure: unknown;
        try {
          await context.phaseManager.runSingleCycle(provider, options.maxDays);
          complete = true;
        } catch (error) {
          cycleFailure = error;
          if (error !== stopReason) failures.push(error);
          replayManager.noteReproductionFailure("cycle", error);
          await closeRuntime();
          await drainActions();
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
          replayManager.noteReproductionFailure("recording", error);
        }
        if (failures.length) break;
        const snapshot = context.phaseManager.getSnapshot();
        log(
          `[run_game] cycle day=${snapshot.day} phase=${snapshot.phase} gameOver=${snapshot.gameOver} elapsed_ms=${Date.now() - startedAt} · ${text(setup.context.displayLocale, "runtime.cycle")}`,
          "info",
        );
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
      await closeRuntime();
      await drainActions();
      for (const error of actionFailures)
        if (!failures.includes(error)) {
          failures.push(error);
          replayManager.noteReproductionFailure("controller", error);
        }
      for (const error of cleanupFailures) {
        failures.push(error);
        replayManager.noteReproductionFailure("cleanup", error);
      }
      try {
        const snapshot = context.phaseManager.getSnapshot();
        const summaryInput = await replayManager.finalize({
          endedAtIso: new Date().toISOString(),
          winner: snapshot.result?.winner ?? null,
          ...(snapshot.result ? { gameResult: snapshot.result } : {}),
          finishReason: failures.length
            ? "runtime_error"
            : (snapshot.result?.reason ?? (timedOut ? "runtime_timeout" : "completed")),
          players: replayPlayers(context.world),
        });
        try {
          await replayManager.writeDebugSummary(
            await buildDebugSummaryMarkdown(
              {
                ...summaryInput,
                locale: setup.context.locale,
                displayLocale: setup.context.displayLocale,
              },
              setup.audit,
            ),
          );
        } catch (error) {
          log(
            `[audit] debug_summary_failed err=${formatErrorDiagnostic(error, setup.context.displayLocale)}`,
            "warn",
          );
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
  const initial = initialIdentityDeal(world);
  return world.entityIds().map((id, index) => {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
    return {
      player_id: id,
      role: initialPlayerIdentity(world, id)?.role ?? initial?.[index] ?? role?.role ?? "unknown",
      camp:
        initialPlayerIdentity(world, id)?.camp ??
        (initial ? (initial[index] === "wolf" ? "wolf" : "good") : (role?.camp ?? "unknown")),
      alive: world.getComponent<AliveComponent>(id, COMPONENT.Alive)?.alive === true,
      name: world.getComponent<IdentityComponent>(id, COMPONENT.Identity)?.name,
    };
  });
}
