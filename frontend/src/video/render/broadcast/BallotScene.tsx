/**
 * 负责票型场景的明细、加权票、额外票和结算文字。输入为编译票型、当前局部帧与字幕，输出原有图表DOM及揭晓边界。
 * 票数只读既有tally和adjustments，不由箭头、角色或表决明细重新计算规则。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { SceneText } from "./SceneText";
import { quiet, alpha, localSurface } from "./style";
import type { SceneRenderProps } from "./contracts";
import { playerLabels } from "./PlayerVisual";
import type { ResolvedPlayerPresentation } from "../../../presentation";

export function BallotScene({
  scene,
  caption,
  localFrame,
  metrics,
  appearance,
  locale,
  players,
}: SceneRenderProps & { players: readonly ResolvedPlayerPresentation[] }) {
  const { scale, padding, bodySize, lineHeight } = metrics;
  const { theme, surface, gothic, palette } = appearance;
  const tokens = theme.definition,
    t = tokens.typography,
    readingInk = surface.readingText,
    mutedInk = surface.readingMuted;
  const { profile, label, seatLabel } = playerLabels(players, locale);
  const revealed = localFrame >= scene.cues.impact;

  const data = scene.ballot;
  if (!data || !revealed)
    return (
      <div
        data-scene-ballot-pending
        style={{
          ...localSurface(appearance, scale),
          position: "absolute",
          bottom: "20%",
          left: "12%",
          right: "12%",
          padding,
          fontSize: bodySize,
        }}
      >
        {text(locale, data ? "video.waiting" : "video.no_ballots")}
      </div>
    );
  const targets = [
    ...new Set([
      ...Object.keys(data.tally ?? {}).map(Number),
      ...data.votes.flatMap((vote) => (vote.targetId === null ? [] : [vote.targetId])),
      ...(data.targetId === null ? [] : [data.targetId]),
    ]),
  ];
  const dense = targets.length > 4;
  const total = Math.max(1, ...Object.values(data.tally ?? {}));
  const abstentions = data.votes.filter((vote) => vote.abstain);
  const editorial = scene.bodySource === "script" || scene.emphasis.length > 0;
  const detailsMissing = data.votes.length === 0 && Object.keys(data.tally ?? {}).length === 0;
  return (
    <div
      data-scene-ballot
      data-surface="ballot"
      style={{
        ...localSurface(appearance, scale, surface.ballotOpacity),
        position: "absolute",
        bottom: 24 * scale,
        left: padding,
        right: padding,
        padding,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 16 * scale,
      }}
    >
      {editorial && (
        <div
          data-scene-editorial
          style={{
            ...quiet,
            fontSize: (locale === "en" ? 30 : 32) * scale,
            lineHeight,
            whiteSpace: "pre-wrap",
          }}
        >
          {
            <SceneText
              caption={caption}
              emphasis={scene.emphasis}
              accent={gothic ? "#efb4a8" : palette.wolf}
            />
          }
        </div>
      )}
      {detailsMissing && (
        <div data-ballot-details-unavailable style={{ fontSize: t.aux * scale, color: mutedInk }}>
          {text(locale, "video.ballots_unavailable")}
        </div>
      )}
      {detailsMissing && data.targetId !== null && (
        <div data-ballot-recorded-result style={{ fontSize: t.result * scale }}>
          {text(locale, "video.result")} · {seatLabel(data.targetId)}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: dense ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",
          gap: `${14 * scale}px ${26 * scale}px`,
        }}
      >
        {targets.map((id) => (
          <div
            key={id}
            data-ballot-target={id}
            style={{
              minWidth: 0,
              borderBottom: `${scale}px solid ${alpha(tokens.frame.color, 0.4)}`,
              paddingBottom: 12 * scale,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14 * scale,
                marginBottom: 10 * scale,
              }}
            >
              <strong title={label(id)} style={{ minWidth: 58 * scale, fontSize: 28 * scale }}>
                {seatLabel(id)}
              </strong>
              <strong
                style={{
                  fontSize: (dense ? 30 : 36) * scale,
                  color: id === data.targetId ? (gothic ? "#efb4a8" : palette.accent) : readingInk,
                }}
              >
                {data.tally && Object.hasOwn(data.tally, String(id))
                  ? text(locale, "video.votes", { count: data.tally[String(id)]! })
                  : "—"}
              </strong>
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  gap: 6 * scale,
                  maxWidth: "56%",
                }}
              >
                {data.votes
                  .filter((vote) => vote.targetId === id && !vote.abstain)
                  .map((vote) => (
                    <span
                      key={vote.actorId}
                      style={{
                        fontSize: 24 * scale,
                        border: `${scale}px solid ${tokens.frame.color}`,
                        padding: `${2 * scale}px ${6 * scale}px`,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {profile(vote.actorId)?.seat ?? vote.actorId}
                      {vote.weight !== null && vote.weight !== 1 ? ` ×${vote.weight}` : ""}
                    </span>
                  ))}
              </div>
            </div>
            {data.tally && Object.hasOwn(data.tally, String(id)) && (
              <div style={{ height: 5 * scale, background: alpha(tokens.frame.color, 0.25) }}>
                <div
                  style={{
                    height: "100%",
                    width: `${data.tally ? (100 * (data.tally[String(id)] ?? 0)) / total : 0}%`,
                    background: id === data.targetId ? palette.accent : palette.good,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {abstentions.length > 0 && (
        <div style={{ fontSize: t.aux * scale, color: mutedInk }}>
          {text(locale, "video.abstentions")} ·{" "}
          {abstentions.map((vote) => seatLabel(vote.actorId)).join(" / ")}
        </div>
      )}
      {data.adjustments.length > 0 && (
        <div style={{ fontSize: t.aux * scale, color: mutedInk }}>
          {text(locale, "video.extra_votes")} ·{" "}
          {data.adjustments
            .map((item) => `${seatLabel(item.targetId)} +${item.weight}`)
            .join(" / ")}
        </div>
      )}
      {scene.resolution && localFrame >= scene.resolution.revealFrame && (
        <div
          data-scene-resolution
          style={{
            ...quiet,
            borderTop: `${scale}px solid ${tokens.frame.color}`,
            paddingTop: 16 * scale,
            fontSize: t.result * scale,
            color: gothic ? "#efb4a8" : palette.wolf,
            lineHeight: 1.35,
          }}
        >
          {scene.resolution.text}
        </div>
      )}
    </div>
  );
}
