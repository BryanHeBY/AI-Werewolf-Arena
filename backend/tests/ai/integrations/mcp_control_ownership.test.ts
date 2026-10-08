import { expect, test } from "bun:test";
import { LoopbackMcpControlServer } from "../../../src/ai/integrations/acp/loopback_mcp_control_server";
function control() { return new LoopbackMcpControlServer({ serverName: "synthetic", controlUrlEnvironmentName: "SYNTHETIC_URL", tokenEnvironmentName: "SYNTHETIC_TOKEN", sessionNotReadyError: "session_not_ready", invalidRequestPrefix: "invalid_mcp_control_request", dispatch: () => ({ ok: true }) }); }

test("MCP close during listen startup releases the server and permanently prevents restart/binding", async () => {
  const server = control(), starting = server.start(process.execPath, []).then(value => value, error => error);
  await server.close({ force: true }); const result = await starting;
  expect(result).toBeInstanceOf(Error); expect(result.message).toBe("acp_mcp_control_closed");
  expect(server.snapshot).toEqual({ closed: true, listening: false });
  await expect(server.start(process.execPath, [])).rejects.toThrow("acp_mcp_control_closed");
  expect(() => server.bindSession("new")).toThrow("acp_mcp_control_closed");
});

test("one MCP control cannot be rebound to a different owner", async () => {
  const server = control(); await server.start(process.execPath, []); server.bindSession("first"); server.bindSession("first");
  expect(() => server.bindSession("second")).toThrow("acp_mcp_control_already_bound");
  await server.close({ force: true }); expect(server.snapshot.listening).toBe(false);
});
