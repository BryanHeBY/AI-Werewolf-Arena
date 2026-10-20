/**
 * 单元测试以合成 RetryError、本地输出捕获及实际 write 方法被拒绝回调替代的 ReplayFileStore 为输入，核对 ACP update 诊断及未实际写盘的 writer 失败保留安全错误事实与原文本。精确安全状态／取消码、思考文本不变及不透明探针排除为预期；不创建真实文件或进程。
 */
import { expect, test } from "bun:test";
import { RetryError } from "ai";
import { createAcpConsoleLogger } from "../../../src/adapters/console/console-presenter";
import { ReplayFileStore } from "../../../src/adapters/filesystem/session-file-store";
import { describeError } from "../../../src/utils/error-diagnostic";

const secret = "synthetic-private-transport-canary";

const failure = () =>
  new RetryError({
    message: secret,
    reason: "maxRetriesExceeded",
    errors: [
      Object.assign(new Error(secret), {
        statusCode: 429,
        isRetryable: true,
        responseHeaders: { "retry-after": "1", authorization: secret },
        url: `https://host/${secret}`,
        responseBody: secret,
      }),
    ],
  });

test("ACP error updates and file warnings drop opaque provider fields, keeping model text untouched", async () => {
  const lines: string[] = [];
  const observer = createAcpConsoleLogger(
    1,
    (line) => {
      lines.push(line);
    },
    "en",
  );
  observer({ sessionUpdate: "agent_thought_chunk", content: { text: "Original raw 思考" } });
  observer({ sessionUpdate: "tool_call", toolCallId: "c1", title: "submit_action" });
  observer({
    sessionUpdate: "tool_call_update",
    toolCallId: "c1",
    status: "failed",
    error: failure(),
  });
  observer.flush();
  expect(lines.join("\n")).toContain("Original raw 思考");
  expect(lines.join("\n")).not.toContain(secret);
  expect(lines.join("\n")).toContain('"statusCode":429');
  const store = new ReplayFileStore("/unused/synthetic", "en");
  Object.defineProperty(store, "writeAtomic", {
    value: async () => {
      throw Object.assign(new Error(secret), { code: "EACCES", path: secret });
    },
  });
  const warnings: string[] = [];
  const previous = console.warn;
  console.warn = (...values) => {
    warnings.push(values.join(" "));
  };
  try {
    await store.writeText("synthetic.txt", "Original text");
  } finally {
    console.warn = previous;
  }
  expect(warnings.join("\n")).not.toContain(secret);
  expect(warnings.join("\n")).toContain("filesystem operation");
  expect(describeError(new Error("acp_provider_closed"))).toEqual({ code: "request_aborted" });
});
