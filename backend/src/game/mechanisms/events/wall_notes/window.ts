/**
 * Opens the configured wall-note opportunity and collects its existing author actions.
 * Inputs are readonly event policy, original World, provider and named RNG factory;
 * outputs are wall-note facts and window completion. Wall authority owns author stock
 * and request closure; this window never changes rules or acquires unrelated capabilities.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import {
  COMPONENT,
  Phase,
  type World,
  type ActionProvider,
  type GameEvent,
  type ToolCall,
} from "../../../../core/domain";
import { shuffled, type RandomSource } from "../../../../core/domain/random";
import { readWallTool } from "@ai-werewolf-arena/game-text";
import type { GameActionRequestFactory } from "../../../engine/action_request_factory";
import { ToolGateway } from "../../../gateway/tool_gateway";
import {
  openWall,
  closeWall,
  grantWallNote,
  sameWallAuthor,
  hasActiveWall,
  hasWallCommit,
  type WallAuthor,
} from "./authority";
export class WallNotesWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
    private readonly events: GameEvent[],
  ) {}
  async execute(
    config: ReadonlyBoardConfig,
    requests: GameActionRequestFactory,
    provider: ActionProvider,
    day: number,
    isCurrent: () => boolean,
    random: () => RandomSource,
  ): Promise<void> {
    if (hasActiveWall(this.world)) throw new Error("wall_window_reentry");
    if (
      config.events?.pack !== "awa_wall_notes_once_v1" ||
      day !== 1 ||
      hasWallCommit(this.world) ||
      !isCurrent()
    )
      return;
    const pack = config.events;
    const windowCurrent = () =>
      isCurrent() && config.events === pack && pack.pack === "awa_wall_notes_once_v1";
    const a = openWall(this.world, windowCurrent);
    const cancel = () => {
      if (isCurrent())
        this.events.push({
          timestamp: Date.now(),
          type: "wall_notes_canceled",
          payload: { day: 1, eventId: "awa_wall_notes_v1", reason: "scope_changed" },
        });
    };
    const change = (
      author: WallAuthor,
      operation: "granted" | "accepted" | "rejected" | "revoked" | "expired",
      text?: string,
    ) =>
      this.events.push({
        timestamp: Date.now(),
        type: "wall_note_changed",
        payload: {
          actorId: author.id,
          day: 1,
          eventId: "awa_wall_notes_v1",
          itemId: "anonymous_note",
          instanceId: author.instanceId,
          operation,
          remaining: author.remaining,
          expired: operation === "expired",
          ...(operation === "accepted" ? { text: text! } : {}),
        },
      });
    const base = { day: 1 as const, eventId: "awa_wall_notes_v1" as const };
    try {
      this.events.push({ timestamp: Date.now(), type: "wall_notes_started", payload: base });
      const authors = this.world
        .getAliveEntityIds()
        .sort((x, y) => x - y)
        .flatMap((id) => {
          const author = grantWallNote(this.world, a, id);
          if (!author) return [];
          change(author, "granted");
          return [author];
        });
      const calls = authors.map((author) => ({
        author,
        request: requests.create({
          actorId: author.id,
          phase: Phase.Voting,
          allowedTools: ["write_note"],
          stage: "wall_notes",
          requiresAction: false,
          summary: { key: "request.summary.wall_notes" },
          context: { wall_id: a.token, item_instance_id: author.instanceId, allow_fallback: false },
        }),
      }));
      const results = await Promise.allSettled(
        calls.map(({ author, request }) =>
          sameWallAuthor(this.world, a, author)
            ? Promise.resolve().then(() =>
                sameWallAuthor(this.world, a, author) ? provider.getAction(request) : null,
              )
            : Promise.resolve(null),
        ),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      if (!windowCurrent()) {
        cancel();
        return;
      }
      const accepted: Array<{ author: WallAuthor; text: string }> = [];
      for (let i = 0; i < calls.length; i++) {
        const { author } = calls[i],
          result = results[i];
        if (!sameWallAuthor(this.world, a, author)) {
          change(author, "revoked");
          continue;
        }
        const call = result.status === "fulfilled" ? readWallTool(result.value) : null;
        if (!call) {
          if (result.status === "fulfilled" && result.value !== null) change(author, "rejected");
          continue;
        }
        const valid = this.gateway.validateAndSanitize(this.world, author.id, call, {
          phase: Phase.Voting,
          day: 1,
          wallScope: a,
          wallId: a.token,
          itemInstanceId: author.instanceId,
        });
        if (!sameWallAuthor(this.world, a, author)) {
          change(author, "revoked");
          continue;
        }
        if (!valid.ok) {
          change(author, "rejected");
          continue;
        }
        author.remaining = 0;
        author.note.remaining = 0;
        change(author, "accepted", call.args.text);
        accepted.push({ author, text: call.args.text });
      }
      if (!windowCurrent()) {
        cancel();
        return;
      }
      const current = accepted.filter((row) => {
        if (sameWallAuthor(this.world, a, row.author)) return true;
        change(row.author, "revoked");
        return false;
      });
      const ordered = current.sort((x, y) =>
        x.text < y.text ? -1 : x.text > y.text ? 1 : x.author.id - y.author.id,
      );
      const final = shuffled(ordered, random());
      if (!windowCurrent() || final.some((row) => !sameWallAuthor(this.world, a, row.author))) {
        cancel();
        return;
      }
      this.events.push(
        {
          timestamp: Date.now(),
          type: "wall_note_order_recorded",
          payload: {
            ...base,
            rows: final.map(({ author, text }, rank) => ({
              actorId: author.id,
              instanceId: author.instanceId,
              text,
              rank,
            })),
          },
        },
        {
          timestamp: Date.now(),
          type: "wall_notes_published",
          payload: { ...base, texts: final.map((row) => row.text) },
        },
      );
    } finally {
      closeWall(this.world, a);
      for (const author of a.authors.values()) change(author, "expired");
    }
  }
}
