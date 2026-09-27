import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionRecordManager } from "./session_recorder";

const sessionRecorders = new AsyncLocalStorage<SessionRecordManager>();

/** Bind synchronous work and its asynchronous descendants to one recording session. */
export function runWithSessionRecorder<T>(recorder: SessionRecordManager, run: () => T): T {
  return sessionRecorders.run(recorder, run);
}

/** Recording is optional outside an explicitly owned game/session scope. */
export function getSessionRecorder(): SessionRecordManager | null {
  return sessionRecorders.getStore() ?? null;
}
