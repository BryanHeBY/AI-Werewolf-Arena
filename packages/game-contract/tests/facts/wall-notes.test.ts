/**
 * Package unit contract for Wall Note Unicode, ordered public records and item DTO.
 * Literal text/scalars independently verify160 codepoints, surrogate validity,
 * original row ranks and resource-description fields. No anonymous item is
 * granted or paid; these readers never publish, shuffle, translate or render it.
 */
import { expect, test } from "bun:test";
import {
  WALL_EVENT_TYPES,
  validWallText,
  readWallTool,
  readWallEventFact,
  readWallNoteData,
} from "@ai-werewolf-arena/game-contract/facts/wall-notes";
test("Unicode count and raw whitespace retain original literal limits", () => {
  expect(WALL_EVENT_TYPES).toHaveLength(5);
  expect(validWallText("😀".repeat(160))).toBe(true);
  expect(validWallText("😀".repeat(161))).toBe(false);
  expect(validWallText("\ud800")).toBe(false);
  expect(validWallText("\udc00")).toBe(false);
  expect(validWallText("  ")).toBe(false);
  const value = { name: "write_note", args: { text: "  原话 {role}  " } };
  expect<unknown>(readWallTool(value)).toEqual(value);
  expect(Object.getPrototypeOf(readWallTool(value))).toBe(Object.prototype);
});
test("ordered author/rank and operation data do not manufacture item rights", () => {
  const base = { day: 1, eventId: "awa_wall_notes_v1" },
    rows = [{ actorId: 2, instanceId: "wall:1:2", text: "original", rank: 0 }];
  expect<unknown>(readWallEventFact("wall_note_order_recorded", { ...base, rows })).toEqual({
    ...base,
    rows,
  });
  expect(
    readWallEventFact("wall_note_order_recorded", { ...base, rows: [{ ...rows[0], rank: 1 }] }),
  ).toBeNull();
  const change = {
    ...base,
    actorId: 2,
    itemId: "anonymous_note",
    instanceId: "wall:1:2",
    operation: "accepted",
    remaining: 0,
    expired: false,
    text: "original",
  };
  expect<unknown>(readWallEventFact("wall_note_changed", change)).toEqual(change);
  expect(readWallEventFact("wall_note_changed", { ...change, remaining: 1 })).toBeNull();
});
test("snapshot source stays exact and copier rejects accessor values", () => {
  const value = {
    instanceId: "wall:1:2",
    source: { kind: "wall_event", eventId: "awa_wall_notes_v1", day: 1 },
    remaining: 1,
    expired: false,
  };
  expect<unknown>(readWallNoteData(value)).toEqual(value);
  expect(readWallNoteData({ ...value, source: { ...value.source, day: 2 } })).toBeNull();
  let reads = 0;
  expect(
    readWallTool({
      name: "write_note",
      args: {
        get text() {
          reads++;
          return "data";
        },
      },
    }),
  ).toBeNull();
  expect(reads).toBe(0);
});
