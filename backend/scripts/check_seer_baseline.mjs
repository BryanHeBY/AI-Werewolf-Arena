import { mkdtemp, mkdir, readdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const root = await mkdtemp(path.join(tmpdir(), "awa-seer-baseline-"));
const baseline = "eb4f026a38205d420cc2172b32fe23a29cb00da0";
try {
  const archive = spawnSync("git", ["archive", baseline, "backend/src", "packages"], {
    cwd: repo,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (archive.status !== 0) throw new Error(archive.stderr.toString());
  const extracted = spawnSync("tar", ["-x", "-C", root], { input: archive.stdout });
  if (extracted.status !== 0) throw new Error(extracted.stderr.toString());
  const deps = path.join(root, "backend/node_modules");
  await mkdir(deps);
  for (const name of await readdir(path.join(repo, "backend/node_modules"))) {
    if (name === "@ai-werewolf-arena") {
      await mkdir(path.join(deps, name));
      for (const pkg of await readdir(path.join(repo, "backend/node_modules", name)))
        await symlink(path.join(root, "packages", pkg), path.join(deps, name, pkg));
    } else await symlink(path.join(repo, "backend/node_modules", name), path.join(deps, name));
  }
  for (const name of ["game-text", "replay-contract"])
    await symlink(deps, path.join(root, "packages", name, "node_modules"));
  await writeFile(
    path.join(root, "probe.ts"),
    `
import { bootstrapGame } from './backend/src/app/bootstrap';
import { sixPlayerMvpConfig } from './backend/src/runtime/scenarios/six_player_mvp';
import { Role } from './backend/src/core';
const game = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: [Role.Guard, Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer] });
let actual;
await game.phaseManager.runSingleCycle({ async getAction(request) {
  if (request.context.stage === 'seer') actual = { actorId: request.actorId, day: request.context.day, stage: request.context.stage, allowedTools: request.allowedTools, turn_constraints: request.context.turn_constraints };
  return null;
}}, 1);
if (!actual || actual.turn_constraints.min_valid_actions !== 1) throw new Error('baseline_seer_not_required');
console.log(JSON.stringify({baseline: '${baseline}', request: actual}, null, 2));
`,
  );
  const probe = spawnSync("bun", [path.join(root, "probe.ts")], { cwd: root });
  if (probe.status !== 0) throw new Error(probe.stderr.toString());
  const actual = JSON.parse(probe.stdout.toString());
  const { readFile } = await import("node:fs/promises");
  const fixture = JSON.parse(
    await readFile(path.join(repo, "backend/tests/support/seer_baseline_request.json"), "utf8"),
  );
  if (JSON.stringify(actual) !== JSON.stringify(fixture))
    throw new Error("baseline_fixture_mismatch");
  console.log(JSON.stringify(actual, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
