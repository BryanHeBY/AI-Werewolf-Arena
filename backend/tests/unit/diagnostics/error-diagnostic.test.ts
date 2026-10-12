/**
 * Unit tests: Error diagnostics use literal SDK/network/file/cancellation errors and
 * hostile objects; whitelisted safe facts, original identity and zero-getter expectations
 * check detached diagnostic classification. Inputs and expected outcomes remain the
 * original literal or immutable-fixture oracle; these module assertions invoke no model or
 * complete-game driver.
 */
import { expect, test } from "bun:test";
import { RetryError } from "ai";
import {
  assertErrorDiagnostic,
  readErrorDiagnostic,
  readReplayPlayerView,
} from "@ai-werewolf-arena/replay-contract";
import { describeError, formatErrorDiagnostic } from "../../../src/utils/error_diagnostic";

const secret = "synthetic-auth-response-canary";
const quota = () =>
  Object.assign(new Error(`Authorization: Bearer ${secret}; https://host/?api_key=${secret}`), {
    statusCode: 429,
    isRetryable: true,
    responseHeaders: { "retry-after": "2.5", authorization: secret },
    responseBody: secret,
    requestBodyValues: { apiKey: secret },
    url: `https://private/${secret}`,
  });

test("SDK retry wrapper retains only quota facts and does not mutate the original error", () => {
  const source = quota();
  const error = new RetryError({ message: secret, reason: "maxRetriesExceeded", errors: [source] });
  expect(describeError(error)).toEqual({
    code: "rate_limited",
    statusCode: 429,
    retryable: true,
    retryAfterMs: 2500,
  });
  expect(source.responseBody).toBe(secret);
  expect(source.message).toContain(secret);
  for (const locale of ["zh-CN", "en"] as const) {
    const formatted = formatErrorDiagnostic(error, locale);
    expect(formatted).not.toContain(secret);
    expect(formatted).not.toContain("https://");
    expect(JSON.parse(formatted).code).toBe("rate_limited");
    expect(JSON.parse(formatted).message).toContain(locale === "en" ? "rate limited" : "限流");
  }
});

test("HTTP, network, file and internal timeout or cancellation categories have literal oracles", () => {
  for (const [source, expected] of [
    [
      { statusCode: 401, isRetryable: false },
      { code: "authentication_failed", statusCode: 401, retryable: false },
    ],
    [{ statusCode: 403 }, { code: "permission_denied", statusCode: 403 }],
    [{ statusCode: 503 }, { code: "model_unavailable", statusCode: 503 }],
    [{ statusCode: 504 }, { code: "request_timeout", statusCode: 504 }],
    [{ statusCode: 400 }, { code: "transport_error", statusCode: 400 }],
    [{ code: "ECONNRESET" }, { code: "network_error" }],
    [
      { code: "EACCES", path: secret },
      { code: "filesystem_error", fileCode: "EACCES" },
    ],
    [new Error("llm_request_timeout_150ms"), { code: "request_timeout" }],
    [new Error("acp_initialize_timeout"), { code: "request_timeout" }],
    [new Error("acp_session_discarded"), { code: "request_aborted" }],
    [new DOMException(secret, "AbortError"), { code: "request_aborted" }],
    [new DOMException(secret, "TimeoutError"), { code: "request_timeout" }],
  ] as const)
    expect(describeError(source)).toEqual(expected);
  for (const value of [
    secret,
    new Error(secret),
    { name: secret, message: secret },
    { statusCode: "429", isRetryable: secret },
  ])
    expect(describeError(value)).toEqual({ code: "transport_error" });
});

test("foreign getters, JSON hooks, cycles, invalid headers and deep causes cannot expose content", () => {
  let calls = 0;
  const source = Object.defineProperties(
    {},
    {
      message: {
        get() {
          calls++;
          return secret;
        },
      },
      statusCode: {
        get() {
          calls++;
          return 429;
        },
      },
      toJSON: {
        value() {
          calls++;
          return secret;
        },
      },
      toString: {
        value() {
          calls++;
          return secret;
        },
      },
    },
  );
  expect(formatErrorDiagnostic(source, "en")).not.toContain(secret);
  expect(calls).toBe(0);
  const native = new DOMException(secret, "AbortError");
  Object.defineProperty(native, "name", {
    get() {
      calls++;
      return secret;
    },
  });
  expect(describeError(native)).toEqual({ code: "request_aborted" });
  expect(calls).toBe(0);
  expect(
    describeError({ statusCode: 429, responseHeaders: { "retry-after": "1.001" } }).retryAfterMs,
  ).toBe(1001);
  const cycle = new Error(secret);
  Object.assign(cycle, { cause: cycle });
  expect(describeError(cycle)).toEqual({ code: "transport_error" });
  for (const header of [secret, "-1", "86401", "Wed, 09 Oct 2026 00:00:00 GMT", "Infinity"])
    expect(describeError({ statusCode: 429, responseHeaders: { "retry-after": header } })).toEqual({
      code: "rate_limited",
      statusCode: 429,
    });
  let deep: unknown = quota();
  for (let n = 0; n < 20; n++) deep = { cause: deep, message: secret };
  expect(describeError(deep)).toEqual({ code: "transport_error" });
  expect(formatErrorDiagnostic(deep)).not.toContain(secret);
});

test("shared private diagnostic is a strict optional extension and legacy error prose remains original", () => {
  const base = {
    schemaVersion: 2,
    session_id: "s",
    player_id: 1,
    role: "seer",
    camp: "good",
    timeline: [
      {
        seq: 1,
        kind: "turn",
        day: 1,
        phase: "day",
        stage: "day_speech",
        request_id: "r1",
        turn_seq: 1,
        delta_messages: [
          {
            role: "meta",
            kind: "request_error",
            content: "legacy 原始异常",
            diagnostic: describeError(quota()),
          },
        ],
      },
    ],
  };
  assertErrorDiagnostic(describeError(quota()));
  let reads = 0;
  const changing = Object.defineProperty({}, "code", {
    enumerable: true,
    get() {
      reads++;
      return reads <= 2 ? "rate_limited" : secret;
    },
  });
  const source = structuredClone(base);
  source.timeline[0].delta_messages[0].diagnostic = changing as never;
  const snapshot = readReplayPlayerView(source);
  expect(
    snapshot.timeline[0].kind === "turn" && snapshot.timeline[0].delta_messages[0].diagnostic?.code,
  ).toBe("rate_limited");
  expect(JSON.stringify(snapshot)).not.toContain(secret);
  expect(reads).toBe(1);
  const malformed = structuredClone(base);
  malformed.timeline[0].delta_messages[0].diagnostic = Object.defineProperty({}, "code", {
    enumerable: true,
    get() {
      return secret;
    },
  }) as never;
  expect(() => readReplayPlayerView(malformed)).toThrow("diagnostic.code");
  const read = readReplayPlayerView(base);
  expect(read.timeline[0].kind === "turn" && read.timeline[0].delta_messages[0].content).toBe(
    "legacy 原始异常",
  );
  for (const diagnostic of [
    { code: "rate_limited", responseBody: secret },
    { code: "constructor" },
    { code: "rate_limited", statusCode: "429" },
    { code: "rate_limited", retryAfterMs: -1 },
    { code: "rate_limited", retryable: "true" },
    { code: "filesystem_error", fileCode: secret },
  ]) {
    expect(() => assertErrorDiagnostic(diagnostic)).toThrow("diagnostic");
    const invalid = structuredClone(base);
    invalid.timeline[0].delta_messages[0].diagnostic = diagnostic as never;
    expect(() => readReplayPlayerView(invalid)).toThrow("diagnostic");
  }
});

test("audit input accepts only validated diagnostic facts and omits legacy raw exceptions or poisoned metadata", async () => {
  const { buildAuditTasks } = await import("../../../src/audit/payload_builder");
  for (const locale of ["zh-CN", "en"] as const) {
    const input = {
      locale,
      manifest: {
        session_id: "s",
        board: "six",
        started_at: "t1",
        ended_at: "t2",
        winner: null,
        finish_reason: "completed",
        players: [],
        files: {
          replay: "replay.json",
          logic_ops: "logic_ops.json",
          debug_reports: "debug_reports.json",
          debug_summary: "debug_summary.md",
          player_views: [],
        },
      },
      reports: [],
      publicEvents: [],
      sessionDir: "/tmp/synthetic",
      logicOps: [
        {
          seq: 1,
          timestamp: "t1",
          scope: "llm_action_provider" as const,
          op: "action_provider_error",
          actor_id: 1,
          phase: "day",
          status: "fallback" as const,
          reason: secret,
          output: { diagnostic: describeError(quota()), headers: secret },
        },
      ],
      playerViews: [
        {
          player_id: 1,
          role: "seer",
          camp: "good",
          timeline: [
            {
              seq: 1,
              kind: "turn" as const,
              day: 1,
              phase: "day",
              stage: "day_speech",
              request_id: "r1",
              turn_seq: 1,
              delta_messages: [
                {
                  role: "meta" as const,
                  kind: "request_error" as const,
                  content: secret,
                  diagnostic: describeError(quota()),
                },
                {
                  role: "meta" as const,
                  kind: "request_error" as const,
                  content: secret,
                  diagnostic: { code: "rate_limited", responseBody: secret } as never,
                },
              ],
            },
          ],
        },
      ],
    };
    const original = structuredClone(input);
    const tasks = buildAuditTasks(input, { publicMaxItems: 10, maxItems: 10, playerMaxItems: 10 });
    const all = JSON.stringify(tasks);
    expect(all).not.toContain(secret);
    expect(all).toContain('"retryAfterMs":2500');
    const logic = tasks.find((task) => task.name === "agent_logic")!.payload.ops as {
      diagnostic?: unknown;
    }[];
    expect(logic[0].diagnostic).toEqual(describeError(quota()));
    const player = tasks.find((task) => task.name === "agent_player_1")!.payload.player_view as {
      timeline: { retry_trace: { diagnostic?: unknown }[] }[];
    };
    expect(player.timeline[0].retry_trace[0].diagnostic).toEqual(describeError(quota()));
    expect(player.timeline[0].retry_trace[1].diagnostic).toBeUndefined();
    expect(input).toEqual(original);
    let reads = 0;
    const changing = Object.defineProperty({}, "code", {
      enumerable: true,
      get() {
        reads++;
        return reads <= 2 ? "rate_limited" : secret;
      },
    });
    input.logicOps[0].output.diagnostic = changing as never;
    input.playerViews[0].timeline[0].delta_messages[0].diagnostic = changing as never;
    const guarded = buildAuditTasks(input, {
      publicMaxItems: 10,
      maxItems: 10,
      playerMaxItems: 10,
    });
    expect(JSON.stringify(guarded)).not.toContain(secret);
    expect(reads).toBe(0);
    expect(() => readErrorDiagnostic(changing)).toThrow("diagnostic.code");
    expect(reads).toBe(0);
    const guardedLogic = guarded.find((task) => task.name === "agent_logic")!.payload.ops as {
      diagnostic?: unknown;
    }[];
    expect(guardedLogic[0].diagnostic).toBeUndefined();
    const guardedPlayer = guarded.find((task) => task.name === "agent_player_1")!.payload
      .player_view as { timeline: { retry_trace: { diagnostic?: unknown }[] }[] };
    expect(guardedPlayer.timeline[0].retry_trace[0].diagnostic).toBeUndefined();
  }
});
