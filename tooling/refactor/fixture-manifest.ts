/**
 * Inventories public fixture bytes and associates recorded archives by literal
 * metadata, actor identities and shared recorded events. The pure reader and
 * selectors accept JSON manifests and return test-only descriptions; explicit
 * generation owns Git/filesystem I/O and never runs a game, adapter or oracle.
 * Frozen origin paths own stable suite identities. Metadata association and byte
 * preservation do not grant acceptance: unknown provenance stays explicit and
 * generated suites remain pending independent review, with no fixture rewrites.
 */

export type FixtureOwner = "backend" | "frontend" | "replay-contract";
export type FixtureKind =
  | "god-replay"
  | "checkpoint"
  | "player-view"
  | "player-view-bundle"
  | "adapter-script"
  | "unknown-json";
export interface FixtureEvidence {
  path: string;
  pointer: string;
  detail: string;
}
export type FixtureObservation<T> =
  | { state: "observed"; value: T; evidence: FixtureEvidence[] }
  | { state: "unknown"; reason: string };
export interface FixtureActor {
  playerId: number;
  role: string;
  camp: string;
}
export interface FixtureMetadata {
  board: FixtureObservation<string>;
  policy: FixtureObservation<string[]>;
  seed: FixtureObservation<string | number>;
  locale: FixtureObservation<string>;
  actors: FixtureObservation<FixtureActor[]>;
  source: FixtureObservation<{ commit: string; path: string; sha256: string }>;
  build: FixtureObservation<string>;
  formatVersion: FixtureObservation<number>;
}
export interface FixtureArtifact {
  originPath: string;
  currentPath: string;
  sha256: string;
  bytes: number;
  owner: FixtureOwner;
  kind: FixtureKind;
  suiteId: string;
  metadata: FixtureMetadata;
}
export interface FixtureAcceptance {
  status: "pending-review" | "accepted" | "rejected";
  evidence: {
    kind: "baseline-byte-match" | "metadata-association" | "independent-review";
    reference: string;
    detail: string;
  }[];
  unresolved: string[];
}
export interface FixtureSuite {
  suiteId: string;
  anchorOriginPath: string;
  owner: FixtureOwner;
  kind: "recorded-archive" | "adapter-script" | "unassociated-json";
  files: string[];
  metadata: FixtureMetadata;
  membership: {
    originPath: string;
    state: "literal-associated" | "standalone";
    evidence: FixtureEvidence[];
  }[];
  acceptance: FixtureAcceptance;
}
export interface FixtureManifest {
  schema: "awa-fixture-manifests-v1";
  generatedBy: "tooling/refactor/fixture-manifest.ts";
  baseline: { commit: string; inventoryPath: string; inventorySha256: string };
  coverage: { expectedFiles: number; hashMatchedFiles: number; bytes: number };
  policy: string;
  files: FixtureArtifact[];
  suites: FixtureSuite[];
}

const baselineCommit = "27a97cb66e8f30fceb7cb20130154291559dd14a";
const inventoryPath = "docs/refactor/generated/baseline-fixtures.json";
export const fixtureManifestPath = "tooling/refactor/fixtures/manifest.json";
const fixtureRoots = [
  "backend/tests/fixtures",
  "frontend/tests/fixtures",
  "packages/replay-contract/fixtures",
] as const;
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const hash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const privateSegment = (part: string) =>
  [
    ".git",
    ".codex",
    ".agents",
    ".aws",
    ".ssh",
    ".gnupg",
    ".claude",
    "auth.json",
    ".netrc",
  ].includes(part) ||
  part.startsWith(".env") ||
  /^(?:credentials|authentication)(?:\.|$)/i.test(part);
function publicFixturePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !value.includes("\\") &&
    !value
      .split("/")
      .some((part) => !part || part === "." || part === ".." || privateSegment(part)) &&
    fixtureRoots.some((root) => value.startsWith(root + "/"))
  );
}
function fail(reason: string): never {
  throw new Error("fixture_manifest_invalid: " + reason);
}
function strictKeys(value: JsonRecord, keys: string[], label: string) {
  if (Object.keys(value).some((key) => !keys.includes(key))) fail(label + ":unknown_field");
  if (keys.some((key) => !Object.hasOwn(value, key))) fail(label + ":missing_field");
}
function evidence(value: unknown): value is FixtureEvidence[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item: unknown) => {
      if (!record(item)) return false;
      strictKeys(item, ["path", "pointer", "detail"], "evidence");
      return nonempty(item.path) && typeof item.pointer === "string" && nonempty(item.detail);
    })
  );
}
function actor(value: unknown): value is FixtureActor {
  if (!record(value)) return false;
  strictKeys(value, ["playerId", "role", "camp"], "actor");
  return (
    Number.isSafeInteger(value.playerId) &&
    Number(value.playerId) > 0 &&
    nonempty(value.role) &&
    nonempty(value.camp)
  );
}
function checkMetadata(value: unknown): asserts value is FixtureMetadata {
  if (!record(value)) fail("metadata");
  const names = ["board", "policy", "seed", "locale", "actors", "source", "build", "formatVersion"];
  strictKeys(value, names, "metadata");
  for (const name of names) {
    const item = value[name];
    if (!record(item)) fail("observation:" + name);
    if (item.state === "unknown") {
      strictKeys(item, ["state", "reason"], "unknown");
      if (!nonempty(item.reason)) fail("unknown_reason:" + name);
      continue;
    }
    strictKeys(item, ["state", "value", "evidence"], "observed");
    if (item.state !== "observed" || !evidence(item.evidence)) fail("observed_evidence:" + name);
    const observed = item.value;
    if (["board", "locale", "build"].includes(name) && !nonempty(observed))
      fail("metadata:" + name);
    if (
      name === "seed" &&
      !(nonempty(observed) || (typeof observed === "number" && Number.isFinite(observed)))
    )
      fail("metadata:seed");
    if (
      name === "policy" &&
      !(
        Array.isArray(observed) &&
        observed.length > 0 &&
        observed.every(nonempty) &&
        new Set(observed).size === observed.length
      )
    )
      fail("metadata:policy");
    if (
      name === "actors" &&
      !(
        Array.isArray(observed) &&
        observed.length > 0 &&
        observed.every(actor) &&
        new Set(observed.map((entry) => entry.playerId)).size === observed.length
      )
    )
      fail("metadata:actors");
    if (name === "formatVersion" && !(Number.isSafeInteger(observed) && Number(observed) >= 1))
      fail("metadata:formatVersion");
    if (name === "source") {
      if (!record(observed)) fail("metadata:source");
      strictKeys(observed, ["commit", "path", "sha256"], "source");
      if (
        !/^[a-f0-9]{40}$/.test(String(observed.commit)) ||
        !publicFixturePath(observed.path) ||
        !hash(observed.sha256)
      )
        fail("metadata:source");
    }
  }
}

/** Reads a serialized, detached manifest; accessor-bearing runtime objects are not inputs. */
export function parseFixtureManifest(serialized: string): FixtureManifest {
  const value: unknown = JSON.parse(serialized);
  if (!record(value)) fail("document");
  strictKeys(
    value,
    ["schema", "generatedBy", "baseline", "coverage", "policy", "files", "suites"],
    "document",
  );
  if (
    value.schema !== "awa-fixture-manifests-v1" ||
    value.generatedBy !== "tooling/refactor/fixture-manifest.ts" ||
    !nonempty(value.policy)
  )
    fail("schema");
  if (!record(value.baseline)) fail("baseline");
  strictKeys(value.baseline, ["commit", "inventoryPath", "inventorySha256"], "baseline");
  if (
    value.baseline.commit !== baselineCommit ||
    value.baseline.inventoryPath !== inventoryPath ||
    !hash(value.baseline.inventorySha256)
  )
    fail("baseline_identity");
  if (!record(value.coverage)) fail("coverage");
  strictKeys(value.coverage, ["expectedFiles", "hashMatchedFiles", "bytes"], "coverage");
  if (!Array.isArray(value.files) || !Array.isArray(value.suites)) fail("collections");
  const artifacts = new Map<string, FixtureArtifact>();
  for (const item of value.files) {
    if (!record(item)) fail("file");
    strictKeys(
      item,
      ["originPath", "currentPath", "sha256", "bytes", "owner", "kind", "suiteId", "metadata"],
      "file",
    );
    if (
      !publicFixturePath(item.originPath) ||
      !publicFixturePath(item.currentPath) ||
      !hash(item.sha256) ||
      !Number.isSafeInteger(item.bytes) ||
      Number(item.bytes) < 0 ||
      !nonempty(item.suiteId)
    )
      fail("file_identity");
    if (artifacts.has(item.originPath)) fail("duplicate_origin_path");
    if (ownerFor(item.originPath) !== item.owner || ownerFor(item.currentPath) !== item.owner)
      fail("file_owner");
    if (
      ![
        "god-replay",
        "checkpoint",
        "player-view",
        "player-view-bundle",
        "adapter-script",
        "unknown-json",
      ].includes(String(item.kind))
    )
      fail("file_kind");
    checkMetadata(item.metadata);
    const file = item as unknown as FixtureArtifact;
    if (
      file.metadata.source.state !== "observed" ||
      file.metadata.source.value.commit !== baselineCommit ||
      file.metadata.source.value.path !== file.originPath ||
      file.metadata.source.value.sha256 !== file.sha256
    )
      fail("file_source_identity");
    artifacts.set(file.originPath, file);
  }
  const suiteIds = new Set<string>(),
    assigned = new Set<string>(),
    currentPaths = new Set<string>();
  for (const file of artifacts.values()) {
    if (currentPaths.has(file.currentPath)) fail("duplicate_current_path");
    currentPaths.add(file.currentPath);
  }
  for (const item of value.suites) {
    if (!record(item)) fail("suite");
    strictKeys(
      item,
      [
        "suiteId",
        "anchorOriginPath",
        "owner",
        "kind",
        "files",
        "metadata",
        "membership",
        "acceptance",
      ],
      "suite",
    );
    if (
      !publicFixturePath(item.anchorOriginPath) ||
      item.suiteId !== suiteIdFor(item.anchorOriginPath) ||
      suiteIds.has(String(item.suiteId))
    )
      fail("suite_identity");
    suiteIds.add(String(item.suiteId));
    if (
      !["recorded-archive", "adapter-script", "unassociated-json"].includes(String(item.kind)) ||
      !Array.isArray(item.files) ||
      item.files.length === 0 ||
      !item.files.includes(item.anchorOriginPath)
    )
      fail("suite_files");
    checkMetadata(item.metadata);
    for (const filePath of item.files) {
      if (typeof filePath !== "string" || assigned.has(filePath)) fail("duplicate_membership");
      const file = artifacts.get(filePath);
      if (!file || file.suiteId !== item.suiteId || file.owner !== item.owner)
        fail("membership_owner");
      assigned.add(filePath);
    }
    if (!Array.isArray(item.membership) || item.membership.length !== item.files.length)
      fail("membership_evidence");
    const membershipPaths = new Set<string>();
    for (const member of item.membership) {
      if (!record(member)) fail("member");
      strictKeys(member, ["originPath", "state", "evidence"], "member");
      if (
        typeof member.originPath !== "string" ||
        membershipPaths.has(member.originPath) ||
        !item.files.includes(member.originPath) ||
        !["literal-associated", "standalone"].includes(String(member.state)) ||
        !evidence(member.evidence)
      )
        fail("member_evidence");
      membershipPaths.add(member.originPath);
    }
    const acceptance = item.acceptance;
    if (!record(acceptance)) fail("acceptance");
    strictKeys(acceptance, ["status", "evidence", "unresolved"], "acceptance");
    if (
      !["pending-review", "accepted", "rejected"].includes(String(acceptance.status)) ||
      !Array.isArray(acceptance.evidence) ||
      !acceptance.evidence.length ||
      !Array.isArray(acceptance.unresolved) ||
      !acceptance.unresolved.every(nonempty)
    )
      fail("acceptance_status");
    for (const entry of acceptance.evidence) {
      if (!record(entry)) fail("acceptance_evidence");
      strictKeys(entry, ["kind", "reference", "detail"], "acceptance_evidence");
      if (
        !["baseline-byte-match", "metadata-association", "independent-review"].includes(
          String(entry.kind),
        ) ||
        !nonempty(entry.reference) ||
        !nonempty(entry.detail)
      )
        fail("acceptance_evidence");
    }
    if (
      acceptance.status !== "pending-review" &&
      !acceptance.evidence.some((entry) => record(entry) && entry.kind === "independent-review")
    )
      fail("acceptance_requires_independent_review");
    const unresolved = acceptance.unresolved;
    if (
      Object.entries(item.metadata).some(
        ([name, observation]) =>
          observation.state === "unknown" &&
          !unresolved.some((issue) => issue.startsWith(name + ":")),
      )
    )
      fail("unknown_metadata_requires_unresolved_issue");
    const anchor = artifacts.get(item.anchorOriginPath)!;
    if (
      item.metadata.source.state !== "observed" ||
      canonical(item.metadata.source.value) !==
        canonical(anchor.metadata.source.state === "observed" ? anchor.metadata.source.value : null)
    )
      fail("suite_source_identity");
    const aggregate = mergeMetadata(
      { file: anchor, value: undefined },
      item.files.map((originPath) => ({
        file: artifacts.get(String(originPath))!,
        value: undefined,
      })),
    );
    for (const name of Object.keys(aggregate) as (keyof FixtureMetadata)[]) {
      const expected = aggregate[name],
        actual = item.metadata[name];
      if (
        expected.state !== actual.state ||
        (expected.state === "observed" &&
          actual.state === "observed" &&
          canonical(expected.value) !== canonical(actual.value))
      )
        fail("suite_metadata_inconsistent:" + name);
    }
  }
  const bytes = [...artifacts.values()].reduce((total, file) => total + file.bytes, 0);
  if (
    assigned.size !== artifacts.size ||
    value.coverage.expectedFiles !== artifacts.size ||
    value.coverage.hashMatchedFiles !== artifacts.size ||
    value.coverage.bytes !== bytes
  )
    fail("coverage_mismatch");
  const freeze = (entry: unknown): void => {
    if (entry && typeof entry === "object") {
      Object.values(entry).forEach(freeze);
      Object.freeze(entry);
    }
  };
  freeze(value);
  return value as unknown as FixtureManifest;
}

export function fixtureSuitesForOwner(
  manifest: FixtureManifest,
  owner: FixtureOwner,
): readonly FixtureSuite[] {
  return manifest.suites.filter((suite) => suite.owner === owner);
}
export function fixtureSuiteById(manifest: FixtureManifest, suiteId: string): FixtureSuite {
  const suite = manifest.suites.find((entry) => entry.suiteId === suiteId);
  if (!suite) throw new Error("fixture_suite_missing: " + suiteId);
  return suite;
}
function ownerFor(file: string): FixtureOwner {
  if (file.startsWith("backend/")) return "backend";
  if (file.startsWith("frontend/")) return "frontend";
  return "replay-contract";
}
function suiteIdFor(anchor: string): string {
  return "fixture:" + anchor;
}
const unknown = <T>(reason: string): FixtureObservation<T> => ({ state: "unknown", reason });
const observed = <T>(value: T, evidence: FixtureEvidence[]): FixtureObservation<T> => ({
  state: "observed",
  value,
  evidence,
});
const ref = (path: string, pointer: string, detail: string): FixtureEvidence => ({
  path,
  pointer,
  detail,
});
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (record(value))
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "undefined";
}
function actorsFrom(value: unknown, kind: FixtureKind): FixtureActor[] {
  let entries: unknown[] = [];
  if (kind === "player-view-bundle" && Array.isArray(value)) entries = value;
  if (kind === "player-view" && record(value)) entries = [value];
  if (
    (kind === "god-replay" || kind === "checkpoint") &&
    record(value) &&
    Array.isArray(value.players)
  )
    entries = value.players;
  return entries.flatMap((entry) => {
    if (!record(entry)) return [];
    const playerId = entry.player_id ?? entry.id;
    if (
      !Number.isSafeInteger(playerId) ||
      Number(playerId) <= 0 ||
      !nonempty(entry.role) ||
      !nonempty(entry.camp)
    )
      return [];
    return [{ playerId: Number(playerId), role: entry.role, camp: entry.camp }];
  });
}
function classify(value: unknown, script: boolean): FixtureKind {
  if (script) return "adapter-script";
  if (
    record(value) &&
    Array.isArray(value.events) &&
    record(value.meta) &&
    value.perspective === "god"
  )
    return "god-replay";
  if (record(value) && record(value.snapshot) && Array.isArray(value.players)) return "checkpoint";
  if (record(value) && Array.isArray(value.timeline)) return "player-view";
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => record(entry) && Array.isArray(entry.timeline))
  )
    return "player-view-bundle";
  return "unknown-json";
}
interface LoadedFixture {
  file: FixtureArtifact;
  value: unknown;
}
function literalMetadata(file: FixtureArtifact, value: unknown): FixtureMetadata {
  const path = file.originPath;
  const collect = (name: string) => {
    const values = new Map<string, { value: string | number; evidence: FixtureEvidence }>();
    const walk = (node: unknown, pointer: string) => {
      if (Array.isArray(node)) node.forEach((entry, index) => walk(entry, pointer + "/" + index));
      else if (record(node))
        for (const [key, entry] of Object.entries(node)) {
          const next = pointer + "/" + key.replaceAll("~", "~0").replaceAll("/", "~1");
          if (
            key === name &&
            (nonempty(entry) || (typeof entry === "number" && Number.isFinite(entry)))
          )
            values.set(canonical(entry), {
              value: entry,
              evidence: ref(
                path,
                next,
                "Literal serialized " + name + "; not inferred from a filename or production rule.",
              ),
            });
          walk(entry, next);
        }
    };
    walk(value, "");
    return [...values.values()];
  };
  const scalar = (name: string): FixtureObservation<string> => {
    const entries = collect(name);
    return entries.length === 1 && nonempty(entries[0]!.value)
      ? observed(entries[0]!.value, [entries[0]!.evidence])
      : unknown(
          entries.length
            ? "Multiple literal " + name + " values require review."
            : "No literal " + name + " is recorded in this artifact.",
        );
  };
  const policies = collect("policy"),
    seeds = collect("seed"),
    actors = actorsFrom(value, file.kind);
  const version = record(value) ? value.schemaVersion : undefined;
  return {
    board: scalar("board"),
    policy: policies.length
      ? observed(
          policies.map((entry) => String(entry.value)).sort(),
          policies.map((entry) => entry.evidence),
        )
      : unknown("No literal policy identity is serialized; a board name is not policy evidence."),
    seed:
      seeds.length === 1
        ? observed(seeds[0]!.value, [seeds[0]!.evidence])
        : unknown(
            seeds.length
              ? "Conflicting literal seeds require review."
              : "No seed is serialized; producer defaults are not evidence of the original invocation.",
          ),
    locale: scalar("locale"),
    actors: actors.length
      ? observed(actors, [
          ref(
            path,
            file.kind === "player-view-bundle"
              ? ""
              : file.kind === "player-view"
                ? "/player_id"
                : "/players",
            "Literal actor id, role and camp, preserving serialized identities.",
          ),
        ])
      : unknown("No complete actor identity is serialized."),
    source: observed({ commit: baselineCommit, path, sha256: file.sha256 }, [
      ref(
        inventoryPath,
        "/files",
        "Frozen public Git origin and exact artifact byte digest; this does not identify a producer build.",
      ),
    ]),
    build: scalar("build"),
    formatVersion:
      Number.isSafeInteger(version) && Number(version) >= 1
        ? observed(Number(version), [
            ref(path, "/schemaVersion", "Serialized format version, not a producer build version."),
          ])
        : unknown("No schemaVersion is serialized; legacy status does not identify a build."),
  };
}
function mergeMetadata(anchor: LoadedFixture, members: LoadedFixture[]): FixtureMetadata {
  const merged = { ...anchor.file.metadata };
  for (const name of ["board", "seed", "locale", "build", "formatVersion"] as const) {
    const observations = members.flatMap((member) => {
      const item = member.file.metadata[name];
      return item.state === "observed" ? [item] : [];
    });
    const values = new Set(observations.map((item) => canonical(item.value)));
    if (values.size > 1)
      merged[name] = unknown(
        "Associated artifacts record conflicting " + name + " values; manual review required.",
      ) as never;
    else if (observations.length)
      merged[name] = observed(
        observations[0]!.value,
        observations.flatMap((item) => item.evidence),
      ) as never;
  }
  const policies = members.flatMap((member) =>
    member.file.metadata.policy.state === "observed" ? [member.file.metadata.policy] : [],
  );
  if (policies.length)
    merged.policy = observed(
      [...new Set(policies.flatMap((item) => item.value))].sort(),
      policies.flatMap((item) => item.evidence),
    );
  const actors = members.flatMap((member) =>
    member.file.metadata.actors.state === "observed" ? [member.file.metadata.actors] : [],
  );
  if (actors.length)
    merged.actors = observed(
      [
        ...new Map(
          actors.flatMap((item) => item.value).map((item) => [canonical(item), item]),
        ).values(),
      ].sort((a, b) => a.playerId - b.playerId),
      actors.flatMap((item) => item.evidence),
    );
  return merged;
}

/** Associates inert, byte-checked inputs. It never opens a file or computes expected game results. */
export function describeFixtureCohorts(
  inputs: { originPath: string; sha256: string; bytes: number; value: unknown; script: boolean }[],
): Pick<FixtureManifest, "files" | "suites"> {
  const loaded: LoadedFixture[] = inputs.map((input) => {
    if (
      !publicFixturePath(input.originPath) ||
      !hash(input.sha256) ||
      !Number.isSafeInteger(input.bytes) ||
      input.bytes < 0
    )
      fail("input_identity");
    const file = {
      originPath: input.originPath,
      currentPath: input.originPath,
      sha256: input.sha256,
      bytes: input.bytes,
      owner: ownerFor(input.originPath),
      kind: classify(input.value, input.script),
      suiteId: suiteIdFor(input.originPath),
    } as FixtureArtifact;
    file.metadata = literalMetadata(file, input.value);
    return { file, value: input.value };
  });
  const gods = loaded.filter((item) => item.file.kind === "god-replay"),
    eventIndex = new Map<string, Set<LoadedFixture>>();
  for (const god of gods) {
    if (!record(god.value) || !Array.isArray(god.value.events)) continue;
    for (const event of god.value.events)
      if (record(event) && typeof event.timestamp === "string" && typeof event.type === "string") {
        const key = canonical([event.timestamp, event.type, event.payload]);
        const entries = eventIndex.get(key) ?? new Set<LoadedFixture>();
        entries.add(god);
        eventIndex.set(key, entries);
      }
  }
  const groups = new Map<LoadedFixture, LoadedFixture[]>(),
    memberships = new Map<LoadedFixture, FixtureSuite["membership"][number]>();
  for (const god of gods) groups.set(god, [god]);
  for (const item of loaded) {
    let candidates: LoadedFixture[] = [],
      detail = "Standalone artifact; no cross-file relationship was asserted.";
    if (["player-view", "player-view-bundle"].includes(item.file.kind)) {
      const views = Array.isArray(item.value) ? item.value : [item.value];
      let shared: Set<LoadedFixture> | undefined;
      for (const view of views) {
        const hits = new Set<LoadedFixture>();
        if (record(view) && Array.isArray(view.timeline))
          for (const entry of view.timeline)
            if (record(entry) && record(entry.event)) {
              for (const god of eventIndex.get(
                canonical([entry.timestamp, entry.event.type, entry.event.payload]),
              ) ?? [])
                hits.add(god);
            }
        shared = shared === undefined ? hits : new Set([...shared].filter((god) => hits.has(god)));
      }
      candidates = [...(shared ?? [])].filter((god) => {
        if (
          god.file.owner !== item.file.owner ||
          god.file.metadata.actors.state !== "observed" ||
          item.file.metadata.actors.state !== "observed"
        )
          return false;
        const roster = god.file.metadata.actors.value;
        return (
          item.file.metadata.actors.value.length === views.length &&
          item.file.metadata.actors.value.every((actor) =>
            roster.some((candidate) => canonical(candidate) === canonical(actor)),
          ) &&
          views.every(
            (view) =>
              record(view) &&
              (view.locale === undefined ||
                (god.file.metadata.locale.state === "observed" &&
                  view.locale === god.file.metadata.locale.value)),
          )
        );
      });
      detail =
        "Each actor shares literal event timestamp, type and payload with exactly one god archive; actor id/role/camp and recorded locale agree. No filename or production projection supplies the match.";
    } else if (item.file.kind === "checkpoint" && record(item.value)) {
      const name = item.file.originPath.slice(item.file.originPath.lastIndexOf("/") + 1);
      const stem = name.endsWith(".checkpoint.txt")
        ? name.slice(0, -".checkpoint.txt".length)
        : name.endsWith(".json")
          ? name.slice(0, -".json".length)
          : "";
      const checkpoint = item.value;
      candidates = gods.filter((god) => {
        if (
          god.file.owner !== item.file.owner ||
          !god.file.originPath.endsWith("/" + stem + ".replay.json") ||
          !record(god.value) ||
          !record(checkpoint.snapshot) ||
          !Array.isArray(god.value.events) ||
          !record(god.value.result)
        )
          return false;
        const completeRoster = (member: LoadedFixture) =>
          record(member.value) &&
          Array.isArray(member.value.players) &&
          member.file.metadata.actors.state === "observed" &&
          member.file.metadata.actors.value.length > 0 &&
          member.file.metadata.actors.value.length === member.value.players.length &&
          new Set(member.file.metadata.actors.value.map((actor) => actor.playerId)).size ===
            member.value.players.length;
        if (!completeRoster(item) || !completeRoster(god)) return false;
        if (
          checkpoint.eventCount !== god.value.events.length ||
          canonical(
            item.file.metadata.actors.state === "observed" ? item.file.metadata.actors.value : [],
          ) !==
            canonical(
              god.file.metadata.actors.state === "observed" ? god.file.metadata.actors.value : [],
            )
        )
          return false;
        const outcome = god.value.result.decision ?? god.value.result;
        const ordinary = canonical(checkpoint.snapshot.result) === canonical(outcome);
        const last = god.value.events.at(-1);
        const failed =
          record(checkpoint.failure) &&
          checkpoint.failure.code === "cycle_failed" &&
          checkpoint.snapshot.result === null &&
          checkpoint.snapshot.gameOver === false &&
          checkpoint.complete === false &&
          god.value.result.reason === "runtime_error" &&
          god.value.result.winner === null &&
          record(last) &&
          checkpoint.snapshot.day === last.day &&
          checkpoint.snapshot.phase === last.phase;
        return ordinary || failed;
      });
      detail =
        "Basename only locates candidates; recorded eventCount, complete actor roster and literal terminal result agree, or the explicit cycle_failed/runtime_error nonterminal snapshot and last event day/phase agree. This compares archives and never predicts a rule outcome.";
    }
    const anchor =
      item.file.kind === "god-replay" ? item : candidates.length === 1 ? candidates[0]! : item;
    item.file.suiteId = suiteIdFor(anchor.file.originPath);
    if (anchor !== item) groups.get(anchor)!.push(item);
    else if (!groups.has(item)) groups.set(item, [item]);
    memberships.set(item, {
      originPath: item.file.originPath,
      state: anchor !== item ? "literal-associated" : "standalone",
      evidence: [
        ref(
          item.file.originPath,
          "",
          anchor !== item
            ? detail
            : candidates.length > 1
              ? "Multiple archive associations require review; no match was selected."
              : item.file.kind === "checkpoint"
                ? "No complete literal actor/event/outcome archive association was established; this checkpoint remains standalone pending review."
                : ["player-view", "player-view-bundle"].includes(item.file.kind)
                  ? "No unique literal event/actor/locale archive association was established; this player archive remains standalone pending review."
                  : "Standalone identity anchor; no cross-file relationship was asserted.",
        ),
      ],
    });
  }
  const suites = [...groups.entries()].map(([anchor, members]): FixtureSuite => {
    const metadata = mergeMetadata(anchor, members);
    const unresolved = Object.entries(metadata).flatMap(([name, observation]) =>
      observation.state === "unknown" ? [name + ": " + observation.reason] : [],
    );
    if (
      anchor.file.kind === "player-view" ||
      anchor.file.kind === "player-view-bundle" ||
      anchor.file.kind === "unknown-json"
    )
      unresolved.push("Archive association is unresolved; this artifact remains standalone.");
    unresolved.push(
      "Grouping and exact byte preservation are inventory evidence; independent scenario/consumer acceptance has not been assigned.",
    );
    return {
      suiteId: suiteIdFor(anchor.file.originPath),
      anchorOriginPath: anchor.file.originPath,
      owner: anchor.file.owner,
      kind:
        anchor.file.kind === "god-replay"
          ? "recorded-archive"
          : anchor.file.kind === "adapter-script"
            ? "adapter-script"
            : "unassociated-json",
      files: members.map((member) => member.file.originPath).sort(),
      metadata,
      membership: members
        .map((member) => memberships.get(member)!)
        .sort((a, b) => a.originPath.localeCompare(b.originPath)),
      acceptance: {
        status: "pending-review",
        evidence: [
          {
            kind: "metadata-association",
            reference: anchor.file.originPath,
            detail:
              "Membership evidence identifies literal associations or explicit standalone status; this pure description does not verify caller-supplied byte hashes or infer passed test status.",
          },
        ],
        unresolved,
      },
    };
  });
  return {
    files: loaded.map((item) => item.file).sort((a, b) => a.originPath.localeCompare(b.originPath)),
    suites: suites.sort((a, b) => a.suiteId.localeCompare(b.suiteId)),
  };
}

/** Reads only allowlisted public fixture roots and verifies immutable Git bytes before describing them. */
export async function generateFixtureManifest(repository: string): Promise<FixtureManifest> {
  const fs = await import("node:fs/promises"),
    path = await import("node:path"),
    crypto = await import("node:crypto"),
    childProcess = await import("node:child_process");
  const requestedRoot = path.resolve(repository);
  const rootParts = requestedRoot
    .slice(path.parse(requestedRoot).root.length)
    .split(path.sep)
    .filter(Boolean);
  if (rootParts.some(privateSegment)) fail("private_repository_path_rejected");
  let rootComponent = path.parse(requestedRoot).root;
  for (const part of rootParts) {
    rootComponent = path.join(rootComponent, part);
    const info = await fs.lstat(rootComponent);
    if (info.isSymbolicLink()) fail("repository_symlink_rejected");
    if (!info.isDirectory()) fail("repository_directory_required");
  }
  const root = await fs.realpath(requestedRoot);
  if (root !== requestedRoot) fail("repository_resolution_changed");
  const digest = (bytes: Uint8Array | string) =>
    crypto.createHash("sha256").update(bytes).digest("hex");
  async function safeFile(relative: string) {
    if (relative !== inventoryPath && !publicFixturePath(relative)) fail("private_path_rejected");
    const parts = relative.split("/");
    for (let index = 1; index <= parts.length; index++) {
      const candidate = path.join(root, ...parts.slice(0, index)),
        info = await fs.lstat(candidate);
      if (info.isSymbolicLink()) fail("symlink_rejected");
      if (
        (index < parts.length && !info.isDirectory()) ||
        (index === parts.length && !info.isFile())
      )
        fail("public_input_kind");
    }
    return fs.readFile(path.join(root, relative));
  }
  const inventoryBytes = await safeFile(inventoryPath),
    inventory: unknown = JSON.parse(inventoryBytes.toString("utf8"));
  if (!record(inventory) || inventory.commit !== baselineCommit || !Array.isArray(inventory.files))
    fail("frozen_inventory_identity");
  const rows = inventory.files.map((row: unknown) => {
    if (
      !record(row) ||
      !publicFixturePath(row.path) ||
      !hash(row.sha256) ||
      !Number.isSafeInteger(row.bytes) ||
      Number(row.bytes) < 0
    )
      fail("frozen_inventory_row");
    return { originPath: row.path, sha256: row.sha256, bytes: Number(row.bytes) };
  });
  const git = childProcess.execFileSync(
    "git",
    ["ls-tree", "-r", "-z", baselineCommit, "--", ...fixtureRoots],
    { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const origin = git
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);
      if (!match || match[1] === "120000" || !publicFixturePath(match[3])) fail("frozen_git_input");
      return { path: match[3]!, blob: match[2]! };
    });
  if (
    origin.length !== 907 ||
    rows.length !== origin.length ||
    new Set(rows.map((row) => row.originPath)).size !== rows.length ||
    rows.some((row) => !origin.some((entry) => entry.path === row.originPath))
  )
    fail("frozen_inventory_coverage");
  const blobs = childProcess.execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: origin.map((entry) => entry.blob).join("\n") + "\n",
    maxBuffer: 128 * 1024 * 1024,
  });
  let offset = 0;
  for (const entry of origin) {
    const end = blobs.indexOf(10, offset),
      header = blobs.subarray(offset, end).toString("utf8"),
      match = /^([a-f0-9]{40}) blob (\d+)$/.exec(header);
    if (end < 0 || !match || match[1] !== entry.blob) fail("frozen_git_blob");
    const size = Number(match[2]),
      content = blobs.subarray(end + 1, end + 1 + size),
      row = rows.find((candidate) => candidate.originPath === entry.path)!;
    if (
      content.length !== size ||
      blobs[end + 1 + size] !== 10 ||
      size !== row.bytes ||
      digest(content) !== row.sha256
    )
      fail("frozen_inventory_blob_mismatch");
    offset = end + size + 2;
  }
  const currentPaths: string[] = [];
  async function scan(relative: string) {
    const info = await fs.lstat(path.join(root, relative));
    if (info.isSymbolicLink()) fail("symlink_rejected");
    if (info.isDirectory())
      for (const name of (await fs.readdir(path.join(root, relative))).sort())
        await scan(relative + "/" + name);
    else if (info.isFile() && publicFixturePath(relative)) currentPaths.push(relative);
    else fail("unexpected_fixture_kind");
  }
  for (const directory of fixtureRoots) await scan(directory);
  if (
    currentPaths.length !== rows.length ||
    currentPaths.some((file) => !rows.some((row) => row.originPath === file))
  )
    fail("current_fixture_coverage");
  const inputs = [];
  for (const row of rows) {
    const bytes = await safeFile(row.originPath);
    if (bytes.length !== row.bytes || digest(bytes) !== row.sha256)
      fail("current_fixture_byte_drift");
    const script = /\.[cm]?[jt]sx?$/.test(row.originPath);
    inputs.push({
      ...row,
      value: script ? undefined : (JSON.parse(bytes.toString("utf8")) as unknown),
      script,
    });
  }
  const grouped = describeFixtureCohorts(inputs);
  for (const suite of grouped.suites)
    suite.acceptance.evidence.unshift({
      kind: "baseline-byte-match",
      reference: inventoryPath,
      detail:
        "Every member matched both the immutable Git blob and current public file byte digest/size; no golden was regenerated.",
    });
  const manifest: FixtureManifest = {
    schema: "awa-fixture-manifests-v1",
    generatedBy: "tooling/refactor/fixture-manifest.ts",
    baseline: { commit: baselineCommit, inventoryPath, inventorySha256: digest(inventoryBytes) },
    coverage: {
      expectedFiles: rows.length,
      hashMatchedFiles: rows.length,
      bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    },
    policy:
      "Only public fixtures are read; original/current paths remain one-to-one. Suites describe literal archive associations, not inferred rules. Unknown seed/build/producer invocation stays explicit. Adapter scripts remain executable helpers, not data archives. Generation never executes models, adapters, game rules or tests, and every acceptance status starts pending-review.",
    ...grouped,
  };
  return parseFixtureManifest(JSON.stringify(manifest));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length > 1)
    throw new Error("usage: bun tooling/refactor/fixture-manifest.ts [repository]");
  const document = await generateFixtureManifest(args[0] ?? process.cwd());
  process.stdout.write(JSON.stringify(document, null, 2) + "\n");
}
