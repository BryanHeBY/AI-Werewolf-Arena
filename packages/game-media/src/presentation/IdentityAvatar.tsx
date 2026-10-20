/**
 * 负责网页与视频共用的安全头像优先级和主题身份章。输入为已裁剪头像、当前可见角色和已准备图片 URL，输出纯 React 视觉。
 * 自动头像不读原归档或模型；显式中性／隐藏／LLM 优先，旧计划中性头像不会升级。图片解码由宿主注入。
 */
import type { CSSProperties, ReactNode } from "react";
import type { ThemeId } from "../themes";
import { identityMedallion } from "../themes/gothic/identity-assets";
import { AvatarMark } from "./AvatarMark";
import { RoleCrest, RoleGlyph } from "./RoleCrest";
import { getRoleCrest } from "./role-crests";
import type { PlayerAvatar } from "./index";

export interface IdentityImageProps {
  src: string;
  width: number;
  height: number;
  style: CSSProperties;
}
export type IdentityImageRenderer = (props: IdentityImageProps) => ReactNode;
export const plainIdentityImage: IdentityImageRenderer = (props) => <img {...props} alt="" />;

export function IdentityAvatar({
  avatar,
  size = 32,
  visibleRole = "unknown",
  themeId = "minimal-v1",
  assetSource,
  renderImage = plainIdentityImage,
}: {
  avatar: PlayerAvatar;
  size?: number;
  visibleRole?: string;
  themeId?: ThemeId;
  assetSource?: string;
  renderImage?: IdentityImageRenderer;
}) {
  if (avatar.kind === "none") return null;
  if (avatar.kind !== "auto") {
    if (avatar.kind === "asset" && assetSource)
      return renderImage({
        src: assetSource,
        width: size,
        height: size,
        style: { objectFit: "contain", flexShrink: 0 },
      });
    return <AvatarMark avatar={avatar} size={size} />;
  }
  const role = getRoleCrest(visibleRole) ? visibleRole : "unknown";
  if (themeId !== "gothic-v1")
    return (
      <span
        data-avatar-auto={role}
        style={{ width: size, height: size, display: "grid", placeItems: "center", flexShrink: 0 }}
      >
        {role === "unknown" ? (
          <span aria-hidden="true" style={{ fontSize: size * 0.62 }}>
            ?
          </span>
        ) : (
          <RoleCrest role={role} size={size * 0.82} />
        )}
      </span>
    );
  return (
    <span
      data-avatar-auto={role}
      data-identity-material="gothic-v1"
      style={{
        position: "relative",
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {renderImage({
        src: identityMedallion,
        width: size,
        height: size,
        style: { position: "absolute", inset: 0, objectFit: "contain" },
      })}
      {role !== "unknown" && (
        <svg
          aria-hidden="true"
          data-identity-role={role}
          width={size * 0.58}
          height={size * 0.58}
          viewBox="0 0 24 24"
          style={{
            position: "relative",
            color: "#d4c5a1",
            filter: "drop-shadow(0 1px 1px #04080c)",
            opacity: 0.94,
          }}
        >
          <RoleGlyph role={role} />
        </svg>
      )}
    </span>
  );
}
