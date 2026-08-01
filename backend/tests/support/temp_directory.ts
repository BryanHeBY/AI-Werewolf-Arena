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
