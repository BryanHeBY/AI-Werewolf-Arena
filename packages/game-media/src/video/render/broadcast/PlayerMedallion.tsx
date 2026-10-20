/**
 * 负责中央行动的来源与目标小章。输入为明确playerId、尺寸和已裁剪展示资料，输出原有头像及席位标签。
 * 小章不决定谁是行动者或实际落点；该语义由调用场景显式传入。
 */
import type { SceneAppearance } from "./contracts";
import type { VideoPlan } from "../../types";
import type { ResolvedPlayerPresentation } from "../../../presentation";
import { quiet, twoLines, alpha } from "./style";
import { PlayerAvatar, playerLabels } from "./PlayerVisual";
export function PlayerMedallion({
  id,
  accent,
  size,
  compact = false,
  scale,
  appearance,
  locale,
  players,
  media,
  mediaBaseUrl,
}: {
  id: number;
  /** 仅来源章消费当前行动色；目标保留中性边框，避免混淆行动方与作用对象。 */
  accent?: string;
  size: number;
  compact?: boolean;
  scale: number;
  appearance: SceneAppearance;
  locale: VideoPlan["display"]["locale"];
  players: readonly ResolvedPlayerPresentation[];
  media: VideoPlan["media"];
  mediaBaseUrl?: string;
}) {
  const { profile, label, seatLabel } = playerLabels(players, locale);
  const { surface, theme } = appearance;
  const tokens = theme.definition,
    readingInk = surface.readingText;

  return (
    <div
      key={id}
      style={{
        width: size + (compact ? 24 : 42) * scale,
        display: "grid",
        justifyItems: "center",
        gap: 8 * scale,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: alpha(surface.readingColor, 0.85),
          border: `${2 * scale}px solid ${accent ?? tokens.frame.color}`,
        }}
      >
        {
          <PlayerAvatar
            player={profile(id)}
            size={size * 0.72}
            media={media}
            mediaBaseUrl={mediaBaseUrl}
            visibleRole={appearance.visibleRoles?.[id]}
            themeId={theme.id}
          />
        }
      </div>
      <div
        title={label(id)}
        style={{
          ...quiet,
          ...twoLines,
          textAlign: "center",
          fontSize: (compact ? 22 : 26) * scale,
          color: readingInk,
          background: alpha(surface.readingColor, 0.86),
          padding: `${4 * scale}px ${8 * scale}px`,
        }}
      >
        {compact ? seatLabel(id) : label(id)}
      </div>
    </div>
  );
}
