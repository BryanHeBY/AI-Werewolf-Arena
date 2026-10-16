/**
 * 负责绘制原创代码徽记或调用方明确提供的已准备头像素材。输入为已裁剪头像引用，输出无外部下载的 SVG／图片。
 * 徽记不模仿官方商标，不根据角色、模型名称或发言推断厂商；匿名引用只显示同一中性图形，缺素材也安全降级。
 */
import type { PlayerAvatar, AvatarKey } from "./index";

const marks: Record<AvatarKey, { letter: string; color: string; sides: number }> = {
  neutral: { letter: "", color: "currentColor", sides: 4 },
  openai: { letter: "O", color: "#42857b", sides: 6 },
  anthropic: { letter: "A", color: "#ba7f5d", sides: 3 },
  deepseek: { letter: "D", color: "#497ac2", sides: 5 },
  gemini: { letter: "G", color: "#7b64b4", sides: 4 },
  qwen: { letter: "Q", color: "#8a62ba", sides: 6 },
  doubao: { letter: "豆", color: "#5a8a84", sides: 8 },
  kimi: { letter: "K", color: "#647181", sides: 5 },
  glm: { letter: "G", color: "#5981ad", sides: 3 },
};
export function AvatarMark({
  avatar,
  size = 32,
  assetSource,
  title,
}: {
  avatar: PlayerAvatar;
  size?: number;
  assetSource?: string;
  title?: string;
}) {
  if (avatar.kind === "none") return null;
  if (avatar.kind === "asset" && assetSource)
    return (
      <img
        src={assetSource}
        width={size}
        height={size}
        alt={title ?? ""}
        style={{ objectFit: "contain", flexShrink: 0 }}
      />
    );
  const mark = marks[avatar.kind === "symbol" ? avatar.key : "neutral"];
  const points = Array.from({ length: mark.sides }, (_, index) => {
    const angle = (index * Math.PI * 2) / mark.sides - Math.PI / 2;
    return `${24 + Math.cos(angle) * 21},${24 + Math.sin(angle) * 21}`;
  }).join(" ");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      data-avatar-key={avatar.kind === "symbol" ? avatar.key : "neutral"}
      style={{ flexShrink: 0, color: mark.color }}
    >
      <polygon
        points={points}
        fill="currentColor"
        fillOpacity=".12"
        stroke="currentColor"
        strokeWidth="2"
      />
      {mark.letter ? (
        <text
          x="24"
          y="31"
          textAnchor="middle"
          fill="currentColor"
          fontFamily="ui-sans-serif,system-ui"
          fontSize="21"
          fontWeight="750"
        >
          {mark.letter}
        </text>
      ) : (
        <>
          <path d="M24 13L34 24L24 35L14 24Z" stroke="currentColor" strokeWidth="2" />
          <circle cx="24" cy="24" r="3" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
