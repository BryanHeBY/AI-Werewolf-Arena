/**
 * 浏览器测试的独立终局预期只读取原归档字段与共享契约标签。输入为game_over、原名单和语言，输出主／附加结果、原因和明确成员。
 * 不读VideoPlan、scene.content或生产React组件，不按阵营补成员；null兼容赢家不等于no_winner，非法typed结果直接拒绝。
 */
import {
  readGameOutcome,
  type ReplayDocument,
  type ReplayEvent,
} from "@ai-werewolf-arena/replay-contract";
import {
  createPlayerText,
  playerLabel,
  victoryClaimLabel,
} from "@ai-werewolf-arena/game-presentation";
import { text, term, type Locale } from "@ai-werewolf-arena/game-text";

export function replayOutcomeExpectation(
  event: ReplayEvent,
  players: ReplayDocument["players"],
  locale: Locale,
) {
  if (event.type !== "game_over") throw new Error("browser_outcome_event_invalid");
  const payload = event.payload;
  const names = players.map((player) => ({
    id: player.player_id,
    ...(player.seat === undefined ? {} : { seat: player.seat }),
    ...(player.name === undefined ? {} : { name: player.name }),
  }));
  const namedText = createPlayerText(names);
  const memberLabel = (id: number) => {
    const player = names.find((candidate) => candidate.id === id);
    const seat = playerLabel(
      { id, ...(player?.seat === undefined ? {} : { seat: player.seat }) },
      locale,
    );
    return player?.name ? `${seat} · ${player.name}` : seat;
  };
  const outcome = Object.hasOwn(payload, "outcome")
    ? readGameOutcome(
        payload.outcome,
        players.map((player) => player.player_id),
      )
    : undefined;
  const primary =
    outcome?.kind === "victory"
      ? victoryClaimLabel(outcome.primary, locale, namedText)
      : outcome?.kind === "no_winner"
        ? text(locale, "replay.no_winner")
        : typeof payload.winner === "string" && payload.winner
          ? term("camp_team", payload.winner, locale)
          : text(locale, "video.process_unknown");
  const additional =
    outcome?.kind === "victory"
      ? outcome.additional.map((claim) => ({
          ids: [...claim.winningPlayerIds],
          text: `${text(locale, "video.additional_result")} · ${victoryClaimLabel(claim, locale, namedText)} · ${claim.winningPlayerIds.length ? claim.winningPlayerIds.map(memberLabel).join(" / ") : text(locale, "video.no_target")}`,
        }))
      : [];
  // null表示归档根本未记录结构化成员；[]则是明确无人获胜，两个分支不能互相替代。
  const winnerIds = outcome
    ? outcome.kind === "victory"
      ? [...outcome.winningPlayerIds]
      : []
    : null;
  return {
    primary,
    hasPrimaryClaim: outcome?.kind === "victory",
    additional,
    winnerIds,
    winnerLabels: winnerIds?.map(memberLabel) ?? null,
    winnersText:
      winnerIds === null
        ? null
        : text(locale, "victory.winners", {
            players: winnerIds.length
              ? winnerIds.map(memberLabel).join(" / ")
              : text(locale, "common.none"),
          }),
    reason:
      typeof payload.reason === "string" && payload.reason
        ? text(locale, "victory.decision_reason", {
            reason: term("reason", payload.reason, locale),
          })
        : null,
  };
}
