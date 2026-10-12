import { expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { LoopbackMcpControlServer } from "../../../src/ai/integrations/acp/loopback_mcp_control_server";
import { assertControlOwnerClosed } from "../../support/oracles/control-owner";

function control() {
  return new LoopbackMcpControlServer({
    serverName: "synthetic-probe",
    controlUrlEnvironmentName: "SYNTHETIC_URL",
    tokenEnvironmentName: "SYNTHETIC_TOKEN",
    sessionNotReadyError: "session_not_ready",
    invalidRequestPrefix: "invalid_request",
    locale: "en",
    dispatch: () => ({ ok: true }),
  });
}

async function start(server: LoopbackMcpControlServer) {
  const config = await server.start(process.execPath, []);
  const env = Object.fromEntries(config.env.map(({ name, value }) => [name, value]));
  return { endpoint: env.SYNTHETIC_URL!, token: env.SYNTHETIC_TOKEN! };
}

test("owner probe rejects both an unbound and bound original listener, then proves closure", async () => {
  const server = control();
  try {
    const { endpoint, token } = await start(server);
    await expect(assertControlOwnerClosed(endpoint, token)).rejects.toThrow("unknown_409");
    server.bindSession("original");
    await expect(assertControlOwnerClosed(endpoint, token)).rejects.toThrow("unknown_200");
    await server.close({ force: true });
    expect(await assertControlOwnerClosed(endpoint, token)).toBe("closed");
    expect(server.snapshot).toEqual({ closed: true, listening: false });
  } finally {
    await server.close({ force: true });
  }
});

test("same-port replacement is distinguished from a still reachable original owner", async () => {
  const original = control(),
    replacement = control();
  try {
    const previous = await start(original);
    original.bindSession("original");
    await expect(assertControlOwnerClosed(previous.endpoint, previous.token)).rejects.toThrow(
      "unknown_200",
    );
    await original.close({ force: true });
    // Keep production's ephemeral-port API unchanged; force reuse only in this controlled test.
    const listener = (replacement as unknown as { server: Server }).server;
    const listen = listener.listen.bind(listener);
    listener.listen = ((_port: number, host: string, ready: () => void) =>
      listen(Number(new URL(previous.endpoint).port), host, ready)) as typeof listener.listen;
    const current = await start(replacement);
    replacement.bindSession("replacement");
    expect(current.endpoint).toBe(previous.endpoint);
    expect(current.token === previous.token).toBe(false);
    expect(await assertControlOwnerClosed(previous.endpoint, previous.token)).toBe(
      "reused_by_different_owner",
    );
    await expect(assertControlOwnerClosed(current.endpoint, current.token)).rejects.toThrow(
      "unknown_200",
    );
    await replacement.close({ force: true });
    expect(await assertControlOwnerClosed(previous.endpoint, previous.token)).toBe("closed");
  } finally {
    await original.close({ force: true });
    await replacement.close({ force: true });
  }
});

for (const [label, status, body] of [
  ["dispatch failure", 400, '{"ok":false,"error":"invalid_request"}'],
  ["cleared session", 409, '{"ok":false,"error":"session_not_ready"}'],
  ["wrong route", 404, '{"ok":false,"error":"not_found"}'],
  ["redirect", 302, "{}"],
  ["not JSON", 401, "unauthorized"],
  ["wrong error", 401, '{"ok":false,"error":"not_found"}'],
  ["wrong success flag", 401, '{"ok":true,"error":"unauthorized"}'],
  ["oversized", 401, "x".repeat(4097)],
] as const)
  test(`owner probe fails closed for ${label}`, async () => {
    const server = createServer((_request, response) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      await expect(assertControlOwnerClosed(endpoint, "synthetic-token")).rejects.toThrow();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

for (const mode of ["hang", "reset"] as const)
  test(`owner probe bounds and rejects ${mode}, then releases its socket`, async () => {
    let connected = 0;
    const server = createServer((request) => {
      if (mode === "reset") request.socket.destroy();
    });
    server.on("connection", (socket) => {
      connected++;
      socket.once("close", () => connected--);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      await expect(assertControlOwnerClosed(endpoint, "synthetic-token", 100)).rejects.toThrow();
      for (let attempt = 0; attempt < 20 && connected; attempt++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      expect(connected).toBe(0);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
