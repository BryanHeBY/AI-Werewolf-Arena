/**
 * 负责哥特英雄图上的报告、决斗、保护与撤销材质叠层。输入为通用时钟的revealed及typed意图，输出原有叠层顺序。
 * 这些图形不追加事实，报告接收者和生命变化仍由通用场景文字及既有state cue负责；minimal兼容沿用现有报告小章。
 */
import type { VideoVisualIntent } from "../../video/types";
import { GothicReportSeal } from "./ReportSeal";
export function GothicHeroOverlays({
  intent,
  size,
  revealed,
  color,
  reportColor,
}: {
  intent: VideoVisualIntent | undefined;
  size: number;
  revealed: boolean;
  color: string;
  reportColor: string;
}) {
  const report = intent?.report;
  const reportCamp =
    report?.kind === "camp" || report?.kind === "combined" ? report.camp : undefined;
  return (
    <>
      {/* 报告只在揭晓后赋色；不从当前角色/阵营给中性镜面填答案。 */}
      {revealed && report && (
        <div
          data-report-kind={report.kind}
          data-report-camp={reportCamp}
          data-report-contains-wolf={
            report.kind === "pair" ? String(report.containsWerewolf) : undefined
          }
          data-range-signal={report.kind === "range" ? report.signal : undefined}
          style={{
            position: "absolute",
            left: "37%",
            right: "37%",
            bottom: "11%",
            height: 5,
            background: reportColor,
            opacity: 0.8,
          }}
        />
      )}
      {revealed && report && <GothicReportSeal report={report} size={size} />}
      {revealed && intent?.duel && (
        <div
          data-duel-branch={intent.duel.branch}
          data-duel-chain={intent.duel.chain}
          style={{
            position: "absolute",
            left: "32%",
            right: "32%",
            bottom: "12%",
            height: size * 0.025,
            borderBlock: `2px solid ${intent.duel.branch === "wolf" ? "#c28186" : color}`,
            background: "#10171dcc",
          }}
        />
      )}
      {revealed && intent?.protection && (
        <svg
          data-protection-interaction={intent.protection.interaction}
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ position: "absolute", inset: 0 }}
          aria-hidden="true"
        >
          {intent.protection.interaction === "guard_heal_cancelled" ? (
            <>
              <path d="M27 62L44 46M56 54L73 38" stroke="#c8969b" strokeWidth="2" />
            </>
          ) : (
            <path
              d="M23 68Q15 50 26 30M74 30Q85 50 77 68"
              stroke="#b7cebf"
              strokeWidth="2"
              fill="none"
            />
          )}
        </svg>
      )}
      {revealed && report?.kind === "range" && (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ position: "absolute", inset: 0 }}
          aria-hidden="true"
        >
          <path
            d={
              report.signal === "roar"
                ? "M22 33Q10 50 22 67M78 33Q90 50 78 67M15 25Q-2 50 15 75M85 25Q102 50 85 75"
                : "M24 67H76"
            }
            stroke={color}
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      )}
      {revealed && (intent?.process === "revoked" || intent?.process === "expired") && (
        <svg
          data-effect-revoked
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{ position: "absolute", inset: 0 }}
          aria-hidden="true"
        >
          <path d="M23 60L43 47M57 39L77 26" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
        </svg>
      )}
    </>
  );
}
