/**
 * Owns test driver support: Filesystem fixture directory ownership and cleanup; original prefixes, allocation and tracked lifecycle remain unchanged.
 * Inputs are supplied script steps, callbacks or fixture resource requests;
 * outputs are the original controlled traces, handles and boundary responses.
 * Unit and scenario tests keep their supplied literal actions and failure
 * expectations as the oracle. Driver ownership, cleanup and error policy never
 * change during this relocation; no billed model is introduced.
 */
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const activeDirectories = new Set<string>();

export async function createTestTempDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(tmpdir(), prefix));
  activeDirectories.add(directory);
  return directory;
}

export async function cleanupTestTempDirectories(): Promise<void> {
  const directories = [...activeDirectories];
  activeDirectories.clear();
  await Promise.all(
    directories.map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
}
