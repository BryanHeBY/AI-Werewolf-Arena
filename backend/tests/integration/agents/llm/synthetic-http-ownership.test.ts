/**
 * 集成测试在 control 端口复用后访问测试持有的合成 SDK HTTP 端点，以载荷解析前拒绝旧 owner 的字面预期核对认证后的端点所有权。预期来自既有字面值及独立夹具；仅本地传输／录制，不调用外部或计费模型。
 */
import { expect, test } from "bun:test";
import { LoopbackMcpControlServer } from "../../../../src/adapters/acp/loopback-mcp-control-server";
import { assertControlOwnerClosed } from "../../../support/drivers/transport/control-owner";
import {
  authenticatedSyntheticModelFetch,
  syntheticModelToken,
} from "../../../support/drivers/agents/synthetic-model-fetch";

test("released control port reused by SDK fixture rejects old owner before parsing", async () => {
  const original = new LoopbackMcpControlServer({
      serverName: "synthetic-model-port",
      controlUrlEnvironmentName: "SYNTHETIC_URL",
      tokenEnvironmentName: "SYNTHETIC_TOKEN",
      sessionNotReadyError: "session_not_ready",
      invalidRequestPrefix: "invalid_request",
      dispatch: () => ({ ok: true }),
    }),
    config = await original.start(process.execPath, []),
    env = Object.fromEntries(config.env.map(({ name, value }) => [name, value])),
    endpoint = env.SYNTHETIC_URL!,
    previous = env.SYNTHETIC_TOKEN!,
    current = syntheticModelToken(),
    otherSdk = syntheticModelToken();
  let parsed = 0,
    accepted = 0;
  const failures: string[] = [];
  original.bindSession("original");
  await expect(assertControlOwnerClosed(endpoint, previous)).rejects.toThrow("unknown_200");
  await original.close({ force: true });
  const replacement = Bun.serve({
    hostname: "127.0.0.1",
    port: Number(new URL(endpoint).port),
    fetch: authenticatedSyntheticModelFetch(current, async (request) => {
      parsed++;
      try {
        const body = (await request.json()) as { model?: string };
        if (body.model !== "synthetic-player-1") throw Error("fixture_model_invalid");
        accepted++;
        return Response.json({ ok: true });
      } catch (error) {
        failures.push(String(error));
        return Response.json({ error: { message: "fixture_protocol_failure" } }, { status: 400 });
      }
    }),
  });
  try {
    expect(replacement.url.origin).toBe(endpoint);
    expect(await assertControlOwnerClosed(endpoint, previous)).toBe("reused_by_different_owner");
    for (const token of [undefined, previous, otherSdk]) {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: "{malformed",
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ ok: false, error: "unauthorized" });
    }
    expect(parsed).toBe(0);
    expect(accepted).toBe(0);
    expect(failures).toEqual([]);
    const success = await fetch(`${endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${current}` },
      body: JSON.stringify({ model: "synthetic-player-1" }),
    });
    expect(success.status).toBe(200);
    await success.json();
    expect(parsed).toBe(1);
    expect(accepted).toBe(1);
    const invalid = await fetch(`${endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${current}` },
      body: "{malformed",
    });
    expect(invalid.status).toBe(400);
    await invalid.json();
    expect(parsed).toBe(2);
    expect(accepted).toBe(1);
    expect(failures).toHaveLength(1);
  } finally {
    await original.close({ force: true });
    await replacement.stop(true);
  }
});
