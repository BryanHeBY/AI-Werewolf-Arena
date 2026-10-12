/**
 * Responsibility: assemble privileged native reproduction metadata and checkpoints.
 * Input: original World, engine phase snapshot, exact board/RNG and recorder;
 * output: archival God-state snapshots and a decision trace, never player knowledge.
 * The recorder owns persistence; domain authorities retain original-state write
 * ownership. Snapshotting neither authorizes actions nor reruns settlement rules.
 * Exact source/lock fingerprinting delegates to recording/engine-fingerprint;
 * failure checkpoints preserve committed prefixes and causal cursor boundaries.
 * Board metadata and cursor policy resolve from the existing World owner; foreign
 * context aliases refuse before snapshots or recording and never replace that owner.
 */
import { requireBoardParameters } from "../../rulesets/board-parameters";
import { fingerprintEngine } from "../../recording/engine-fingerprint";
import { animalCheckpointSchema } from "../../recording/animal_dream_checkpoint";
import {
  animalAuthoritySnapshot,
  isAnimalDreamBoard,
} from "../../game/mechanisms/roles/animal_dream/authority";
import {
  animalOriginalAuditPlayer,
  animalOriginalAuditIds,
} from "../../game/mechanisms/roles/animal_dream/roster";
import { snapshotPlainData } from "../../core/domain/plain_data";
import { aliveLifeDescriptor } from "../../core/domain/components/alive";
function auditData(value: unknown, keys: readonly string[]): unknown {
  if (!value || typeof value !== "object") throw Error("animal_audit_data_invalid");
  const descriptors = Object.fromEntries(
    keys.flatMap((key) => {
      const d = Object.getOwnPropertyDescriptor(value, key);
      return d ? [[key, d]] : [];
    }),
  );
  if (Object.values(descriptors).some((d) => !("value" in d)))
    throw Error("animal_audit_data_invalid");
  return snapshotPlainData(
    Object.fromEntries(
      Object.entries(descriptors)
        .filter(([, d]) => d.value !== undefined)
        .map(([key, d]) => [key, d.value]),
    ),
  );
}
import { fragrantCheckpointSchema } from "../../recording/fragrant_pair_seer_checkpoint";
import {
  fragrantAuthoritySnapshot,
  fragrantCheckpointPrivateState,
  isFragrantPairBoard,
} from "../../game/mechanisms/roles/fragrant_pair_seer/authority";
import { nobleBodyCheckpointSchema } from "../../recording/noble_secret_body_checkpoint";
import {
  checkpointNobleBodyAuthority,
  isNobleBodyBoard,
} from "../../game/mechanisms/roles/noble_secret_body/authority";
import { getSessionRecorder } from "../../recording/recording_context";
import { demonHunterCheckpointPlayers } from "../../game/mechanisms/roles/demon_hunter/authority";
import {
  weddingSetup,
  weddingAuditPlayer,
} from "../../game/mechanisms/roles/ghost_bride/authority";
import {
  projectLonelyGirl,
  projectLonelyGirlSetup,
  projectLonelyGirlVictory,
  projectLonelyGirlAuditPlayer,
} from "../../game/mechanisms/roles/lonely_girl/lifecycle";
import { initialIdentityDeal } from "../../game/mechanisms/roles/initial_identity/deal";
import { projectThiefSetup } from "../../game/mechanisms/roles/thief/deal";
import { projectShapeshifterSetup } from "../../game/mechanisms/roles/shapeshifter/deal";
import { projectWallNote } from "../../game/mechanisms/events/wall_notes/authority";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  COMPONENT,
  type AliveComponent,
  type BadgeComponent,
  type IdentityComponent,
  type RoleComponent,
  type RuntimeSnapshot,
  type StatusMarksComponent,
  type VotingRightComponent,
  type World,
  type VictoryComponent,
} from "../../core";
import type { EngineVersion, RecordedCheckpoint } from "../../recording/reproduction";
import { recordedErrorName } from "../../recording/reproduction";
import { RULESET, type Locale } from "@ai-werewolf-arena/game-catalog";
import type { BootstrapResult } from "../../app/bootstrap";
import type { BoardConfig } from "../../core";
import type { ResolvedAgentRuntimeProfile } from "../config/contracts";
import type { SessionRecordManager } from "../../recording/session_recorder";

/** Source and lock hashes make compatibility explicit even with an uncommitted engine edit. */
export async function currentEngineVersion(
  sourceRoot: string = path.resolve(__dirname, "../../../.."),
): Promise<EngineVersion> {
  const root = path.resolve(sourceRoot);
  const { sourceHash, lockHash } = await fingerprintEngine(root);
  let commit: string | undefined;
  try {
    const value = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (/^[a-f0-9]{40}$/.test(value)) commit = value;
  } catch {
    /* Source/lock fingerprints remain sufficient in an archive without .git. */
  }
  return {
    id: "awa-engine",
    sourceHash,
    lockHash,
    ...(commit ? { commit } : {}),
  };
}

export function captureCheckpoint(
  world: World,
  snapshot: RuntimeSnapshot,
  cycle: number,
  complete: boolean,
  eventCount: number,
  failure?: unknown,
  cursors?: { settlementCount: number; decisionCount: number },
): RecordedCheckpoint {
  const animal = isAnimalDreamBoard(world) ? animalAuthoritySnapshot(world, complete) : null;
  if (isAnimalDreamBoard(world) && !animal) throw Error("animal_checkpoint_unavailable");
  const ghostBrideSetup = weddingSetup(world);
  const lonelyGirlSetup = projectLonelyGirlSetup(world);
  const thiefSetup = projectThiefSetup(world),
    shapeshifterSetup = projectShapeshifterSetup(world);
  return {
    ...(isAnimalDreamBoard(world)
      ? { animalDream: animalCheckpointSchema.parse(animalAuthoritySnapshot(world, complete)) }
      : {}),
    ...(isFragrantPairBoard(world)
      ? { fragrantPair: fragrantCheckpointSchema.parse(fragrantAuthoritySnapshot(world, complete)) }
      : {}),
    ...(isNobleBodyBoard(world)
      ? {
          nobleBody: nobleBodyCheckpointSchema.parse(checkpointNobleBodyAuthority(world, complete)),
        }
      : {}),
    ...(isAnimalDreamBoard(world) || isNobleBodyBoard(world) || isFragrantPairBoard(world)
      ? {
          operationCount: getSessionRecorder()?.reproductionOperationCount ?? 0,
          settlementCount:
            cursors?.settlementCount ?? getSessionRecorder()?.reproductionSettlementCount ?? 0,
          decisionCount:
            cursors?.decisionCount ?? getSessionRecorder()?.reproductionDecisionCount ?? 0,
        }
      : {}),
    ...(lonelyGirlSetup ? { lonelyGirlSetup } : {}),
    ...(ghostBrideSetup ? { ghostBrideSetup } : {}),
    ...(thiefSetup ? { thiefSetup } : {}),
    ...(shapeshifterSetup ? { shapeshifterSetup } : {}),
    cycle,
    complete,
    snapshot,
    eventCount,
    ...(!complete
      ? { failure: { name: recordedErrorName(failure), code: "cycle_failed" as const } }
      : {}),
    players:
      demonHunterCheckpointPlayers(world, complete) ??
      (animalOriginalAuditIds(world) ?? world.entityIds()).map((id) => {
        const original = animal ? animalOriginalAuditPlayer(world, id) : null;
        const identity = original
          ? (JSON.parse(original.identityJson) as IdentityComponent)
          : world.getComponent(id, COMPONENT.Identity)!;
        const role = original?.scope.role ?? world.getComponent(id, COMPONENT.Role)!;
        const badge = original
          ? (auditData(original.audit.badge, [
              "isSheriff",
              "destroyed",
              "voteWeight",
              "handoffPolicy",
            ]) as BadgeComponent)
          : world.getComponent(id, COMPONENT.Badge)!;
        const vote = original
          ? (auditData(original.audit.vote, ["weight", "canVote"]) as VotingRightComponent)
          : world.getComponent(id, COMPONENT.VotingRight)!;
        const weddingAudit = weddingAuditPlayer(world, id, !complete);
        const audit = weddingAudit ?? projectLonelyGirlAuditPlayer(world, id);
        const wall = projectWallNote(world, id);
        const wallNote = wall
          ? {
              instanceId: wall.instanceId,
              source: { ...wall.source },
              remaining: wall.remaining,
              expired: wall.expired,
            }
          : undefined;
        return {
          id,
          seat: identity.seat,
          name: identity.name,
          role: (original?.scope.roleId as RoleComponent["role"]) ?? audit?.role ?? role.role,
          camp: original?.scope.campValue ?? audit?.camp ?? role.camp,
          alive: original
            ? aliveLifeDescriptor(original.scope.life)!.get!.call(original.scope.life)
            : (audit?.alive ?? world.getComponent(id, COMPONENT.Alive)!.alive),
          privateState:
            (animal && original
              ? id === animal.foxId
                ? { foxCub: animal.fox }
                : id === animal.catId
                  ? { whiteCat: animal.cat }
                  : id === animal.pufferId
                    ? { pufferfish: animal.puffer }
                    : (snapshotPlainData(original.privateState) as Record<string, unknown>)
              : null) ??
            fragrantCheckpointPrivateState(world, id, complete) ??
            audit?.privateState ??
            (projectLonelyGirl(world, role)
              ? { lonelyGirl: projectLonelyGirl(world, role) }
              : structuredClone(role.privateState)),
          ...(wallNote ? { wallNote } : {}),
          ...(world.getComponent(id, COMPONENT.DebatePenalty)
            ? {
                debatePenalty: structuredClone(world.getComponent(id, COMPONENT.DebatePenalty)!),
              }
            : {}),
          ...(world.getComponent(id, COMPONENT.Lovers)
            ? {
                lovers: structuredClone(world.getComponent(id, COMPONENT.Lovers)!),
              }
            : {}),
          victory:
            (original ? (JSON.parse(original.victoryJson) as VictoryComponent) : null) ??
            (weddingAudit ? { affiliations: weddingAudit.victory } : null) ??
            projectLonelyGirlVictory(world, id) ??
            structuredClone(world.getComponent(id, COMPONENT.Victory)!),
          vote: { weight: vote.weight, canVote: vote.canVote },
          badge: {
            isSheriff: badge.isSheriff,
            destroyed: badge.destroyed,
            voteWeight: badge.voteWeight,
            ...(badge.handoffPolicy ? { handoffPolicy: badge.handoffPolicy } : {}),
          },
          marks: (
            (original?.audit.marks as StatusMarksComponent | undefined) ??
            world.getComponent(id, COMPONENT.StatusMarks)!
          ).values(),
        };
      }),
  };
}

export function beginGameReproduction(
  manager: SessionRecordManager,
  context: BootstrapResult,
  options: {
    engine: EngineVersion;
    boardId: string;
    locale: Locale;
    maxDays: number;
    profiles?: ReadonlyMap<number, ResolvedAgentRuntimeProfile>;
  },
) {
  const parameters = requireBoardParameters(context.world);
  if (context.parameters !== parameters || context.boardConfig !== parameters.board)
    throw new Error("rule_parameters_context_mismatch");
  const initial = captureCheckpoint(
    context.world,
    context.phaseManager.getSnapshot(),
    0,
    true,
    context.phaseManager.getEvents().length,
  );
  const trace = manager.beginReproduction(
    {
      engine: options.engine,
      boardId: options.boardId,
      normalizedBoard: parameters.encode(),
      locale: options.locale,
      maxDays: options.maxDays,
      dealMode: context.dealMode,
      ...(context.phaseManager.getFaultPlan()
        ? { faultPlan: context.phaseManager.getFaultPlan() }
        : {}),
      ...(initialIdentityDeal(context.world)
        ? { initialDeal: [...initialIdentityDeal(context.world)!] }
        : {}),
      ruleset: RULESET,
      random: context.random.metadata,
      players: initial.players.map((player) => {
        const profile = options.profiles?.get(player.id);
        return {
          id: player.id,
          name: player.name,
          role: player.role,
          camp: player.camp,
          ...(profile
            ? {
                agent: {
                  kind: profile.kind,
                  name: profile.name,
                  ...(profile.model ? { model: profile.model } : {}),
                },
              }
            : {}),
        };
      }),
    },
    parameters.board.radiantEclipse ||
      parameters.board.nobleSecretBody ||
      parameters.board.fragrantPairSeer ||
      parameters.board.animalDream
      ? () => context.phaseManager.getEvents()
      : undefined,
  );
  trace.checkpoint(initial, context.phaseManager.getEvents());
  return trace;
}
