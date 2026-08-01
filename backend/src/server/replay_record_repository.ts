import { promises as fs } from "fs";
import path from "path";
import {
  ReplayManifest,
  ReplayPhaseWindowsFile,
  ReplayPlayerView,
  ReplayPublicEvent,
} from "../observability/types";
import {
  ReplayDocument,
  createReplayDocument,
} from "../observability/replay_document";

export class ReplayRepositoryError extends Error {
  constructor(
    public readonly code:
      | "SESSION_NOT_FOUND"
      | "PLAYER_NOT_FOUND"
      | "INVALID_QUERY"
      | "RECORD_UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

export interface TimelineQuery {
  fromSeq?: number;
  toSeq?: number;
  phaseId?: string;
}

export interface PlayerTimelineQuery {
  phaseId?: string;
  kind?: "event" | "turn";
}

function parsePhaseId(phaseId: string): { day: number; phase: string } | null {
  const match = /^d(\d+)-(.+)$/.exec(phaseId.trim());
  if (!match) {
    return null;
  }
  return { day: Number(match[1]), phase: match[2] };
}

export class ReplayRecordRepository {
  constructor(private readonly recordRootDir: string) {}

  get recordRoot(): string {
    return this.recordRootDir;
  }

  async listSessionIds(): Promise<string[]> {
    try {
      const items = await fs.readdir(this.recordRootDir, { withFileTypes: true });
      const dirs = items
        .filter((item) => item.isDirectory() && item.name.startsWith("session_"))
        .map((item) => item.name)
        .sort((a, b) => b.localeCompare(a));
      return dirs;
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return [];
      }
      throw new ReplayRepositoryError(
        "RECORD_UNAVAILABLE",
        `record root unavailable: ${String(error)}`,
      );
    }
  }

  async getManifest(sessionId: string): Promise<ReplayManifest> {
    return this.readJsonFile<ReplayManifest>(sessionId, "manifest.json", "SESSION_NOT_FOUND");
  }

  /** 读取后端直接生成的前端复盘；旧 session 仍可由规范记录无损构造。 */
  async getReplay(sessionId: string): Promise<ReplayDocument> {
    try {
      return await this.readJsonFile<ReplayDocument>(
        sessionId,
        "replay.json",
        "SESSION_NOT_FOUND",
      );
    } catch (error) {
      if (!(error instanceof ReplayRepositoryError) || error.code !== "SESSION_NOT_FOUND") {
        throw error;
      }
    }

    const [manifest, timeline] = await Promise.all([
      this.getManifest(sessionId),
      this.getPublicTimeline(sessionId, {}),
    ]);
    return createReplayDocument({ manifest, events: timeline.events });
  }

  async getResult(sessionId: string): Promise<{
    sessionId: string;
    gameOver: boolean;
    result: { winner: string | null; reason: string | null };
  }> {
    const manifest = await this.getManifest(sessionId);
    const gameOver = manifest.finish_reason !== "in_progress";
    return {
      sessionId: manifest.session_id,
      gameOver,
      result: {
        winner: manifest.winner,
        reason: manifest.finish_reason || null,
      },
    };
  }

  async getPhaseWindows(sessionId: string): Promise<ReplayPhaseWindowsFile> {
    try {
      return await this.readJsonFile<ReplayPhaseWindowsFile>(
        sessionId,
        "phase_windows.json",
        "SESSION_NOT_FOUND",
      );
    } catch (error) {
      if (
        error instanceof ReplayRepositoryError &&
        error.code === "SESSION_NOT_FOUND"
      ) {
        const timeline = await this.getPublicTimeline(sessionId, {});
        return {
          session_id: sessionId,
          windows: this.buildPhaseWindows(timeline.events),
        };
      }
      throw error;
    }
  }

  async getPublicTimeline(
    sessionId: string,
    query: TimelineQuery,
  ): Promise<{
    sessionId: string;
    events: ReplayPublicEvent[];
    page: { fromSeq: number; toSeq: number; hasMore: boolean };
  }> {
    this.validateTimelineQuery(query);
    const events = await this.readRecordedTimeline(sessionId);
    const phaseRange = query.phaseId
      ? await this.resolvePhaseRange(sessionId, query.phaseId)
      : null;
    const effectiveFrom = Math.max(
      query.fromSeq ?? 1,
      phaseRange?.startSeq ?? 1,
    );
    const effectiveTo = Math.min(
      query.toSeq ?? Number.MAX_SAFE_INTEGER,
      phaseRange?.endSeq ?? Number.MAX_SAFE_INTEGER,
    );
    const filtered = events.filter(
      (event) => event.seq >= effectiveFrom && event.seq <= effectiveTo,
    );
    const sourceMax = phaseRange?.endSeq ?? (events.at(-1)?.seq ?? 0);
    const toSeq = filtered.at(-1)?.seq ?? Math.max(effectiveFrom - 1, 0);
    return {
      sessionId,
      events: filtered,
      page: {
        fromSeq: effectiveFrom,
        toSeq,
        hasMore: sourceMax > toSeq,
      },
    };
  }

  async getPlayerTimeline(
    sessionId: string,
    playerId: number,
    query: PlayerTimelineQuery,
  ): Promise<{
    sessionId: string;
    playerId: number;
    timeline: ReplayPlayerView["timeline"];
  }> {
    const file = `players/player_${playerId}.json`;
    const view = await this.readJsonFile<ReplayPlayerView>(
      sessionId,
      file,
      "PLAYER_NOT_FOUND",
    );
    let timeline = Array.isArray(view.timeline) ? view.timeline : [];
    if (query.kind) {
      timeline = timeline.filter((entry) => entry.kind === query.kind);
    }
    if (query.phaseId) {
      const phase = parsePhaseId(query.phaseId);
      if (!phase) {
        throw new ReplayRepositoryError("INVALID_QUERY", "invalid phaseId");
      }
      timeline = timeline.filter(
        (entry) => entry.day === phase.day && entry.phase === phase.phase,
      );
    }
    return {
      sessionId,
      playerId,
      timeline,
    };
  }

  private async resolvePhaseRange(
    sessionId: string,
    phaseId: string,
  ): Promise<{ startSeq: number; endSeq: number } | null> {
    const phaseWindows = await this.getPhaseWindows(sessionId);
    const found = phaseWindows.windows.find((item) => item.phase_id === phaseId);
    if (!found) {
      return null;
    }
    return { startSeq: found.start_seq, endSeq: found.end_seq };
  }

  private async readRecordedTimeline(sessionId: string): Promise<ReplayPublicEvent[]> {
    try {
      const replay = await this.readJsonFile<ReplayDocument>(
        sessionId,
        "replay.json",
        "SESSION_NOT_FOUND",
      );
      return Array.isArray(replay.events) ? replay.events : [];
    } catch (error) {
      if (!(error instanceof ReplayRepositoryError) || error.code !== "SESSION_NOT_FOUND") {
        throw error;
      }
    }

    // 旧 session 兼容读取；新记录只以 replay.json 保存事件正文。
    const legacy = await this.readJsonFile<{ events: ReplayPublicEvent[] }>(
      sessionId,
      "public_timeline.json",
      "SESSION_NOT_FOUND",
    );
    return Array.isArray(legacy.events) ? legacy.events : [];
  }

  private validateTimelineQuery(query: TimelineQuery): void {
    const checks: Array<[number | undefined, string]> = [
      [query.fromSeq, "fromSeq"],
      [query.toSeq, "toSeq"],
    ];
    for (const [value, name] of checks) {
      if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
        throw new ReplayRepositoryError("INVALID_QUERY", `${name} must be >= 1`);
      }
    }
    if (
      query.fromSeq !== undefined &&
      query.toSeq !== undefined &&
      query.fromSeq > query.toSeq
    ) {
      throw new ReplayRepositoryError(
        "INVALID_QUERY",
        "fromSeq must be <= toSeq",
      );
    }
    if (query.phaseId && !parsePhaseId(query.phaseId)) {
      throw new ReplayRepositoryError("INVALID_QUERY", "invalid phaseId");
    }
  }

  private async readJsonFile<T>(
    sessionId: string,
    relativePath: string,
    missingCode: "SESSION_NOT_FOUND" | "PLAYER_NOT_FOUND",
  ): Promise<T> {
    const filePath = path.join(this.recordRootDir, sessionId, relativePath);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw) as T;
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        throw new ReplayRepositoryError(missingCode, `${relativePath} not found`);
      }
      throw new ReplayRepositoryError(
        "RECORD_UNAVAILABLE",
        `failed to read ${relativePath}: ${String(error)}`,
      );
    }
  }

  private buildPhaseWindows(events: ReplayPublicEvent[]): ReplayPhaseWindowsFile["windows"] {
    const windows: ReplayPhaseWindowsFile["windows"] = [];
    for (const event of events) {
      const current = windows[windows.length - 1];
      const stage = String(event.stage ?? event.type ?? "unknown");
      const phaseId = `d${event.day}-${event.phase}`;
      if (!current || current.day !== event.day || current.phase !== event.phase) {
        windows.push({
          phase_id: phaseId,
          day: event.day,
          phase: event.phase,
          start_seq: event.seq,
          end_seq: event.seq,
          stages: [{ stage, start_seq: event.seq, end_seq: event.seq }],
        });
        continue;
      }
      current.end_seq = event.seq;
      const lastStage = current.stages[current.stages.length - 1];
      if (lastStage && lastStage.stage === stage) {
        lastStage.end_seq = event.seq;
      } else {
        current.stages.push({ stage, start_seq: event.seq, end_seq: event.seq });
      }
    }
    return windows;
  }
}
