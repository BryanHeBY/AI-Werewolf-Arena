/**
 * 负责哥特英雄道具的素材组合。输入为已选择道具、typed意图和通用层求值的揭晓标记，输出无额外外框的原有图形。
 * 本层不持有帧号或事实时钟，不推进揭晓、补生命结果或修改场景。
 */
import { GothicSkillArt } from "../../video/GothicArt";
import type { VideoVisualIntent } from "../../video/types";
import { VideoImage } from "../../video/VideoImage";
import type { VictoryArtId } from "./scene-art";
import type { sceneArt } from "./scene-art";

type SceneArt = ReturnType<typeof sceneArt>;
const victoryArt: Record<VictoryArtId, string> = {
  "victory-good": new URL("../../video/assets/gothic/victory-good-v1.png", import.meta.url).href,
  "victory-wolf": new URL("../../video/assets/gothic/victory-wolf-v1.png", import.meta.url).href,
  "victory-third-party": new URL(
    "../../video/assets/gothic/victory-third-party-v1.png",
    import.meta.url,
  ).href,
  "victory-individual": new URL(
    "../../video/assets/gothic/victory-individual-v1.png",
    import.meta.url,
  ).href,
  "victory-relationship": new URL(
    "../../video/assets/gothic/victory-relationship-v1.png",
    import.meta.url,
  ).href,
  "victory-no-winner": new URL(
    "../../video/assets/gothic/victory-no-winner-v1.png",
    import.meta.url,
  ).href,
};
function isVictoryArt(art: SceneArt): art is VictoryArtId {
  return Object.hasOwn(victoryArt, art);
}

export function GothicHeroArt({
  art,
  intent,
  size,
  revealed,
}: {
  art: Exclude<SceneArt, "record">;
  intent: VideoVisualIntent | undefined;
  size: number;
  revealed: boolean;
}) {
  return (
    <>
      {isVictoryArt(art) ? (
        <VideoImage
          src={victoryArt[art]}
          style={{ width: size, height: size, objectFit: "contain" }}
        />
      ) : revealed && intent?.protection?.interaction === "guard_heal_cancelled" ? (
        <div data-protection-pair style={{ display: "flex", alignItems: "center", height: "100%" }}>
          <GothicSkillArt kind="iron-ward" size={size * 0.67} />
          <div style={{ marginLeft: -size * 0.28 }}>
            <GothicSkillArt kind="heal" size={size * 0.61} />
          </div>
        </div>
      ) : art === "potion-pair" ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <GothicSkillArt kind="heal" size={size * 0.62} />
          <div style={{ marginLeft: -size * 0.23 }}>
            <GothicSkillArt kind="poison" size={size * 0.62} />
          </div>
        </div>
      ) : (
        <GothicSkillArt kind={art} size={size} />
      )}
    </>
  );
}
