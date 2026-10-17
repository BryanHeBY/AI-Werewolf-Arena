/**
 * 负责广播玩家头像与展示标签的只读适配。输入为已裁剪展示资料、本局素材及宿主基准，输出原生徽记或已准备头像。
 * 不从角色、昵称推模型，也不读取原归档；缺少素材沿用中性头像回退。
 */
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
import { AvatarMark } from "../../../presentation/AvatarMark";
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
}: {
  player: ResolvedPlayerPresentation | undefined;
  size: number;
  media: VideoPlan["media"];
  mediaBaseUrl?: string;
}) {
  if (!player) return null;
  if (player.avatar.kind === "asset") {
    const id = player.avatar.assetId;
    const asset = media.find((item) => item.id === id && item.kind === "image");
    if (asset)
      return (
        <VideoImage
          src={resolveVideoMediaSource(asset.src, mediaBaseUrl)}
          width={size}
          height={size}
          style={{ objectFit: "contain" }}
        />
      );
  }
  return <AvatarMark avatar={player.avatar} size={size} />;
}
