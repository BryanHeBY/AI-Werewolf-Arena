/**
 * Unit test verifies ACP update diagnostics and an inert file-writer failure retain safe error facts and original text.
 * Input: Original synthetic RetryError, local output capture and ReplayFileStore whose actual write method is replaced by a rejecting callback.
 * Output and oracle: Exact safe status/abort codes, unchanged thought text and exclusion of opaque canary values preserve assertions; no actual file or process is created.
 */
import { expect, test } from "bun:test";
import { RetryError } from "ai";
import { createAcpConsoleLogger } from "../../../src/runtime/console_presenter";
import { ReplayFileStore } from "../../../src/recording/file_store";
import { describeError } from "../../../src/utils/error_diagnostic";

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
