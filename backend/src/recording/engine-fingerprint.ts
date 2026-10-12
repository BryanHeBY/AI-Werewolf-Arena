/**
 * Responsibility: identify all maintained engine, runtime, agent, recording and
 * shared-package source bytes used by a native reproduction build.
 * Input: explicit repository root; output: ordered public paths and source/lock
 * SHA-256. This filesystem adapter owns no World, rules or compatibility policy.
 * Paths, comments, dictionaries, inert schemas and package/primary compiler
 * manifests participate in exact identity.
 * Local configuration/auth, dependencies, generated records and tests are outside
 * this source scope; dependency versions are represented by the unchanged lock.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, lstat } from "node:fs/promises";
import path from "node:path";

export const ENGINE_FINGERPRINT_POLICY = "awa-all-runtime-and-shared-source-v2" as const;
const privateDirectories = new Set(["node_modules", ".git", ".codex", ".agents", ".aws"]);

/** Enumerate source membership deterministically without following source symlinks. */
export async function engineFingerprintInputs(repositoryRoot: string): Promise<string[]> {
  const root = path.resolve(repositoryRoot),
    files: string[] = [];
  const rejectSymlinkAncestors = async (relative: string) => {
    let current = root;
    for (const segment of relative.split("/")) {
      current = path.join(current, segment);
      if ((await lstat(current)).isSymbolicLink()) throw Error("engine_source_symlink_rejected");
    }
  };
  for (const manifest of [
    "package.json",
    "backend/package.json",
    "frontend/package.json",
    "bunfig.toml",
  ]) {
    try {
      await rejectSymlinkAncestors(manifest);
      files.push(manifest);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const compilerManifests = async (owner: string) => {
    try {
      if (owner) await rejectSymlinkAncestors(owner);
      for (const entry of await readdir(path.join(root, owner), { withFileTypes: true })) {
        if (!/^tsconfig(?:\.[^.]+)*\.json$/.test(entry.name)) continue;
        const name = path.posix.join(owner, entry.name);
        await rejectSymlinkAncestors(name);
        if (entry.isFile()) files.push(name);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  for (const owner of ["", "backend", "frontend"]) await compilerManifests(owner);
  const walk = async (relative: string): Promise<void> => {
    await rejectSymlinkAncestors(relative);
    for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true })).sort(
      (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    )) {
      if (
        privateDirectories.has(entry.name) ||
        entry.name.startsWith(".env") ||
        ["auth.json", "credentials.json"].includes(entry.name)
      )
        continue;
      const name = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw Error("engine_source_symlink_rejected");
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) files.push(name);
    }
  };
  await walk("backend/src");
  await rejectSymlinkAncestors("packages");
  for (const entry of (await readdir(path.join(root, "packages"), { withFileTypes: true })).sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )) {
    if (privateDirectories.has(entry.name) || entry.name.startsWith(".env")) continue;
    if (entry.isSymbolicLink()) throw Error("engine_source_symlink_rejected");
    if (!entry.isDirectory()) continue;
    const manifest = `packages/${entry.name}/package.json`;
    try {
      await rejectSymlinkAncestors(manifest);
      files.push(manifest);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await compilerManifests(`packages/${entry.name}`);
    const source = `packages/${entry.name}/src`;
    try {
      await readdir(path.join(root, source));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    await walk(source);
  }
  return [...new Set(files)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function fingerprintEngine(
  repositoryRoot: string,
): Promise<{ sourceHash: string; lockHash: string }> {
  const root = path.resolve(repositoryRoot),
    hash = createHash("sha256");
  if ((await lstat(path.join(root, "bun.lock"))).isSymbolicLink())
    throw Error("engine_source_symlink_rejected");
  for (const name of await engineFingerprintInputs(root))
    hash
      .update(name)
      .update("\0")
      .update(await readFile(path.join(root, name)))
      .update("\0");
  return {
    sourceHash: hash.digest("hex"),
    lockHash: createHash("sha256")
      .update(await readFile(path.join(root, "bun.lock")))
      .digest("hex"),
  };
}
