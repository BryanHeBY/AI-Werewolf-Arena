import { AcpSession, AcpSessionCreateInput, AcpSessionFactory } from "../../integrations/acp/session";
import { closeAcpSession } from "../../integrations/acp/session_lifecycle";
import { awaitWithAbort } from "../../runtime/turn_deadline";

interface SessionEntry {
  promise: Promise<AcpSession>;
  controller: AbortController;
  session?: AcpSession;
}

/** Owns player sessions, including creations that finish after their caller timed out. */
export class AcpSessionPool {
  private readonly entries = new Map<number, SessionEntry>();
  private closed = false;

  constructor(private readonly onDiscard: (actorId: number) => void) {}

  get isClosed(): boolean { return this.closed; }

  async getOrCreate(
    actorId: number,
    deadlineAtMs: number,
    prepare: () => { factory: AcpSessionFactory; input: AcpSessionCreateInput },
  ): Promise<AcpSession> {
    if (this.closed) throw new Error("acp_provider_closed");
    const existing = this.entries.get(actorId);
    if (existing) return existing.promise;
    const { factory, input } = prepare();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("acp_initialize_timeout")),
      Math.max(0, deadlineAtMs - Date.now()),
    );
    const created = Promise.resolve().then(() => factory.createSession({
      ...input,
      actorId,
      deadlineAtMs,
      signal: controller.signal,
    }));
    const entry: SessionEntry = { promise: awaitWithAbort(created, controller.signal), controller };
    this.entries.set(actorId, entry);
    void created.then((session) => {
      entry.session = session;
      if (controller.signal.aborted || this.closed) void closeAcpSession(session, true);
    }, () => undefined);
    try {
      return await entry.promise;
    } catch (error) {
      if (this.entries.get(actorId) === entry) this.discard(actorId);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  discard(actorId: number): void {
    const entry = this.entries.get(actorId);
    if (!entry) return;
    this.entries.delete(actorId);
    this.onDiscard(actorId);
    entry.controller.abort(new Error("acp_session_discarded"));
    if (entry.session) void closeAcpSession(entry.session, true);
  }

  async close(): Promise<void> {
    this.closed = true;
    const closing: Promise<void>[] = [];
    for (const entry of this.entries.values()) {
      entry.controller.abort(new Error("acp_provider_closed"));
      if (entry.session) closing.push(closeAcpSession(entry.session));
    }
    this.entries.clear();
    await Promise.all(closing);
  }
}
