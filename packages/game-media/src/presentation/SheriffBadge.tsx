/**
 * 负责网页和视频共用的警长身份徽记。输入为当前主题、译名与尺寸，输出盾徽、下方小字及无障碍说明。
 * 宿主只在当前投影 isSheriff=true 时挂载；徽记不读取角色、阵营或历史，不推断警徽转移与销毁。
 */
import type { ThemeId } from "../themes";
import { sheriffBadge } from "../themes/gothic/identity-assets";
import { plainIdentityImage, type IdentityImageRenderer } from "./IdentityAvatar";

export function SheriffBadge({
  label,
  size = 32,
  labelSize = 11,
  labelBackground,
  themeId = "minimal-v1",
  renderImage = plainIdentityImage,
}: {
  label: string;
  size?: number;
  labelSize?: number;
  labelBackground?: string;
  themeId?: ThemeId;
  renderImage?: IdentityImageRenderer;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-sheriff-badge={themeId}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: size,
        width: "max-content",
        gap: 2,
        flexShrink: 0,
      }}
    >
      {themeId === "gothic-v1" ? (
        renderImage({
          src: sheriffBadge,
          width: size,
          height: size,
          style: { width: size, height: size, objectFit: "contain" },
        })
      ) : (
        <svg
          aria-hidden="true"
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        >
          <path d="M6 7L16 3L26 7V16C26 22 22 26 16 29C10 26 6 22 6 16Z" />
          <path d="M16 8V23M11 14H21M14 8H18" />
        </svg>
      )}
      <span
        aria-hidden="true"
        data-sheriff-caption
        style={{
          fontSize: labelSize,
          lineHeight: 1.1,
          fontWeight: 600,
          whiteSpace: "nowrap",
          background: labelBackground,
          padding: labelBackground ? "1px 3px" : undefined,
        }}
      >
        {label}
      </span>
    </span>
  );
}
