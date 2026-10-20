/**
 * 负责简约主题的机制语义图形。输入仅为当前 typed 意图和揭晓许可，输出既有刻痕系统的无角色图形。
 * 枪不标猎人、本体不从能力推断；结果图只在揭晓后显示，未知记录没有文件图占位。
 */
import { roleFamilyMotif } from "../../presentation/role-crests";
import { minimalSkillGlyph } from "./skill-glyphs";
import type { VideoVisualIntent } from "../../video/types";
export function MinimalSkillGlyph({
  intent,
  size,
  color,
  revealed,
}: {
  intent: VideoVisualIntent | undefined;
  size: number;
  color: string;
  revealed: boolean;
}) {
  const glyph = minimalSkillGlyph(intent);
  if (!glyph || !intent) return null;
  const report = revealed ? intent.report : undefined;
  const reportCamp =
    report?.kind === "camp" || report?.kind === "combined" ? report.camp : undefined;
  const glyphSize = Math.min(size * 0.58, 180);
  return (
    <div
      data-minimal-skill={glyph.id}
      style={{ width: size, height: size, display: "grid", placeItems: "center" }}
    >
      <svg
        width={glyphSize}
        height={glyphSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={glyph.motif} />
        {reportCamp && (
          <circle
            data-minimal-report={reportCamp}
            cx="19"
            cy="19"
            r="3"
            fill={reportCamp === "wolf" ? "#a1374b" : reportCamp === "good" ? "#28627b" : "#766252"}
            strokeWidth=".7"
          />
        )}
        {revealed && intent.potion === "poison" && (
          <path data-minimal-potion="poison" d="M9 14L15 18M15 14L9 18" />
        )}
        {revealed && intent.protection?.interaction === "guard_heal_cancelled" && (
          <g data-minimal-protection="guard_heal_cancelled">
            <path d={roleFamilyMotif("potion")} transform="translate(12 7) scale(.5)" />
            <path d="M4 19L20 5" />
          </g>
        )}
        {revealed && (intent.process === "revoked" || intent.process === "expired") && (
          <path data-minimal-revoked d="M3 20L10 13M14 9L21 2" strokeDasharray="2 1" />
        )}
      </svg>
    </div>
  );
}
