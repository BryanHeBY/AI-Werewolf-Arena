import { AcpSession } from "./session";
import { awaitBeforeDeadline } from "../../runtime/turn_deadline";

export const ACP_CLOSE_TIMEOUT_MS = 6_000;
export class AcpInitializationCleanupError extends AggregateError {
  constructor(primary: unknown, cleanup: unknown) {
    super([primary, cleanup], "acp_initialization_cleanup_failed");
  }
}

/** A failed graceful close still forces reclamation and preserves every failure. */
export async function closeAcpSession(
  session: AcpSession,
  force = false,
  timeoutMs = ACP_CLOSE_TIMEOUT_MS,
): Promise<void> {
  const attempt = (forced: boolean) =>
    awaitBeforeDeadline(() => session.close({ force: forced }), Date.now() + timeoutMs);
  try {
    await attempt(force);
  } catch (error) {
    if (force) throw error;
    try {
      await attempt(true);
    } catch (forcedError) {
      if (forcedError === error) throw error;
      throw new AggregateError([error, forcedError], "acp_session_close_failed");
    }
    throw error;
  }
}
