import { AcpSession } from "./session";
import { settleWithin } from "../../runtime/turn_deadline";

export const ACP_CLOSE_TIMEOUT_MS = 6_000;

export async function closeAcpSession(session: AcpSession, force = false): Promise<void> {
  await settleWithin(Promise.resolve().then(() => session.close({ force })), ACP_CLOSE_TIMEOUT_MS);
}
