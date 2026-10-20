/**
 * 负责当前已出局状态的双语斜向印章。输入为主题、文字和尺寸，输出不遮整张卡片的金属章或简约状态条。
 * 本组件不判断死亡；宿主只在当前投影 alive=false 时挂载，胜者与警徽仍独立。
 */
import type { ThemeId } from "../themes";
import { eliminatedPlate } from "../themes/gothic/identity-assets";
import { plainIdentityImage, type IdentityImageRenderer } from "./IdentityAvatar";
export function EliminatedStamp({
  label,
  width,
  themeId = "minimal-v1",
  renderImage = plainIdentityImage,
  mirrored = false,
}: {
  label: string;
  width: number;
  themeId?: ThemeId;
  renderImage?: IdentityImageRenderer;
  mirrored?: boolean;
}) {
  const height = width * 0.3;
  return (
    <span
      data-eliminated-stamp={themeId}
      data-eliminated-side={mirrored ? "right" : "left"}
      style={{
        position: "absolute",
        width,
        maxWidth: "90%",
        aspectRatio: "10 / 3",
        containerType: "inline-size",
        left: "50%",
        top: "44%",
        // 只镜像倾斜方向，字形保持正向；高端远离两侧卡片各自外缘的座号。
        transform: `translate(-50%,-50%) rotate(${mirrored ? 12 : -12}deg)`,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      {themeId === "gothic-v1" ? (
        renderImage({
          src: eliminatedPlate,
          width,
          height,
          style: {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
          },
        })
      ) : (
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: "#e2e5e9",
            border: "2px solid #737a85",
          }}
        />
      )}
      <strong
        style={{
          position: "relative",
          color: themeId === "gothic-v1" ? "#182027" : "#313b49",
          textShadow: themeId === "gothic-v1" ? "0 1px 0 #edf1e988" : undefined,
          fontSize: "clamp(10px, 14.4cqw, 26px)",
          lineHeight: 1.1,
          letterSpacing: ".06em",
          fontWeight: 800,
        }}
      >
        {label}
      </strong>
    </span>
  );
}
