import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { AcpProcessClient } from "../../../src/ai/integrations/acp/acp_process_client";
import { AcpTurnRegistry } from "../../../src/ai/integrations/acp/acp_turn_registry";
import { createTestTempDirectory } from "../../support/temp_directory";

describe("AcpProcessClient initialization deadlines", () => {
  test("terminates a real child when ACP initialization never responds", async () => {
    const root = await createTestTempDirectory("awa-acp-init-timeout-");
    const pidFile = path.join(root, "agent.pid");
    const client = new AcpProcessClient({
      command: process.execPath,
      args: [
        "-e",
        `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`,
      ],
      cwd: root,
      initializeTimeoutMs: 500,
    });

    const startedAt = Date.now();
    await expect(client.createSession({
      actorId: 1,
      registry: new AcpTurnRegistry(),
    })).rejects.toBeDefined();
    expect(Date.now() - startedAt).toBeLessThan(5_000);

    const pid = Number(await fs.readFile(pidFile, "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
