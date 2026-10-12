/**
 * Owns pure Wall Note text, event, item snapshot and tool contracts for wire consumers.
 * Inputs are identifiers and proven inert payload data; outputs are detached
 * shapes or null with original keys, limits, defaults and scalar correlations.
 * Text validity preserves the exact Unicode limit and user text; it does not
 * translate/render wording or grant the anonymous-note item capability.
 * For these inputs the reader never changes rules, resources, phases or action
 * authority. Proxy reflection safety belongs to Node ingress before calling;
 * browser consumers must supply inert data rather than arbitrary JS objects.
 */
import { copyEventData } from "../inert-event-data";
export const WALL_EVENT_TYPES = [
  "wall_notes_started",
  "wall_notes_published",
  "wall_notes_canceled",
  "wall_note_changed",
  "wall_note_order_recorded",
] as const;
export function validWallText(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || Array.from(value).length > 160) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = value.charCodeAt(++i);
      if (!(d >= 0xdc00 && d <= 0xdfff)) return false;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
}
export function readWallTool(
  value: unknown,
): { name: "write_note"; args: { text: string } } | null {
  try {
    const c = copyEventData(value) as any;
    return c &&
      Object.keys(c).length === 2 &&
      c.name === "write_note" &&
      c.args &&
      Object.keys(c.args).length === 1 &&
      validWallText(c.args.text)
      ? { name: "write_note", args: { text: c.args.text } }
      : null;
  } catch {
    return null;
  }
}
export function readWallEventFact(type: string, value: unknown): Record<string, any> | null {
  if (!(WALL_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(value) as any;
    const exact = (v: any, names: string[]) =>
      v &&
      !Array.isArray(v) &&
      typeof v === "object" &&
      Object.keys(v).length === names.length &&
      Object.keys(v).every((k) => names.includes(k));
    const id = (n: any) => Number.isSafeInteger(n) && n > 0;
    if (!p || p.day !== 1 || p.eventId !== "awa_wall_notes_v1") return null;
    if (type === "wall_notes_started") return exact(p, ["day", "eventId"]) ? p : null;
    if (type === "wall_notes_canceled")
      return exact(p, ["day", "eventId", "reason"]) && p.reason === "scope_changed" ? p : null;
    if (type === "wall_notes_published")
      return exact(p, ["day", "eventId", "texts"]) &&
        Array.isArray(p.texts) &&
        p.texts.every(validWallText)
        ? p
        : null;
    if (type === "wall_note_order_recorded") {
      if (!exact(p, ["day", "eventId", "rows"]) || !Array.isArray(p.rows)) return null;
      const authors = new Set();
      for (const [rank, row] of p.rows.entries()) {
        if (
          !exact(row, ["actorId", "instanceId", "text", "rank"]) ||
          !id(row.actorId) ||
          authors.has(row.actorId) ||
          row.instanceId !== `wall:1:${row.actorId}` ||
          row.rank !== rank ||
          !validWallText(row.text)
        )
          return null;
        authors.add(row.actorId);
      }
      return p;
    }
    const accepted = p.operation === "accepted";
    if (
      !exact(p, [
        "day",
        "eventId",
        "actorId",
        "itemId",
        "instanceId",
        "operation",
        "remaining",
        "expired",
        ...(accepted ? ["text"] : []),
      ]) ||
      !id(p.actorId) ||
      p.itemId !== "anonymous_note" ||
      p.instanceId !== `wall:1:${p.actorId}` ||
      ![0, 1].includes(p.remaining) ||
      typeof p.expired !== "boolean"
    )
      return null;
    switch (p.operation) {
      case "granted":
        return p.remaining === 1 && !p.expired ? p : null;
      case "accepted":
        return p.remaining === 0 && !p.expired && validWallText(p.text) ? p : null;
      case "rejected":
        return p.remaining === 1 && !p.expired ? p : null;
      case "revoked":
        return !p.expired ? p : null;
      case "expired":
        return p.expired ? p : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function readWallNoteData(value: unknown): {
  instanceId: string;
  source: { kind: "wall_event"; eventId: "awa_wall_notes_v1"; day: 1 };
  remaining: 0 | 1;
  expired: boolean;
} | null {
  try {
    const p = copyEventData(value) as any;
    if (
      !p ||
      Array.isArray(p) ||
      Object.keys(p).length !== 4 ||
      !Object.keys(p).every((k) => ["instanceId", "source", "remaining", "expired"].includes(k)) ||
      typeof p.instanceId !== "string" ||
      !/^wall:1:[1-9][0-9]*$/.test(p.instanceId) ||
      ![0, 1].includes(p.remaining) ||
      typeof p.expired !== "boolean" ||
      !p.source ||
      Array.isArray(p.source) ||
      Object.keys(p.source).length !== 3 ||
      p.source.kind !== "wall_event" ||
      p.source.eventId !== "awa_wall_notes_v1" ||
      p.source.day !== 1
    )
      return null;
    return p;
  } catch {
    return null;
  }
}
