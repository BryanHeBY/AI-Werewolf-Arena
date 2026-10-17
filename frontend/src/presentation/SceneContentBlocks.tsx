/**
 * 负责网页与视频共用的结构化字段排版。输入为纯内容块、语言及已裁剪名字，输出无独立时钟的语义DOM。
 * 调用方必须在事实揭晓后挂载；本组件不从原话拆字段、不计算票数、药效、身份或胜者，保留未知值。
 */
import {
  createPlayerText,
  playerLabel,
  victoryClaimLabel,
} from "@ai-werewolf-arena/game-presentation";
import { text, term, roleName, type Locale } from "@ai-werewolf-arena/game-text";
import type { NamedPlayer } from "@ai-werewolf-arena/game-presentation";
import type { SceneContent, SceneContentBlock } from "./scene-content";
import { Fragment } from "react";
import type { VideoVisualReport } from "../video/types";
/** 短字段是完整词组；长未知标识只保正常词界，玩家长名字单独允许换行，不做意图识别。 */
function ContentToken({ value }: { value: string }) {
  return (
    <span
      data-content-token
      style={{
        whiteSpace: value.length <= 16 ? "nowrap" : "normal",
        overflowWrap: value.length > 80 ? "anywhere" : "normal",
        wordBreak: "normal",
      }}
    >
      {value}
    </span>
  );
}
function reportLabel(report: VideoVisualReport, locale: Locale): string {
  switch (report.kind) {
    case "camp":
      return term("camp", report.camp, locale);
    case "role":
      return roleName(report.roleId, locale);
    case "combined":
      return text(locale, "inspection.combined", {
        role: roleName(report.roleId, locale),
        camp: term("camp", report.camp, locale),
      });
    case "pair":
      return text(
        locale,
        report.containsWerewolf ? "fragrant.result.true" : "fragrant.result.false",
      );
    case "range":
      return text(locale, report.signal === "roar" ? "bear.roar" : "bear.quiet");
    case "unknown":
      return text(locale, "video.process_unknown");
  }
}
export function SceneContentBlocks({
  content,
  locale,
  players = [],
  kinds,
}: {
  content: SceneContent;
  locale: Locale;
  players?: readonly NamedPlayer[];
  kinds?: readonly SceneContentBlock["kind"][];
}) {
  const label = (id: number) =>
    playerLabel(players.find((player) => player.id === id) ?? { id }, locale);
  const playerToken = (id: number) => {
    const player = players.find((candidate) => candidate.id === id);
    return (
      <span data-content-player={id}>
        <ContentToken
          value={playerLabel(
            { id, ...(player?.seat === undefined ? {} : { seat: player.seat }) },
            locale,
          )}
        />
        {player?.name && (
          <span style={{ overflowWrap: "anywhere", wordBreak: "normal" }}> · {player.name}</span>
        )}
      </span>
    );
  };
  const labels = (ids: number[]) =>
    ids.length ? (
      ids.map((id, index) => (
        <Fragment key={`${id}:${index}`}>
          {index > 0 ? " / " : ""}
          {playerToken(id)}
        </Fragment>
      ))
    ) : (
      <ContentToken value={text(locale, "video.no_target")} />
    );
  const playerText = createPlayerText(players);
  return (
    <div
      data-scene-content={content.version}
      style={{ display: "grid", gap: ".5em", fontSize: "inherit", overflowWrap: "normal" }}
    >
      {content.blocks
        .filter((block) => !kinds || kinds.includes(block.kind))
        .map((block, index) => {
          switch (block.kind) {
            case "inventory":
              return (
                <div
                  key={index}
                  data-content-block="inventory"
                  data-stock-status={block.state.status}
                  data-stock-actor={block.state.actorId}
                  data-stock-ability={block.state.abilityId}
                  data-stock-fact={
                    block.state.status === "known" ? block.state.sourceFactSeq : undefined
                  }
                >
                  <strong>{playerToken(block.state.actorId)}</strong> ·{" "}
                  {block.state.status === "known" ? (
                    <ContentToken
                      value={text(locale, "video.inventory", {
                        heal: block.state.heal,
                        poison: block.state.poison,
                      })}
                    />
                  ) : (
                    <ContentToken value={text(locale, "video.inventory_unknown")} />
                  )}
                </div>
              );
            case "report":
              return (
                <dl
                  key={index}
                  data-content-block="report"
                  data-report-kind={block.report.kind}
                  style={{ margin: 0 }}
                >
                  <dt>
                    {text(locale, "video.report")} · {labels(block.targetIds)}
                  </dt>
                  <dd style={{ margin: 0 }}>
                    {<ContentToken value={reportLabel(block.report, locale)} />}
                  </dd>
                  {block.recipientIds.length > 0 && (
                    <dd style={{ margin: 0 }}>
                      {text(locale, "video.recipient")} · {labels(block.recipientIds)}
                    </dd>
                  )}
                </dl>
              );
            case "ballot":
              return (
                <div
                  key={index}
                  data-content-block="ballot"
                  data-ballot-kind={block.ballot.kind}
                  data-ballot-round={block.ballot.round}
                >
                  <strong>{text(locale, "video.ballot_summary_body")}</strong>
                  {block.ballot.tally &&
                    Object.entries(block.ballot.tally).map(([id, count]) => (
                      <div key={id} data-tally-target={id}>
                        {playerToken(Number(id))} · {count}
                      </div>
                    ))}
                  {block.ballot.votes.map((vote, row) => (
                    <div key={row} data-ballot-actor={vote.actorId}>
                      {playerToken(vote.actorId)} →{" "}
                      {vote.targetId === null
                        ? text(locale, "replay.vote_abstain", { actor: label(vote.actorId) })
                        : playerToken(vote.targetId)}{" "}
                      · {vote.weight ?? "—"}
                    </div>
                  ))}
                  {!block.ballot.votes.length && !block.ballot.tally && (
                    <div>{text(locale, "video.ballots_unavailable")}</div>
                  )}
                  {block.ballot.targetId !== null && (
                    <div data-ballot-result={block.ballot.targetId}>
                      {text(locale, "video.committed")} · {playerToken(block.ballot.targetId)}
                    </div>
                  )}
                  {block.ballot.adjustments.map((adjustment, row) => (
                    <div key={`extra:${row}`} data-ballot-extra-source={adjustment.sourceSeq}>
                      {text(locale, "replay.stage.crow_curse_applied")} ·{" "}
                      {playerToken(adjustment.targetId)} +{adjustment.weight}
                    </div>
                  ))}
                </div>
              );
            case "outcome":
              return (
                <div key={index} data-content-block="outcome">
                  {block.outcome?.kind === "victory" ? (
                    <>
                      <strong data-primary-result>
                        {
                          <ContentToken
                            value={victoryClaimLabel(block.outcome.primary, locale, playerText)}
                          />
                        }
                      </strong>
                      {block.outcome.additional.map((claim, row) => (
                        <div key={row} data-additional-result>
                          {text(locale, "video.additional_result")} ·{" "}
                          {<ContentToken value={victoryClaimLabel(claim, locale, playerText)} />} ·{" "}
                          {labels(claim.winningPlayerIds)}
                        </div>
                      ))}
                    </>
                  ) : block.outcome?.kind === "no_winner" ? (
                    <strong>{text(locale, "replay.no_winner")}</strong>
                  ) : (
                    <strong>
                      {block.winner
                        ? term("camp_team", block.winner, locale)
                        : text(locale, "video.process_unknown")}
                    </strong>
                  )}
                  {block.outcome && (
                    <div>
                      <ContentToken value={text(locale, "victory.winners", { players: "" })} />
                      {block.outcome.kind === "victory" ? (
                        labels(block.outcome.winningPlayerIds)
                      ) : (
                        <ContentToken value={text(locale, "common.none")} />
                      )}
                    </div>
                  )}
                  {block.reason && (
                    <div data-outcome-reason>
                      {
                        <ContentToken
                          value={text(locale, "victory.decision_reason", { reason: "" })}
                        />
                      }
                      <ContentToken value={term("reason", block.reason, locale)} />
                    </div>
                  )}
                </div>
              );
            case "action":
              return (
                <div key={index} data-content-block="action" data-action-process={block.process}>
                  {block.actorId !== undefined && <strong>{playerToken(block.actorId)} · </strong>}
                  {labels(block.requestedTargetIds)}
                  {block.effectiveTargetKnown && (
                    <div data-effective-targets>
                      {text(locale, "video.committed")} · {labels(block.effectiveTargetIds)}
                    </div>
                  )}
                  {block.recipientIds.length > 0 && (
                    <div>
                      {text(locale, "video.recipient")} · {labels(block.recipientIds)}
                    </div>
                  )}
                </div>
              );
            case "dialogue":
              return (
                <div key={index} data-content-block="dialogue">
                  <strong>
                    {block.textSource === "script"
                      ? text(locale, "video.editorial_targets")
                      : playerToken(block.actorId)}
                  </strong>
                  {block.dialogue.kind === "end_chat" && <> · {text(locale, "video.end_chat")}</>}
                  <div style={{ whiteSpace: "pre-wrap" }}>{block.text}</div>
                </div>
              );
            case "record":
              return (
                <div key={index} data-content-block="record" style={{ whiteSpace: "pre-wrap" }}>
                  {block.text}
                </div>
              );
          }
        })}
    </div>
  );
}
