import { expect, test } from "bun:test";
import path from "node:path";
import { AcpAuditAgentExecutor } from "../../../src/ai/audit/acp_audit_runner";
import type { AuditToolContext } from "../../../src/ai/audit/audit_tool_protocol";
import type { AcpSession } from "../../../src/ai/integrations/acp/session";
import type { ResolvedAgentRuntimeProfile } from "../../../src/runtime/config/contracts";
import { createTestTempDirectory } from "../../support/temp_directory";

const profile: ResolvedAgentRuntimeProfile = { name: "synthetic", providerName: "synthetic", kind: "acp", provider: { type: "acp", transport: "stdio", command: "/bin/false", args: [], env: {}, sessionConfigOptions: {} } };
const context: AuditToolContext = { locale: "en", mode: "inspect", taskName: "synthetic", source: "synthetic", payload: { events: [{ seq: 1 }] } };

test("audit prompt and cleanup errors retain both original identities", async () => {
  const primary = new Error("prompt-failed"), cleanup = new Error("cleanup-failed");
  const executor = new AcpAuditAgentExecutor({ profile, workspaceRoot: await createTestTempDirectory("awa-audit-fault-"), sessionFactoryResolver: () => ({ async createSession() {
    return { sessionId: "synthetic", async prompt() { throw primary; }, async cancel() {}, async close() { throw cleanup; } };
  } }) });
  const result = await executor.runTurn(context, { timeoutMs: 1000 }).then(() => null, error => error);
  expect(result).toBeInstanceOf(AggregateError); expect(result.errors).toEqual([primary, cleanup]);
  const closing = await executor.close().then(() => null, error => error); expect(closing.errors).toEqual([cleanup]);
  expect(executor.runtimeState).toEqual({ closed: true, pending: 0, sessions: 0, creating: 0, retiring: 0 });
});

test("audit owns late session reclamation failure after its caller has timed out", async () => {
  let resolve!: (session: AcpSession) => void, forced = 0;
  const created = new Promise<AcpSession>(done => { resolve = done; });
  const cleanup = new Error("late-close-failed");
  const executor = new AcpAuditAgentExecutor({ profile, workspaceRoot: await createTestTempDirectory("awa-audit-late-"), sessionFactoryResolver: () => ({ createSession: () => created }) });
  expect(await executor.runTurn(context, { timeoutMs: 20 })).toBeNull(); expect(executor.runtimeState.creating).toBe(1);
  resolve({ sessionId: "late", async prompt() {}, async cancel() {}, async close(options) { if (options?.force) forced++; throw cleanup; } });
  const result = await executor.close().then(() => null, error => error);
  expect(result.errors).toEqual([cleanup]); expect(forced).toBe(1);
  expect(executor.runtimeState).toEqual({ closed: true, pending: 0, sessions: 0, creating: 0, retiring: 0 });
});

test("audit close cancels an open prompt and waits for session retirement", async () => {
  let ready!: () => void, closed = 0;
  const begun = new Promise<void>(done => { ready = done; });
  const executor = new AcpAuditAgentExecutor({ profile, workspaceRoot: path.join(await createTestTempDirectory("awa-audit-stop-"), "scope"), sessionFactoryResolver: () => ({ async createSession() {
    return { sessionId: "open", async prompt() { ready(); await new Promise<never>(() => {}); }, async cancel() {}, async close() { closed++; } };
  } }) });
  const pending = executor.runTurn(context, { timeoutMs: 1000 }); await begun; await executor.close();
  expect(await pending).toBeNull(); expect(closed).toBe(1);
  expect(executor.runtimeState).toEqual({ closed: true, pending: 0, sessions: 0, creating: 0, retiring: 0 });
});
