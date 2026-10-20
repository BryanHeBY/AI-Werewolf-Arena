/**
 * 负责票型、作者全文与独立结果的有限阅读槽。输入为编译票型、统一阅读时钟及当前帧，输出完整票表和原揭晓边界。
 * 作者说明、票表、结果各限高而不删字；票数只读tally/adjustments，不重新计票或借滚动提前宣布结果。
 */
import { actionAppearance } from "../../../themes";
import { text } from "@ai-werewolf-arena/game-text";
import { SceneText } from "./SceneText";
import { ReadingViewport } from "./ReadingViewport";
import { videoReadingProgress } from "../../captions";
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
  const { scale, stage, padding, bodySize, lineHeight } = metrics;
  const { theme, surface, gothic } = appearance;
  const actionSkin = actionAppearance(theme, gothic || appearance.night ? "night" : "day", scene);
  const ballotAccent = actionSkin.ink;
  const tokens = theme.definition,
    t = tokens.typography,
    readingInk = surface.readingText,
    mutedInk = surface.readingMuted;
  const { profile, label, seatLabel } = playerLabels(players, locale);
  const revealed = localFrame >= scene.cues.impact;

  // 直接使用本组件的消费者也遵循独立结果帧；未到正式计票游标不能借用后续tally。
  const data =
    scene.resolution?.ballot && localFrame >= scene.resolution.revealFrame
      ? scene.resolution.ballot
      : scene.ballot;
  if (!revealed) return null;
  if (!data)
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
        {text(locale, "video.no_ballots")}
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
  const editorial = scene.bodyLayout === "text" || scene.emphasis.length > 0;
  const detailsMissing = data.votes.length === 0 && Object.keys(data.tally ?? {}).length === 0;
  const flow = Boolean(caption.reading);
  const available = stage.height - 150 * scale - 24 * scale;
  const editorialMax = Math.min(220 * scale, available * 0.28);
  // 揭晓前后保同一个两行安全槽，长名字沿自己的时钟滚动；不为一行结果预留整块140px空白。
  const resolutionMax = Math.min(bodySize * lineHeight * 2 + 16 * scale, available * 0.2);
  const chartMax = Math.max(
    100 * scale,
    available -
      padding * 2 -
      // 作者短文只占实际高度；其上限不是预留空白，剩余空间由票表flex使用。
      (editorial ? 16 * scale : 0) -
      (scene.resolution ? resolutionMax + 16 * scale : 0),
  );
  const compact = flow && (editorial || Boolean(scene.resolution));
  return (
    <div
      data-scene-ballot={flow ? undefined : true}
      data-surface="ballot"
      data-action-color-key={actionSkin.key}
      style={{
        ...localSurface(appearance, scale, surface.ballotOpacity),
        position: "absolute",
        // 全文模式在标题／页脚安全区内居中；短票表不再固定贴底留下大片空白。
        top: flow ? (stage.height + (150 - 24) * scale) / 2 : undefined,
        bottom: flow ? undefined : 24 * scale,
        transform: flow ? "translateY(-50%)" : undefined,
        left: padding,
        right: padding,
        padding,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 16 * scale,
        maxHeight: flow ? available : undefined,
        overflow: flow ? "hidden" : undefined,
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
            minHeight: 0,
            flexShrink: 0,
          }}
        >
          {flow ? (
            <ReadingViewport
              caption={caption}
              emphasis={scene.emphasis}
              accent={ballotAccent}
              kind="announcement"
              fontSize={bodySize}
              lineHeight={lineHeight}
              maxHeight={editorialMax}
            />
          ) : (
            <SceneText caption={caption} emphasis={scene.emphasis} accent={ballotAccent} />
          )}
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
      <ReadingViewport
        caption={caption}
        emphasis={[]}
        accent={ballotAccent}
        kind={flow ? "ballot" : undefined}
        fontSize={t.aux * scale}
        lineHeight={1.3}
        maxHeight={flow ? chartMax : undefined}
      >
        <div data-ballot-chart style={{ display: "grid", gap: 12 * scale }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: dense ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",
              gap: `${(compact ? 8 : 14) * scale}px ${26 * scale}px`,
            }}
          >
            {targets.map((id) => (
              <div
                key={id}
                data-ballot-target={id}
                style={{
                  minWidth: 0,
                  borderBottom: `${scale}px solid ${alpha(tokens.frame.color, 0.4)}`,
                  paddingBottom: (compact ? 4 : 12) * scale,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14 * scale,
                    marginBottom: (compact ? 6 : 10) * scale,
                  }}
                >
                  <strong
                    title={label(id)}
                    style={{ minWidth: 58 * scale, fontSize: (compact ? 24 : 28) * scale }}
                  >
                    {seatLabel(id)}
                  </strong>
                  {data.tally && Object.hasOwn(data.tally, String(id)) && (
                    <strong
                      data-ballot-count={id}
                      style={{
                        fontSize: (compact ? 26 : dense ? 30 : 36) * scale,
                        color: id === data.targetId ? ballotAccent : readingInk,
                      }}
                    >
                      {text(locale, "video.votes", { count: data.tally[String(id)]! })}
                    </strong>
                  )}
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
                            fontSize: (compact ? 22 : 24) * scale,
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
                        background: id === data.targetId ? ballotAccent : alpha(ballotAccent, 0.7),
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
        </div>
      </ReadingViewport>
      {scene.resolution && (flow || localFrame >= scene.resolution.revealFrame) && (
        <div
          data-resolution-slot
          data-scene-resolution={
            !flow && localFrame >= scene.resolution.revealFrame ? true : undefined
          }
          style={{
            ...quiet,
            borderTop: `${scale}px solid ${tokens.frame.color}`,
            paddingTop: 16 * scale,
            fontSize: t.result * scale,
            color: ballotAccent,
            lineHeight: 1.35,
            flexShrink: 0,
            minHeight: 0,
            height: flow ? resolutionMax : undefined,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {localFrame >= scene.resolution.revealFrame &&
            (flow ? (
              <ReadingViewport
                caption={{
                  text: scene.resolution.text,
                  offset: 0,
                  pageIndex: 0,
                  pages: [scene.resolution.text],
                  scheduled: false,
                  protectedTerms: caption.protectedTerms,
                  reading: scene.resolution.reading
                    ? videoReadingProgress(scene.resolution.reading, localFrame)
                    : undefined,
                }}
                emphasis={[]}
                accent={ballotAccent}
                kind="resolution"
                fontSize={bodySize}
                lineHeight={lineHeight}
                maxHeight={resolutionMax - 16 * scale}
              />
            ) : (
              scene.resolution.text
            ))}
        </div>
      )}
    </div>
  );
}
