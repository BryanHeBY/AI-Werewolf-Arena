/**
 * 负责绘制独立于玩家 LLM 头像的原创金属蚀刻小纹章。输入仅为调用方已允许展示的角色 ID，输出 24–48px 可缩放 SVG。
 * 本组件不读取玩家原档、阵营或发言；未知角色为中性纹章，文字身份由宿主保留，不能靠小徽记代替可读标签。
 */
import { getRoleCrest } from "./role-crests";

export function RoleCrest({
  role,
  size = 24,
  color = "currentColor",
  title,
}: {
  role: string;
  size?: number;
  color?: string;
  title?: string;
}) {
  const crest = getRoleCrest(role);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      color={color}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      data-role-crest={crest ? role : "neutral"}
      data-crest-family={crest?.family ?? "neutral"}
      style={{ flexShrink: 0 }}
    >
      <path
        d="M3 2H21V14Q19 20 12 23Q5 20 3 14Z"
        fill="currentColor"
        fillOpacity=".07"
        stroke="currentColor"
        strokeOpacity=".4"
        strokeWidth=".7"
      />
      <path d="M4 13V3H19" stroke="currentColor" strokeOpacity=".22" strokeWidth=".6" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={crest?.motif ?? "M12 7L17 12L12 18L7 12ZM10 12H14"} />
        {crest?.detail && <path d={crest.detail} strokeWidth="1" />}
      </g>
      {crest?.awakened && (
        <path d="M6 21L8 20M18 21L16 20" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}
