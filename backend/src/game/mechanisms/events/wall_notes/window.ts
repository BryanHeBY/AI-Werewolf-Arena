/**
 * 开启已配置的匿名墙机会并收集原作者行动。输入为只读政策、World、Provider 及具名 RNG 工厂；输出为墙事实与窗口完成，库存与领域窗口关闭仍归 authority，请求完成由本窗口在付款后驱动；不改规则或取得其他能力。
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
import { readWallTool } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import type { RequestLeaseTurn } from "../../../../core/domain/request-lease";
import type { ActionRequestConstructionPort } from "../../../../core/domain/actions";
import { ToolGateway } from "../../../gateway/tool_gateway";
import {
  openWall,
  openWallRequestDelivery,
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
    requests: ActionRequestConstructionPort,
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
    const deliveries: RequestLeaseTurn[] = [];
    let failed = false;
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
      const calls = authors.map((author) => {
        const request = requests.create({
          actorId: author.id,
          phase: Phase.Voting,
          allowedTools: ["write_note"],
          stage: "wall_notes",
          requiresAction: false,
          summary: { key: "request.summary.wall_notes" },
          context: { wall_id: a.token, item_instance_id: author.instanceId, allow_fallback: false },
        });
        // 每个原 request 各开完成身份；部分 calls 构造失败时已打开者也须在 finally 关闭。
        const delivery = openWallRequestDelivery(this.world, request);
        if (delivery) deliveries.push(delivery);
        return { author, request, delivery };
      });
      const results = await Promise.allSettled(
        calls.map(({ author, request, delivery }) =>
          sameWallAuthor(this.world, a, author) && delivery?.current() === true
            ? Promise.resolve().then(() =>
                sameWallAuthor(this.world, a, author) && delivery?.current() === true ? provider.getAction(request) : null,
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
        const { author, delivery } = calls[i],
          result = results[i];
        if (!sameWallAuthor(this.world, a, author) || delivery?.current() !== true) {
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
        if (!sameWallAuthor(this.world, a, author) || delivery?.current() !== true) {
          change(author, "revoked");
          continue;
        }
        if (!valid.ok) {
          change(author, "rejected");
          continue;
        }
        author.remaining = 0;
        author.note.remaining = 0;
        // 两个库存写均成功才付款完成；后续 accepted 事实／收集失败不重记 false。
        delivery.complete();
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
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      try {
        closeWall(this.world, a);
        for (const author of a.authors.values()) change(author, "expired");
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        // 局部关闭全体未完成作者；一人的通知抛错不能让其他 turn 继续开放，也不覆盖原 cleanup 错。
        let notificationFailed = false, notificationError: unknown;
        for (const delivery of deliveries) {
          try { delivery.close(); }
          catch (error) {
            if (!notificationFailed) { notificationFailed = true; notificationError = error; }
          }
        }
        if (!failed && notificationFailed) throw notificationError;
      }
    }
  }
}
