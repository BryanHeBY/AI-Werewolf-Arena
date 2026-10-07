import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { COMPONENT, type AliveComponent, type BadgeComponent, type IdentityComponent, type RoleComponent, type RuntimeSnapshot, type StatusMarksComponent, type VotingRightComponent, type World } from "../../core";
import type { EngineVersion, RecordedCheckpoint } from "../../recording/reproduction";
import { recordedErrorName } from "../../recording/reproduction";
import { RULESET, type Locale } from "@ai-werewolf-arena/game-catalog";
import type { BootstrapResult } from "../../app/bootstrap";
import type { BoardConfig } from "../../core";
import type { ResolvedAgentRuntimeProfile } from "../config/contracts";
import type { SessionRecordManager } from "../../recording/session_recorder";

/** Source and lock hashes make compatibility explicit even with an uncommitted engine edit. */
export async function currentEngineVersion(): Promise<EngineVersion> {
  const root = path.resolve(__dirname, "../../../..");
  const hash = createHash("sha256");
  const walk = async (directory: string) => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith(".ts")) { hash.update(path.relative(root, file).replaceAll(path.sep, "/")); hash.update("\0"); hash.update(await readFile(file)); hash.update("\0"); }
    }
  };
  for (const directory of ["backend/src/core", "backend/src/game", "backend/src/app", "packages/game-catalog/src"]) await walk(path.join(root, directory));
  const lockHash = createHash("sha256").update(await readFile(path.join(root, "bun.lock"))).digest("hex");
  let commit: string | undefined;
  try {
    const value = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (/^[a-f0-9]{40}$/.test(value)) commit = value;
  } catch { /* Source/lock fingerprints remain sufficient in an archive without .git. */ }
  return { id: "awa-engine", sourceHash: hash.digest("hex"), lockHash, ...(commit ? { commit } : {}) };
}

export function captureCheckpoint(world: World, snapshot: RuntimeSnapshot, cycle: number, complete: boolean, eventCount: number, failure?: unknown): RecordedCheckpoint {
  return { cycle, complete, snapshot, eventCount, ...(!complete ? { failure: { name: recordedErrorName(failure), code: "cycle_failed" as const } } : {}), players: world.entityIds().map(id => {
    const identity = world.getComponent<IdentityComponent>(id, COMPONENT.Identity)!;
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
    const badge = world.getComponent<BadgeComponent>(id, COMPONENT.Badge)!;
    const vote = world.getComponent<VotingRightComponent>(id, COMPONENT.VotingRight)!;
    return { id, seat: identity.seat, name: identity.name, role: role.role, camp: role.camp, alive: world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive,
      privateState: structuredClone(role.privateState), vote: { weight: vote.weight, canVote: vote.canVote },
      badge: { isSheriff: badge.isSheriff, destroyed: badge.destroyed, voteWeight: badge.voteWeight }, marks: world.getComponent<StatusMarksComponent>(id, COMPONENT.StatusMarks)!.values() };
  }) };
}

export function beginGameReproduction(manager: SessionRecordManager, context: BootstrapResult, options: {
  engine: EngineVersion; boardId: string; boardConfig: BoardConfig; locale: Locale; maxDays: number;
  profiles?: ReadonlyMap<number, ResolvedAgentRuntimeProfile>;
}) {
  const initial = captureCheckpoint(context.world, context.phaseManager.getSnapshot(), 0, true, context.phaseManager.getEvents().length);
  const trace = manager.beginReproduction({ engine: options.engine, boardId: options.boardId, normalizedBoard: options.boardConfig,
    locale: options.locale, maxDays: options.maxDays, dealMode: context.dealMode, ruleset: RULESET, random: context.random.metadata,
    players: initial.players.map(player => {
      const profile = options.profiles?.get(player.id);
      return { id: player.id, name: player.name, role: player.role, camp: player.camp,
        ...(profile ? { agent: { kind: profile.kind, name: profile.name, ...(profile.model ? { model: profile.model } : {}) } } : {}) };
    }),
  });
  trace.checkpoint(initial, context.phaseManager.getEvents());
  return trace;
}
