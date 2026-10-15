/**
 * 持有传输集成测试的有界 HTTP 关闭探测驱动；输入为原 localhost 端点、私有 control 令牌及超时，输出为原关闭／端口复用分类或探测错误。状态和请求错误交给手写传输预期检查器；保留正文限制、定时器取消、请求销毁及等待关闭清理，不记录令牌或推进游戏阶段。
 */
import { classifyControlResponse, classifyControlRequestError } from "../../oracles/transport/control-owner";
import { request } from "node:http";

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
          classifyControlResponse(response, body, finish, fail);
        } catch {
          fail(new Error("fixture_control_probe_invalid_response"));
        }
      });
    },
  );
  const closed = new Promise<void>((resolve) => probe.once("close", resolve));
  probe.once("error", (error: NodeJS.ErrnoException) => {
    classifyControlRequestError(error, finish, fail);
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
