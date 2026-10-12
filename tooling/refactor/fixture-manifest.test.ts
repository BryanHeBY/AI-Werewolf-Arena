/**
 * Unit and filesystem boundary tests for the public fixture manifest inventory.
 * Inputs are literal unrelated archive names, conflicting identities, malformed
 * serialized manifests and isolated temporary paths. Independent literal actor,
 * event and outcome expectations are the oracle; no engine produces an expected
 * result. One byte-inventory check covers the frozen 907 public files without
 * executing games, transport adapters, existing test suites or billed models.
 */
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, unlink, symlink, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  describeFixtureCohorts,
  parseFixtureManifest,
  fixtureSuiteById,
  fixtureSuitesForOwner,
  generateFixtureManifest,
  fixtureManifestPath,
  type FixtureManifest,
} from "./fixture-manifest";
import {
  acpAdapterFixture,
  backendAdapterFixture,
} from "../../backend/tests/support/fixtures/manifest";
import {
  replayFixtureFiles,
  playerFixtureFiles,
} from "../../frontend/tests/support/fixtures/manifest";

const originCommit = "27a97cb66e8f30fceb7cb20130154291559dd14a";
const digest = "1".repeat(64);
const godPath = "frontend/tests/fixtures/literal.replay.json";
const playerPath = "frontend/tests/fixtures/player-views/unrelated.player.json";
const checkpointPath = "frontend/tests/fixtures/literal.checkpoint.txt";
const timestamp = "2026-01-01T00:00:00.000Z";
const event = {
  seq: 1,
  timestamp,
  type: "phase_changed",
  payload: { phase: "night", day: 1 },
  day: 1,
  phase: "night",
};
const decision = { winner: "good", reason: "independent_literal" };
const god = {
  schemaVersion: 2,
  perspective: "god",
  meta: { board: "literal_board", locale: "en" },
  players: [{ player_id: 1, role: "witch", camp: "good" }],
  events: [event],
  result: { ...decision, decision },
};
const player = {
  schemaVersion: 2,
  locale: "en",
  player_id: 1,
  role: "witch",
  camp: "good",
  timeline: [{ timestamp, event: { type: event.type, payload: event.payload } }],
};
const checkpoint = {
  eventCount: 1,
  complete: true,
  snapshot: { day: 1, phase: "game_over", gameOver: true, result: decision },
  players: [
    { id: 1, role: "witch", camp: "good", privateState: { witch: { policy: "literal_policy" } } },
  ],
};
const input = (originPath: string, value: unknown, script = false) => ({
  originPath,
  value,
  script,
  sha256: digest,
  bytes: 7,
});
function document(grouped: ReturnType<typeof describeFixtureCohorts>): FixtureManifest {
  return {
    schema: "awa-fixture-manifests-v1",
    generatedBy: "tooling/refactor/fixture-manifest.ts",
    baseline: {
      commit: originCommit,
      inventoryPath: "docs/refactor/generated/baseline-fixtures.json",
      inventorySha256: digest,
    },
    coverage: {
      expectedFiles: grouped.files.length,
      hashMatchedFiles: grouped.files.length,
      bytes: grouped.files.length * 7,
    },
    policy: "Literal test input; no real-file byte proof is claimed by this unit helper.",
    ...grouped,
  };
}

test("literal event and actor identity associate unrelated player names; checkpoint contributes only recorded policy", () => {
  const grouped = describeFixtureCohorts([
    input(godPath, god),
    input(playerPath, player),
    input(checkpointPath, checkpoint),
  ]);
  expect(grouped.suites).toHaveLength(1);
  expect(grouped.suites[0]!.files).toEqual([checkpointPath, godPath, playerPath]);
  expect(grouped.suites[0]!.metadata.policy.state).toBe("observed");
  expect(grouped.suites[0]!.metadata.policy).toMatchObject({ value: ["literal_policy"] });
  expect(grouped.suites[0]!.metadata.seed.state).toBe("unknown");
  expect(grouped.suites[0]!.metadata.build.state).toBe("unknown");
  expect(grouped.suites[0]!.acceptance.status).toBe("pending-review");
  expect(grouped.suites[0]!.acceptance.evidence.map((entry) => entry.kind)).toEqual([
    "metadata-association",
  ]);
});

test("matching basename is insufficient for a checkpoint and shared events cannot override foreign actor identity", () => {
  const grouped = describeFixtureCohorts([
    input(godPath, god),
    input(checkpointPath, {
      ...checkpoint,
      snapshot: { ...checkpoint.snapshot, result: { winner: "wolf", reason: "different_literal" } },
    }),
    input(playerPath, { ...player, player_id: 2 }),
  ]);
  expect(grouped.suites).toHaveLength(3);
  expect(fixtureSuiteById(document(grouped), "fixture:" + godPath).files).toEqual([godPath]);
});

test("ambiguous shared event matches remain standalone and retain an unresolved association", () => {
  const grouped = describeFixtureCohorts([
    input(godPath, god),
    input("frontend/tests/fixtures/other.replay.json", god),
    input(playerPath, player),
  ]);
  const suite = fixtureSuiteById(document(grouped), "fixture:" + playerPath);
  expect(suite.kind).toBe("unassociated-json");
  expect(suite.files).toEqual([playerPath]);
  expect(
    suite.acceptance.unresolved.some((issue) => issue.includes("association is unresolved")),
  ).toBe(true);
  expect(suite.membership[0]!.evidence[0]!.detail).toContain("Multiple archive associations");
});

test("explicit failed nonterminal checkpoint associates without converting runtime_error into a passed scenario", () => {
  const failed = {
    ...checkpoint,
    complete: false,
    failure: { name: "Error", code: "cycle_failed" },
    snapshot: { day: 1, phase: "night", gameOver: false, result: null },
  };
  const grouped = describeFixtureCohorts([
    input(godPath, { ...god, result: { winner: null, reason: "runtime_error" } }),
    input(checkpointPath, failed),
  ]);
  expect(grouped.suites).toHaveLength(1);
  expect(grouped.suites[0]!.files).toEqual([checkpointPath, godPath]);
  expect(grouped.suites[0]!.acceptance.status).toBe("pending-review");
  const mismatched = describeFixtureCohorts([
    input(godPath, { ...god, result: { winner: null, reason: "runtime_error" } }),
    input(checkpointPath, { ...failed, snapshot: { ...failed.snapshot, day: 2 } }),
  ]);
  expect(mismatched.suites).toHaveLength(2);
});

test("strict serialized manifests reject duplicate paths, missing members, invented acceptance and hidden unknowns", () => {
  const base = document(describeFixtureCohorts([input(godPath, god), input(playerPath, player)]));
  const parsed = parseFixtureManifest(JSON.stringify(base));
  expect(Object.isFrozen(parsed)).toBe(true);
  expect(Object.isFrozen(parsed.suites[0]!.metadata)).toBe(true);
  const mutations: ((value: FixtureManifest) => void)[] = [
    (value) => {
      value.files[1]!.currentPath = value.files[0]!.currentPath;
    },
    (value) => {
      value.suites[0]!.files.pop();
    },
    (value) => {
      value.suites[0]!.acceptance.status = "accepted";
    },
    (value) => {
      value.suites[0]!.acceptance.unresolved = [];
    },
    (value) => {
      value.files[0]!.currentPath = "configs/runtime/providers.json";
    },
    (value) => {
      value.files[0]!.currentPath = "frontend/tests/fixtures/.codex/auth.json";
    },
    (value) => {
      value.files[0]!.currentPath = "frontend/tests/fixtures/players/.env.local";
    },
    (value) => {
      Object.assign(value.files[0]!, { inferredPassed: true });
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(base);
    mutate(changed);
    expect(() => parseFixtureManifest(JSON.stringify(changed))).toThrow("fixture_manifest_invalid");
  }
});

test("empty or incomplete checkpoint rosters cannot claim complete literal actor agreement", () => {
  const cases: [unknown[], unknown[]][] = [
    [[], []],
    [
      [
        { player_id: 1, role: "witch", camp: "good" },
        { player_id: 2, role: "seer" },
      ],
      [
        { id: 1, role: "witch", camp: "good" },
        { id: 2, role: "seer" },
      ],
    ],
  ];
  for (const [godPlayers, checkpointPlayers] of cases) {
    const grouped = describeFixtureCohorts([
      input(godPath, { ...god, players: godPlayers }),
      input(checkpointPath, { ...checkpoint, players: checkpointPlayers }),
    ]);
    expect(grouped.suites).toHaveLength(2);
    expect(
      grouped.suites.every((suite) =>
        suite.membership.every((member) => member.state === "standalone"),
      ),
    ).toBe(true);
    expect(
      grouped.suites
        .flatMap((suite) => suite.membership)
        .every(
          (member) =>
            !member.evidence.some((entry) => entry.detail.includes("complete actor roster")),
        ),
    ).toBe(true);
  }
});

test("strict aggregate metadata rejects board, locale, actor and seed values contradicted by member observations", () => {
  const base = document(describeFixtureCohorts([input(godPath, god), input(playerPath, player)]));
  const evidence = [
    {
      path: godPath,
      pointer: "/meta/board",
      detail: "Independent incorrect metadata counterexample.",
    },
  ];
  const mutations: ((value: FixtureManifest) => void)[] = [
    (value) => {
      value.suites[0]!.metadata.board = {
        state: "observed",
        value: "invented_other_board",
        evidence,
      };
    },
    (value) => {
      value.suites[0]!.metadata.locale = { state: "observed", value: "zh-CN", evidence };
    },
    (value) => {
      value.suites[0]!.metadata.actors = {
        state: "observed",
        value: [{ playerId: 2, role: "witch", camp: "good" }],
        evidence,
      };
    },
    (value) => {
      value.suites[0]!.metadata.seed = { state: "observed", value: "unrecorded_seed", evidence };
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(base);
    mutate(changed);
    expect(() => parseFixtureManifest(JSON.stringify(changed))).toThrow(
      "suite_metadata_inconsistent",
    );
  }
});

test("generator rejects repository-root and ancestor symbolic links before opening a canary inventory", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "awa-fixture-root-negative-"));
  const actualRoot = path.join(temporary, "synthetic-private-repository");
  try {
    await mkdir(path.join(actualRoot, "docs/refactor/generated"), { recursive: true });
    await writeFile(
      path.join(actualRoot, "docs/refactor/generated/baseline-fixtures.json"),
      JSON.stringify({
        commit: originCommit,
        files: [{ path: "configs/runtime/providers.json", sha256: digest, bytes: 7 }],
      }),
    );
    const directLink = path.join(temporary, "public-repository-link");
    await symlink(actualRoot, directLink);
    await expect(generateFixtureManifest(directLink)).rejects.toThrow(
      "repository_symlink_rejected",
    );
    const ancestor = path.join(temporary, "ancestor-link");
    await symlink(temporary, ancestor);
    await expect(
      generateFixtureManifest(path.join(ancestor, "synthetic-private-repository")),
    ).rejects.toThrow("repository_symlink_rejected");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("application selectors own adapter and actor selection and reject foreign archive owners", () => {
  expect(acpAdapterFixture("game").originPath).toBe("backend/tests/fixtures/acp_game_agent.ts");
  expect(acpAdapterFixture("game").kind).toBe("adapter-script");
  const suiteId = "fixture:frontend/tests/fixtures/mist-manual-blast-pre-election-en.replay.json";
  const replay = replayFixtureFiles(suiteId);
  expect(replay.checkpoint?.originPath).toBe(
    "frontend/tests/fixtures/mist-manual-blast-pre-election-en.checkpoint.txt",
  );
  expect(playerFixtureFiles(suiteId, { role: "alchemist", playerId: 1 })).toHaveLength(1);
  expect(() => playerFixtureFiles(suiteId, {})).toThrow("actor_filter_required");
  expect(() => playerFixtureFiles(suiteId, { playerId: 999 })).toThrow("actor_missing");
  expect(() => backendAdapterFixture(suiteId)).toThrow("requires_single_adapter");
  expect(() => replayFixtureFiles("fixture:backend/tests/fixtures/acp_game_agent.ts")).toThrow(
    "requires_recorded_archive",
  );
});

test("generator preserves all 907 public frozen Git bytes and leaves all 258 suite acceptances pending", async () => {
  const repository = path.resolve(import.meta.dir, "../..");
  const manifest = await generateFixtureManifest(repository);
  expect(manifest.coverage).toEqual({
    expectedFiles: 907,
    hashMatchedFiles: 907,
    bytes: 48_294_509,
  });
  expect(fixtureSuitesForOwner(manifest, "frontend")).toHaveLength(253);
  expect(fixtureSuitesForOwner(manifest, "backend")).toHaveLength(3);
  expect(fixtureSuitesForOwner(manifest, "replay-contract")).toHaveLength(2);
  expect(manifest.suites.every((suite) => suite.acceptance.status === "pending-review")).toBe(true);
  expect(manifest.files.every((file) => file.originPath === file.currentPath)).toBe(true);
  expect(
    manifest.suites.every(
      (suite) =>
        suite.metadata.seed.state === "unknown" && suite.metadata.build.state === "unknown",
    ),
  ).toBe(true);
  const snapshot = parseFixtureManifest(
    await readFile(path.join(repository, fixtureManifestPath), "utf8"),
  );
  expect(manifest).toEqual(snapshot);
});

test("generator rejects private inventory paths and symbolic-link inputs before reading their targets", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "awa-fixture-manifest-negative-"));
  const directory = path.join(temporary, "docs/refactor/generated");
  const target = path.join(directory, "baseline-fixtures.json");
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(
      target,
      JSON.stringify({
        commit: originCommit,
        files: [{ path: "configs/runtime/providers.json", sha256: digest, bytes: 7 }],
      }),
    );
    await expect(generateFixtureManifest(temporary)).rejects.toThrow("frozen_inventory_row");
    await unlink(target);
    await symlink("nonexistent-public-test-input.json", target);
    await expect(generateFixtureManifest(temporary)).rejects.toThrow("symlink_rejected");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
