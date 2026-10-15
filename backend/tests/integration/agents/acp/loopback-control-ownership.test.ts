/**
 * Integration tests: Exercises the real loopback MCP control listener across startup/close
 * and owner rebinding. Literal terminal error and listening snapshots check permanent
 * closure and the original single owner. Existing literal expectations and independently
 * supplied fixture plans remain the oracle; transport/recording setup is local and no
 * billed model session is started.
 */
import { expect, test } from "bun:test";
import { LoopbackMcpControlServer } from "../../../../src/adapters/acp/loopback-mcp-control-server";
function control() {
  return new LoopbackMcpControlServer({
    serverName: "synthetic",
    controlUrlEnvironmentName: "SYNTHETIC_URL",
    tokenEnvironmentName: "SYNTHETIC_TOKEN",
    sessionNotReadyError: "session_not_ready",
    invalidRequestPrefix: "invalid_mcp_control_request",
    dispatch: () => ({ ok: true }),
  });
}

test("MCP close during listen startup releases the server and permanently prevents restart/binding", async () => {
  const server = control(),
    starting = server.start(process.execPath, []).then(
      (value) => value,
      (error) => error,
    );
  await server.close({ force: true });
  const result = await starting;
  expect(result).toBeInstanceOf(Error);
  expect(result.message).toBe("acp_mcp_control_closed");
  expect(server.snapshot).toEqual({ closed: true, listening: false });
  await expect(server.start(process.execPath, [])).rejects.toThrow("acp_mcp_control_closed");
  expect(() => server.bindSession("new")).toThrow("acp_mcp_control_closed");
});

test("one MCP control cannot be rebound to a different owner", async () => {
  const server = control();
  await server.start(process.execPath, []);
  server.bindSession("first");
  server.bindSession("first");
  expect(() => server.bindSession("second")).toThrow("acp_mcp_control_already_bound");
  await server.close({ force: true });
  expect(server.snapshot.listening).toBe(false);
});
