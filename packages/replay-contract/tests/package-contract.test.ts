/**
 * Package unit / compatibility contract: read the existing localized God/player
 * fixtures through the public archive reader and compare literal normalized
 * identifiers. Preserve raw user/model payloads and reject unknown versions,
 * invalid sequence/shape and non-data descriptors without invoking accessors.
 * Files are public package fixtures; no backend resolver supplies expected data.
 */
import { describe, expect, test } from "bun:test";
import {
  REPLAY_SCHEMA_VERSION,
  ReplayDocumentValidationError,
  assertReplayDocument,
  assertReplayPlayerView,
  readErrorDiagnostic,
  readReplayDocument,
  readReplayPlayerView,
} from "@ai-werewolf-arena/replay-contract";
import legacyGod from "../fixtures/synthetic/legacy-localized/locale-unrecorded/god.replay.json";
import legacyPlayer from "../fixtures/board-unrecorded/legacy-player-view/locale-unrecorded/players/1-.player.json";

describe("replay public package contract", () => {
  test("legacy God metadata converts while archived user text and unknown facts remain raw", () => {
    const original = structuredClone(legacyGod);
    const replay = readReplayDocument(legacyGod);
    expect(REPLAY_SCHEMA_VERSION).toBe(2);
    expect(replay.schemaVersion).toBe(2);
    expect(replay.result).toEqual({ winner: "good", reason: "all_wolves_eliminated" });
    expect(replay.players[0]).toMatchObject({ role: "wolf", camp: "wolf" });
    expect(replay.players[1]).toMatchObject({ role: "old_role", camp: "旧阵营", name: "古风小生" });
    expect(replay.events[0]).toMatchObject({ phase: "night", stage: "wolf_discussion" });
    expect(replay.events[1]!.payload).toEqual(original.events[1]!.payload);
    expect(replay.events[2]!.payload).toEqual(original.events[2]!.payload);
    expect(legacyGod).toEqual(original);
    expect(readReplayDocument(replay)).toEqual(replay);
    expect(() => assertReplayDocument(replay)).not.toThrow();
  });

  test("legacy player metadata normalizes without modifying prompt, tool and private source text", () => {
    const original = structuredClone(legacyPlayer);
    const player = readReplayPlayerView(legacyPlayer);
    expect(player).toMatchObject({ schemaVersion: 2, role: "wolf", camp: "wolf" });
    expect(player.initial_prompt).toMatchObject({ phase: "night", stage: "wolf_discussion" });
    expect(player.initial_prompt?.prompt_system).toBe(original.initial_prompt.prompt_system);
    expect(player.initial_prompt?.board_info).toBe(original.initial_prompt.board_info);
    expect(player.initial_prompt?.prompt_user).toEqual(original.initial_prompt.prompt_user);
    expect(player.timeline[0]).toMatchObject({
      phase: "night",
      stage: "wolf_discussion",
      source_event_seq: 9,
    });
    expect(player.timeline[0]!.kind === "event" && player.timeline[0].event.payload).toEqual(
      original.timeline[0]!.event!.payload,
    );
    expect<unknown>(
      player.timeline[1]!.kind === "turn" && player.timeline[1].delta_messages,
    ).toEqual(original.timeline[1]!.delta_messages);
    expect(legacyPlayer).toEqual(original);
    expect(() => assertReplayPlayerView(player)).not.toThrow();
    expect(readReplayPlayerView(player)).toEqual(player);
  });

  test("version negotiation rejects undeclared archives before compatibility interpretation", () => {
    for (const schemaVersion of [0, 3, "2", null]) {
      for (const read of [
        () => readReplayDocument({ ...legacyGod, schemaVersion }),
        () => readReplayPlayerView({ ...legacyPlayer, schemaVersion }),
      ]) {
        try {
          read();
          throw new Error("undeclared_archive_version_accepted");
        } catch (error) {
          expect(error).toBeInstanceOf(ReplayDocumentValidationError);
          expect((error as ReplayDocumentValidationError).kind).toBe("unsupported_version");
        }
      }
    }
    expect(() => assertReplayDocument(legacyGod)).toThrow("schemaVersion");
    expect(() => assertReplayPlayerView(legacyPlayer)).toThrow("player.schemaVersion");
  });

  test("canonical envelopes reject malformed tails and accessors without a partial archive", () => {
    const replay = readReplayDocument(legacyGod);
    expect(() =>
      readReplayDocument({
        ...replay,
        events: [...replay.events, { ...replay.events[0], seq: 99 }],
      }),
    ).toThrow(ReplayDocumentValidationError);
    expect(() =>
      readReplayDocument({ ...replay, events: [{ ...replay.events[0], payload: [] }] }),
    ).toThrow(ReplayDocumentValidationError);
    let getterCalls = 0;
    const getterPayload = Object.defineProperty({}, "raw", {
      enumerable: true,
      get() {
        getterCalls++;
        return "unexpected side effect";
      },
    });
    expect(() =>
      readReplayDocument({ ...replay, events: [{ ...replay.events[0], payload: getterPayload }] }),
    ).toThrow(ReplayDocumentValidationError);
    expect(getterCalls).toBe(0);
  });

  test("diagnostic whitelists copy stable fields and reject raw provider errors", () => {
    const raw = {
      code: "rate_limited",
      statusCode: 429,
      retryable: true,
      retryAfterMs: 1200,
    } as const;
    const diagnostic = readErrorDiagnostic(raw);
    expect(diagnostic).toEqual(raw);
    expect(diagnostic).not.toBe(raw);
    expect(() => readErrorDiagnostic({ ...raw, message: "raw provider error" })).toThrow(
      ReplayDocumentValidationError,
    );
    expect(() => readErrorDiagnostic({ ...raw, statusCode: 600 })).toThrow(
      ReplayDocumentValidationError,
    );
  });
});
