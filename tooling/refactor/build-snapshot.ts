/**
 * Freeze public production inputs for the two-build refactor comparison.
 * Input: an explicit Git revision or current source tree; output: immutable-by-
 * verification source/lock manifest and an isolated dependency resolution tree.
 * Workspace packages resolve inside each snapshot. Installed external libraries
 * are copied only when their resolved lock entries match the requested build.
 * Dependency bytes are verified before/after execution; this detects edits and is not
 * filesystem write protection. Local auth/config/records/Git are never copied.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  readlink,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { isPublicInventoryPath } from "./inventory";

export interface BuildSnapshot {
  root: string;
  revision: string | null;
  files: Array<{ path: string; sha256: string }>;
  digest: string;
  dependencies: { root: string; digest: string };
}
const hash = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const buildMetadata = [
  "package.json",
  "bun.lock",
  "bunfig.toml",
  "tsconfig.json",
  "backend/package.json",
  "frontend/package.json",
  "backend/tsconfig.json",
  "frontend/tsconfig.json",
];

async function rejectSourceSymlinkAncestors(root: string, relative: string): Promise<void> {
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    if ((await lstat(current)).isSymbolicLink()) throw Error("snapshot_source_ancestor_symlink");
  }
}

async function existingBuildMetadata(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const name of buildMetadata) {
    try {
      await rejectSourceSymlinkAncestors(root, name);
      if (!(await lstat(path.join(root, name))).isFile())
        throw Error(`snapshot_source_not_file: ${name}`);
      result.push(name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const owner of ["", "backend", "frontend"]) {
    let entries: import("node:fs").Dirent[];
    try {
      if (owner) await rejectSourceSymlinkAncestors(root, owner);
      entries = await readdir(path.join(root, owner), { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!/^tsconfig(?:\.[^.]+)*\.json$/.test(entry.name)) continue;
      if (!entry.isFile()) throw Error("snapshot_compiler_metadata_not_file");
      result.push(path.posix.join(owner, entry.name));
    }
  }
  return [...new Set(result)];
}

const sourcePath = (name: string) =>
  isPublicInventoryPath(name) &&
  (/^(backend\/src\/|packages\/[^/]+\/(?:src\/|package\.json$|tsconfig(?:\.[^.]+)*\.json$))/.test(
    name,
  ) ||
    buildMetadata.includes(name) ||
    /^(?:backend\/|frontend\/)?tsconfig(?:\.[^.]+)*\.json$/.test(name));

async function listFiles(root: string, directory: string): Promise<string[]> {
  await rejectSourceSymlinkAncestors(root, directory);
  const result: string[] = [];
  for (const entry of (await readdir(path.join(root, directory), { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (entry.name === "node_modules") continue;
    const name = path.posix.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error(`snapshot_source_symlink: ${name}`);
    if (entry.isDirectory()) result.push(...(await listFiles(root, name)));
    else if (entry.isFile() && sourcePath(name)) result.push(name);
  }
  return result;
}

/** Hash physical dependency bytes and symlink destinations without following cycles. */
export async function dependencyDigest(root: string): Promise<string> {
  const digest = createHash("sha256");
  const walk = async (directory: string) => {
    for (const entry of (await readdir(path.join(root, directory), { withFileTypes: true })).sort(
      (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    )) {
      const name = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) await walk(name);
      else {
        digest.update(name).update("\0");
        if (entry.isSymbolicLink()) digest.update(await readlink(path.join(root, name)));
        else if (entry.isFile()) digest.update(await readFile(path.join(root, name)));
        else throw Error(`snapshot_dependency_not_file: ${name}`);
        digest.update("\0");
      }
    }
  };
  await walk("");
  return digest.digest("hex");
}

async function installedDependencyDigest(root: string): Promise<string> {
  const digest = createHash("sha256");
  const owners = [
    "",
    "backend",
    "frontend",
    ...(await readdir(path.join(root, "packages")).then((names) =>
      names.map((name) => `packages/${name}`),
    )),
  ];
  for (const owner of owners)
    digest
      .update(owner)
      .update("\0")
      .update(await dependencyDigest(path.join(root, owner, "node_modules")))
      .update("\0");
  return digest.digest("hex");
}

async function installDependencies(repository: string, root: string): Promise<void> {
  const locked = Bun.JSONC.parse(await readFile(path.join(root, "bun.lock"), "utf8")) as {
    packages: Record<string, unknown[]>;
  };
  const externalLock = async (directory: string) => {
    const parsed = Bun.JSONC.parse(await readFile(path.join(directory, "bun.lock"), "utf8")) as {
      packages: Record<string, unknown[]>;
    };
    return JSON.stringify(
      Object.entries(parsed.packages)
        .filter(
          ([, value]) =>
            typeof value[0] === "string" &&
            !value[0].startsWith("workspace:") &&
            !value[0].includes("@workspace:"),
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  };
  if ((await externalLock(repository)) !== (await externalLock(root)))
    throw Error("snapshot_installed_resolved_lock_mismatch");
  const dependencyRoot = path.join(root, "node_modules/.bun");
  await mkdir(path.dirname(dependencyRoot), { recursive: true });
  await cp(path.join(repository, "node_modules/.bun"), dependencyRoot, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  const owners = [
    "",
    "backend",
    "frontend",
    ...(await readdir(path.join(root, "packages")).then((names) =>
      names.map((name) => `packages/${name}`),
    )),
  ];
  const workspaces = new Map<string, string>();
  for (const owner of owners.filter(Boolean)) {
    const manifest = JSON.parse(await readFile(path.join(root, owner, "package.json"), "utf8"));
    workspaces.set(manifest.name, path.join(root, owner));
  }
  for (const owner of owners) {
    const destination = path.join(root, owner, "node_modules");
    await mkdir(destination, { recursive: true });
    const manifest = JSON.parse(await readFile(path.join(root, owner, "package.json"), "utf8"));
    const names = new Set<string>([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]);
    for (const name of names) {
      let target = workspaces.get(name);
      if (!target) {
        let original: string | undefined;
        for (const fallback of [owner, "backend", "frontend", ""]) {
          try {
            original = await realpath(path.join(repository, fallback, "node_modules", name));
            break;
          } catch {
            /* Try declared installed owner. */
          }
        }
        if (!original) throw Error(`snapshot_dependency_not_installed: ${name}`);
        const relative = path.relative(path.join(repository, "node_modules/.bun"), original);
        if (relative.startsWith("..") || path.isAbsolute(relative))
          throw Error(`snapshot_dependency_outside_store: ${name}`);
        target = path.join(dependencyRoot, relative);
        const installed = JSON.parse(await readFile(path.join(target, "package.json"), "utf8"));
        if (installed.name !== name) throw Error(`snapshot_dependency_name_mismatch: ${name}`);
        const resolution = locked.packages[name]?.[0];
        if (
          typeof resolution !== "string" ||
          resolution !== `${installed.name}@${installed.version}`
        )
          throw Error(`snapshot_dependency_version_mismatch: ${name}`);
      }
      await mkdir(path.dirname(path.join(destination, name)), { recursive: true });
      await symlink(target, path.join(destination, name));
    }
  }
  // The physical store must not contain links that escape into the current checkout.
  const check = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await check(file);
      else if (entry.isSymbolicLink()) {
        const target = await realpath(file);
        if (!target.startsWith(`${root}${path.sep}`))
          throw Error(`snapshot_dependency_escaped: ${path.relative(root, file)}`);
      }
    }
  };
  for (const owner of owners) await check(path.join(root, owner, "node_modules"));
}

export async function freezeBuild(
  repository: string,
  root: string,
  revision: string | null,
): Promise<BuildSnapshot> {
  repository = await realpath(repository);
  root = path.resolve(root);
  if (root === repository || root.startsWith(`${repository}${path.sep}`))
    throw Error("snapshot_requires_external_directory");
  await mkdir(root, { recursive: true });
  if ((await lstat(root)).isSymbolicLink()) throw Error("snapshot_destination_symlink");
  root = await realpath(root);
  if (root === repository || root.startsWith(`${repository}${path.sep}`))
    throw Error("snapshot_requires_external_directory");
  if ((await readdir(root)).length) throw Error("snapshot_destination_not_empty");
  let files: string[];
  let commit: string | null = null;
  if (revision) {
    commit = execFileSync("git", ["rev-parse", `${revision}^{commit}`], {
      cwd: repository,
      encoding: "utf8",
    }).trim();
    files = execFileSync("git", ["ls-tree", "-r", "--name-only", commit], {
      cwd: repository,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(sourcePath)
      .sort();
    const archive = execFileSync("git", ["archive", commit, "--", ...files], {
      cwd: repository,
      maxBuffer: 64 * 1024 * 1024,
    });
    execFileSync("tar", ["-xf", "-", "-C", root], { input: archive });
  } else {
    files = [
      ...(await existingBuildMetadata(repository)),
      ...(await listFiles(repository, "backend/src")),
      ...(await listFiles(repository, "packages")),
    ].sort();
    for (const name of files) {
      if (!(await lstat(path.join(repository, name))).isFile())
        throw Error(`snapshot_source_not_file: ${name}`);
      await mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await cp(path.join(repository, name), path.join(root, name));
    }
  }
  const rows = await Promise.all(
    files.map(async (name) => {
      if (!(await lstat(path.join(root, name))).isFile())
        throw Error(`snapshot_source_not_file: ${name}`);
      return { path: name, sha256: hash(await readFile(path.join(root, name))) };
    }),
  );
  await installDependencies(repository, root);
  const dependencyRoot = root;
  const snapshot = {
    root,
    revision: commit,
    files: rows,
    digest: hash(JSON.stringify(rows)),
    dependencies: { root: dependencyRoot, digest: await installedDependencyDigest(dependencyRoot) },
  };
  await writeFile(path.join(root, "build-snapshot.json"), JSON.stringify(snapshot, null, 2) + "\n");
  return snapshot;
}

export async function assertSnapshotUnchanged(
  snapshot: BuildSnapshot,
  options: { dependencies?: boolean } = {},
): Promise<void> {
  const currentFiles = [
    ...(await existingBuildMetadata(snapshot.root)),
    ...(await listFiles(snapshot.root, "backend/src")),
    ...(await listFiles(snapshot.root, "packages")),
  ].sort();
  if (
    JSON.stringify(currentFiles) !== JSON.stringify(snapshot.files.map((file) => file.path).sort())
  )
    throw Error("snapshot_source_membership_changed");
  for (const file of snapshot.files) {
    const name = path.join(snapshot.root, file.path);
    if (!(await lstat(name)).isFile() || hash(await readFile(name)) !== file.sha256)
      throw Error(`snapshot_input_changed: ${file.path}`);
  }
  if (
    options.dependencies !== false &&
    (await installedDependencyDigest(snapshot.dependencies.root)) !== snapshot.dependencies.digest
  )
    throw Error("snapshot_dependencies_changed");
}
