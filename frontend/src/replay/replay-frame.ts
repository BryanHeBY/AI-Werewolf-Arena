import { readReplayDocument, type ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { text, victoryPointLabel } from "@ai-werewolf-arena/game-text";
import {
  formatReplayTime,
  validateReplayDisplay,
  DEFAULT_REPLAY_TIME_ZONE,
  type ReplayDisplayOptions,
} from "./replay-display";
import { buildPresentationReplay, type PresentationReplay } from "./replay-presentation";
import { buildReplaySnapshot } from "./replay-projection";
import { eventLabel } from "./event-labels";
import { phaseName, roleName, eventStageName } from "./replay-localization";

export const FRAMES_PER_EVENT = 90;
export type ReplayRenderInput = ReplayDisplayOptions & { replay: PresentationReplay };
/** Offline rendering input: no workspace focus, playback state, clock, or host time zone. */
export function createReplayRenderInput(
  replay: ReplayDocument,
  display?: ReplayDisplayOptions,
): ReplayRenderInput {
  const canonical = readReplayDocument(replay);
  const options = display ?? {
    locale: canonical.meta.locale ?? "zh-CN",
    timeZone: DEFAULT_REPLAY_TIME_ZONE,
  };
  validateReplayDisplay(options);
  return {
    replay: buildPresentationReplay(canonical),
    locale: options.locale,
    timeZone: options.timeZone,
  };
}
export function buildReplayFrame(input: ReplayRenderInput, frame: number) {
  validateReplayDisplay(input);
  if (!Number.isSafeInteger(frame) || frame < 0) throw new Error("replay_frame_invalid");
  const { replay, locale } = input;
  const eventIndex = Math.min(Math.floor(frame / FRAMES_PER_EVENT), replay.events.length - 1);
  const snapshot = buildReplaySnapshot(replay, eventIndex);
  const event = snapshot.event;
  return {
    eventIndex,
    eventSeq: event?.seq ?? null,
    snapshot,
    dayPhase: text(locale, "replay.day_phase", {
      day: snapshot.day,
      phase: phaseName(snapshot.phase, locale),
    }),
    stage: event
      ? eventStageName(
          event,
          locale,
          replay.players.map((player) => player.player_id),
        )
      : text(locale, "replay.start"),
    label: event
      ? eventLabel(
          event,
          locale,
          replay.players.map((player) => player.player_id),
        )
      : text(locale, "replay.no_events"),
    time: formatReplayTime(event?.timestamp, input),
    victory: snapshot.decision ? victoryPointLabel(snapshot.decision.decidedAt, locale) : null,
    winnerLabel: text(locale, "victory.winner_badge"),
    players: snapshot.players.map((player) => ({
      ...player,
      roleLabel: roleName(
        player.role === "unknown" && player.publicRole ? player.publicRole : player.role,
        locale,
      ),
      sheriffLabel: player.isSheriff ? text(locale, "replay.sheriff") : "",
    })),
  };
}
