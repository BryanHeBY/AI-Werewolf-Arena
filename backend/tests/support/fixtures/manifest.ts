/**
 * Selects the backend's frozen ACP test adapter fixtures from the public manifest.
 * Inputs are the explicit audit/game/ownership purpose or a stable suite identity;
 * outputs are byte-described executable fixture paths with backend ownership.
 * This test support owns purpose-to-adapter selection and rejects data archives,
 * mixed suites and foreign owners. It never launches a process, changes a golden
 * or grants acceptance; callers retain real filesystem and transport boundaries.
 */
import { fileURLToPath } from "node:url";
import snapshot from "../../../../tooling/refactor/fixtures/manifest.json";
import {
  fixtureSuiteById,
  parseFixtureManifest,
  type FixtureArtifact,
} from "../../../../tooling/refactor/fixture-manifest";

const manifest = parseFixtureManifest(JSON.stringify(snapshot));
const artifacts = new Map(manifest.files.map((file) => [file.originPath, file]));
const adapterOrigins = {
  audit: "backend/tests/fixtures/acp_audit_agent.ts",
  game: "backend/tests/fixtures/acp_game_agent.ts",
  ownership: "backend/tests/fixtures/acp_ownership_agent.ts",
} as const;
export type AcpFixturePurpose = keyof typeof adapterOrigins;

export function backendAdapterFixture(suiteId: string): FixtureArtifact {
  const suite = fixtureSuiteById(manifest, suiteId);
  if (suite.owner !== "backend" || suite.kind !== "adapter-script" || suite.files.length !== 1)
    throw new Error("backend_fixture_requires_single_adapter");
  const file = artifacts.get(suite.files[0]!);
  if (!file || file.owner !== "backend" || file.kind !== "adapter-script")
    throw new Error("backend_fixture_adapter_identity_invalid");
  return file;
}

export function acpAdapterFixture(purpose: AcpFixturePurpose): FixtureArtifact {
  const origin = adapterOrigins[purpose];
  if (!origin) throw new Error("backend_fixture_adapter_purpose_invalid");
  return backendAdapterFixture("fixture:" + origin);
}

/** Owns purpose-to-physical-entry resolution; actual spawn/stdio remains with callers. */
export function acpAdapterEntry(purpose: AcpFixturePurpose): string {
  return fileURLToPath(
    new URL("../../../../" + acpAdapterFixture(purpose).currentPath, import.meta.url),
  );
}
