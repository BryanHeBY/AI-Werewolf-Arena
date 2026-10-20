/**
 * 负责哥特镜面的报告材质。输入为已揭晓typed报告和尺寸，输出银章、血爪、蚀章或中性角色小章。
 * 双查只标整组，非狼不推出好人；角色报告不借阵营章，未知不从当前身份补答案。
 */
import { GothicSkillArt } from "../../video/GothicArt";
import { RoleCrest } from "../../presentation/RoleCrest";
import type { VideoVisualReport } from "../../video/types";
/** 镜面结果叠层只表达typed报告。整组双查共用一个封印，绝不把狼痕分派给某个玩家。 */
export function GothicReportSeal({ report, size }: { report: VideoVisualReport; size: number }) {
  const pair = report.kind === "pair";
  const wolf =
    report.kind === "camp" || report.kind === "combined"
      ? report.camp === "wolf"
      : pair && report.containsWerewolf;
  const unknown = report.kind === "unknown";
  const thirdParty =
    (report.kind === "camp" || report.kind === "combined") && report.camp === "third_party";
  if (report.kind === "range") return null;
  const role = report.kind === "role" || report.kind === "combined" ? report.roleId : undefined;
  return (
    <div
      data-report-seal={report.kind}
      data-pair-result={pair ? String(report.containsWerewolf) : undefined}
      style={{
        position: "absolute",
        left: size * 0.14,
        top: size * 0.17,
        width: size * 0.47,
        height: size * 0.38,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "48%",
        overflow: "hidden",
        background: unknown
          ? "radial-gradient(ellipse,#162734f2,#0e1927cc 60%,transparent 78%)"
          : "radial-gradient(ellipse,#0b1522b3,transparent 75%)",
      }}
    >
      {unknown ? (
        <svg width="78%" height="70%" viewBox="0 0 100 80" aria-hidden="true">
          <path
            d="M17 20H44M58 20H83M27 40H73M17 60H44M58 60H83"
            stroke="#9aa9b8"
            strokeWidth="3"
            strokeDasharray="4 6"
            opacity=".7"
          />
        </svg>
      ) : (
        <>
          {wolf ? (
            <GothicSkillArt kind="blood-wolf-claw" size={size * (role ? 0.23 : 0.37)} />
          ) : report.kind !== "role" && !pair ? (
            <GothicSkillArt
              kind={thirdParty ? "report-eclipse-seal" : "report-silver-seal"}
              size={Math.min(110, size * 0.27)}
            />
          ) : null}
          {role && (
            <div
              data-report-role-medallion
              style={{
                position: "absolute",
                width: Math.min(48, size * 0.117),
                height: Math.min(48, size * 0.117),
                display: "grid",
                placeItems: "center",
                borderRadius: "50%",
                background: "#0b1522e6",
                border: "1px solid #9caeb8",
                ...(wolf ? { right: "8%", bottom: "8%" } : {}),
              }}
            >
              <RoleCrest role={role} size={Math.min(44, size * 0.1073)} color="#d7e5ec" />
            </div>
          )}
        </>
      )}
      {pair && (
        <svg
          data-aggregate-pair-seal
          width="100%"
          height="100%"
          viewBox="0 0 100 80"
          style={{ position: "absolute", inset: 0 }}
          aria-hidden="true"
        >
          <rect
            x="4"
            y="9"
            width="92"
            height="62"
            rx="25"
            fill="none"
            stroke={wolf ? "#be7a83" : "#bdcedb"}
            strokeWidth="2"
          />
          <path
            d="M22 8V16M78 8V16M22 64V72M78 64V72"
            stroke={wolf ? "#be7a83" : "#bdcedb"}
            strokeWidth="2"
          />
        </svg>
      )}
    </div>
  );
}
