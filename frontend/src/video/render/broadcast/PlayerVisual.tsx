/**
 * 负责广播玩家头像与展示标签的只读适配。输入为已裁剪展示资料、本局素材及宿主基准，输出原生徽记或已准备头像。
 * 不从角色、昵称推模型，也不读取原归档；缺少素材沿用中性头像回退。
 */
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { IdentityAvatar } from "../../../presentation/IdentityAvatar";
import type { ThemeId } from "../../../themes";
import type { ResolvedPlayerPresentation } from "../../../presentation";
import { resolveVideoMediaSource } from "../../frame";
import type { VideoPlan } from "../../types";
import { VideoImage } from "../../VideoImage";

export function playerLabels(
  players: readonly ResolvedPlayerPresentation[],
  locale: VideoPlan["display"]["locale"],
) {
  const profile = (id: number) => players.find((player) => player.playerId === id);
  return {
    profile,
    label: (id: number) =>
      playerLabel({ id, seat: profile(id)?.seat ?? id, name: profile(id)?.displayName }, locale),
    seatLabel: (id: number) => playerLabel({ id, seat: profile(id)?.seat ?? id }, locale),
  };
}

export function PlayerAvatar({
  player,
  size,
  media,
  mediaBaseUrl,
  visibleRole,
  themeId,
}: {
  player: ResolvedPlayerPresentation | undefined;
  size: number;
  media: VideoPlan["media"];
  mediaBaseUrl?: string;
  visibleRole?: string;
  themeId?: ThemeId;
}) {
  const avatar = player?.avatar ?? { kind: "auto" as const };
  let assetSource: string | undefined;
  if (avatar.kind === "asset") {
    const id = avatar.assetId;
    const asset = media.find((item) => item.id === id && item.kind === "image");
    if (asset) assetSource = resolveVideoMediaSource(asset.src, mediaBaseUrl);
  }
  return (
    <IdentityAvatar
      avatar={avatar}
      size={size}
      visibleRole={visibleRole}
      themeId={themeId}
      assetSource={assetSource}
      renderImage={(props) => <VideoImage {...props} />}
    />
  );
}
