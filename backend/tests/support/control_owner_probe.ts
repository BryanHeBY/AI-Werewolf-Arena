import { request } from "node:http";

/** Probe the former owner directly, even if another game reused its released port. */
export async function assertControlOwnerClosed(
  endpoint: string,
  token: string,
  timeoutMs = 1000,
): Promise<"closed" | "reused_by_different_owner"> {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint) || !/^[\w-]+$/.test(token))
    throw new Error("fixture_control_probe_invalid_input");
  const payload = JSON.stringify({ tool: "get_game_schema", arguments: {} });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finish!: (value: "closed" | "reused_by_different_owner") => void;
  let fail!: (error: Error) => void;
  const outcome = new Promise<"closed" | "reused_by_different_owner">((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const probe = request(
    {
      hostname: "127.0.0.1",
      port: Number(new URL(endpoint).port),
      path: "/invoke",
      method: "POST",
      agent: false,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        connection: "close",
      },
    },
    (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 4096) {
          fail(new Error("fixture_control_probe_body_too_large"));
          probe.destroy();
        } else chunks.push(chunk);
      });
      response.once("error", () => fail(new Error("fixture_control_probe_response_error")));
      response.once("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (response.statusCode === 401 && body?.ok === false && body?.error === "unauthorized")
            finish("reused_by_different_owner");
          else
            fail(
              new Error(`fixture_control_owner_still_reachable_or_unknown_${response.statusCode}`),
            );
        } catch {
          fail(new Error("fixture_control_probe_invalid_response"));
        }
      });
    },
  );
  const closed = new Promise<void>((resolve) => probe.once("close", resolve));
  probe.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "ECONNREFUSED") finish("closed");
    else fail(new Error(`fixture_control_probe_request_error_${error.code ?? "unknown"}`));
  });
  timer = setTimeout(() => {
    fail(new Error("fixture_control_probe_timeout"));
    probe.destroy();
  }, timeoutMs);
  probe.end(payload);
  try {
    return await outcome;
  } finally {
    clearTimeout(timer);
    probe.destroy();
    await closed;
  }
}
