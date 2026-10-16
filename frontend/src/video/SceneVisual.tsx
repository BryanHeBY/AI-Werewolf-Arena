/**
 * 负责消费已校验的视觉意图并选择静态道具、结果封印及有限连接轨迹。输入为typed意图和显式帧，输出无规则计算的场景图形。
 * 选择、实际作用、报告、反馈接收者分开；没有证据时不补命中或生命变化。图片只做美术，文字由宿主分页。
 */
import type { CSSProperties } from "react";
import type { ResolvedTheme } from "../themes";
import type { VideoScene, VideoVisualFamily, VideoVisualIntent } from "./types";
import { GothicSkillArt, type GothicArtId } from "./GothicArt";
import { sceneMotion } from "./scene-motion";
import { RoleCrest } from "../presentation/RoleCrest";
import type { VideoVisualReport } from "./types";

const familyArt: Record<VideoVisualFamily, GothicArtId> = {
  affiliation: "oath-contract",
  animal_signal: "beast-totem",
  civic_ballot: "raven-quill",
  copy_resource: "sealed-grimoire",
  death_action: "flintlock",
  delayed_life: "clock-lock",
  duel: "dueling-blades",
  expression: "raven-quill",
  game_result: "judgement-seal",
  gift_resource: "sealed-grimoire",
  god_announcement: "judgement-seal",
  identity_choice: "sealed-grimoire",
  independent_survival: "clock-lock",
  inheritance: "oath-contract",
  inspection_camp: "inspect",
  inspection_pair: "inspect",
  inspection_role: "inspect",
  life_settlement: "judgement-seal",
  mapping: "mapping-gates",
  modifier: "oath-contract",
  pack_attack: "blood-wolf-claw",
  phase_transition: "judgement-seal",
  player_dialogue: "raven-quill",
  potion: "heal",
  protection: "iron-ward",
  reflection: "mapping-gates",
  relation_link: "bond-rings",
  resource_inventory: "heal",
  reveal_survival: "judgement-seal",
  secret_decision: "oath-contract",
  suppression: "clock-lock",
};
/** 显式子型选择，不能根据事件名的前后缀或玩家台词猜技能。 */
export function sceneArt(scene: VideoScene): GothicArtId | "potion-pair" | "record" {
  const intent = scene.visual;
  if (!intent || intent.fallbackReason) return "record";
  // 明示工具属于本次行动形式，不能被狼群／复制等机制家族默认图覆盖；也不据此补原生技能来源。
  if (intent.deathTool)
    return (
      {
        gun: "flintlock",
        claw: "blood-wolf-claw",
        patrol: "oath-contract",
        retaliation: "beast-totem",
      } as const
    )[intent.deathTool];
  if (intent.duelKind)
    return intent.duelKind === "demon_hunter" ? "demon-crossbow" : "dueling-blades";
  if (intent.potion) return intent.potion;
  if (intent.protection) return intent.protection.kind === "heal" ? "heal" : "iron-ward";
  if (intent.report) return intent.report.kind === "range" ? "beast-totem" : "inspect";
  if (intent.family === "death_action") {
    // 已知请求窗口只指定该种行动形式；未知枪/爪来源不能从当前角色补齐。
    if (intent.template === "death_action/hunter_shot_window") return "flintlock";
    if (intent.template === "death_action/awakened_claw_bequest_window") return "blood-wolf-claw";
    if (intent.template === "death_action/awakened_patrol_window") return "oath-contract";
    if (intent.template === "death_action/puffer_reaction_window") return "beast-totem";
    return "record";
  }
  if (intent.family === "resource_inventory") return "potion-pair";
  if (intent.family === "potion")
    return scene.action?.kind === "heal"
      ? "heal"
      : scene.action?.kind === "poison"
        ? "poison"
        : "potion-pair";
  switch (intent.template) {
    case "pack_attack/recorded_individual_choice":
    case "pack_attack/wolf_vote_window":
    case "pack_attack/self_destruct_declared":
    case "pack_attack/self_destruct_resolved":
      return "oath-contract";
    case "death_action/puffer_reaction_window":
      return "beast-totem";
    case "reflection/committed_effect_not_automatic_death":
      return "clock-lock";
    default:
      return familyArt[intent.family];
  }
}

/** 未知事件用小型记事牌；不是大眼睛、狼头或含义不明的菱形英雄图。 */
export function RecordMark({ size, color }: { size: number; color: string }) {
  return (
    <svg
      data-neutral-record
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 10H56L63 17V70H17V10Z"
        fill={color}
        fillOpacity=".08"
        stroke={color}
        strokeWidth="2"
      />
      <path d="M56 10V18H63M27 29H53M27 40H53M27 51H46" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/** 镜面结果叠层只表达typed报告。整组双查共用一个封印，绝不把狼痕分派给某个玩家。 */
function ReportSeal({ report, size }: { report: VideoVisualReport; size: number }) {
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

export function SceneHero({
  scene,
  frame,
  size,
  theme,
  gothic,
  color,
}: {
  scene: VideoScene;
  frame: number;
  size: number;
  theme: ResolvedTheme;
  gothic: boolean;
  color: string;
}) {
  const art = sceneArt(scene);
  const motion = sceneMotion(frame, scene.cues, {
    reduced: theme.options.reducedMotion === true,
    enterDistance:
      (theme.definition.motion.enterDistance * size) / theme.definition.effect.heroSize,
    impactOpacity: theme.definition.motion.impactOpacity,
  });
  const intent = scene.visual;
  const report = intent?.report;
  const reportCamp =
    report?.kind === "camp" || report?.kind === "combined" ? report.camp : undefined;
  const reportColor = reportCamp === "wolf" ? "#dba0a4" : reportCamp === "good" ? "#b4d1df" : color;
  const dim =
    intent?.process === "revoked" ||
    intent?.process === "expired" ||
    intent?.process === "suppressed";
  const slashSpan = Math.max(1, (scene.cues.settled - scene.cues.impact) * 0.625);
  const slash =
    theme.options.reducedMotion === true
      ? motion.revealed
        ? 1
        : 0
      : Math.max(0, Math.min(1, (frame - scene.cues.impact) / slashSpan + 0.1));
  const claw = art === "blood-wolf-claw";
  const duelRotation = art === "dueling-blades" ? (1 - motion.pathProgress) * -4 : 0;
  const wrapper: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    opacity: motion.opacity * (dim && motion.revealed ? 0.52 : 1),
    transform: `translateY(${motion.enterY}px)`,
  };
  return (
    <div
      data-scene-hero={art}
      data-visual-family={intent?.family ?? "god_announcement"}
      data-visual-template={intent?.template}
      data-visual-process={intent?.process ?? "unknown"}
      data-death-tool={intent?.deathTool}
      data-duel-kind={intent?.duelKind}
      data-motion-stopped={motion.stopped ? "true" : "false"}
      style={wrapper}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: duelRotation ? `rotate(${duelRotation}deg)` : undefined,
          opacity: claw && !motion.revealed ? 0 : 1,
          clipPath: claw ? `inset(0 ${(1 - slash) * 100}% 0 0)` : undefined,
        }}
      >
        {gothic && art !== "record" ? (
          motion.revealed && intent?.protection?.interaction === "guard_heal_cancelled" ? (
            <div
              data-protection-pair
              style={{ display: "flex", alignItems: "center", height: "100%" }}
            >
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
          )
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
            <RecordMark size={Math.min(size * 0.36, 100)} color={color} />
          </div>
        )}
      </div>
      {motion.impactOpacity > 0 && (
        <div
          data-impact-envelope
          style={{
            position: "absolute",
            inset: "19%",
            borderRadius: "50%",
            pointerEvents: "none",
            background: `radial-gradient(ellipse, ${reportColor}, transparent 68%)`,
            opacity: motion.impactOpacity,
          }}
        />
      )}
      {/* 报告只在揭晓后赋色；不从当前角色/阵营给中性镜面填答案。 */}
      {motion.revealed && report && (
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
      {motion.revealed && report && <ReportSeal report={report} size={size} />}
      {motion.revealed && intent?.duel && (
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
      {motion.revealed && intent?.protection && (
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
      {motion.revealed && report?.kind === "range" && (
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
      {motion.revealed && (intent?.process === "revoked" || intent?.process === "expired") && (
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
    </div>
  );
}

/** 路径只表达意图中的对应关系；明示选择永远虚线，committed字样不自动升级为命中。 */
export function SceneConnector({
  intent,
  scene,
  frame,
  width,
  height,
  theme,
  color,
  scale,
}: {
  intent: VideoVisualIntent;
  scene: VideoScene;
  frame: number;
  width: number;
  height: number;
  theme: ResolvedTheme;
  color: string;
  scale: number;
}) {
  const motion = sceneMotion(frame, scene.cues, { reduced: theme.options.reducedMotion === true });
  const token = theme.definition.connector;
  const blocked = intent.process === "blocked" || intent.process === "suppressed";
  const revoked = intent.process === "revoked" || intent.process === "expired";
  // effectiveTargetIds来自reader，不拿requested作为效果兜底。报告只画信息回传，不伪装攻击命中。
  const effect = motion.revealed && intent.effectiveTargetIds.length > 0;
  const hasReport = intent.report !== undefined;
  // 未记录接收者或接收者并非左侧行动者时不伪造信息回传路线，宿主另列真实接收席。
  const report =
    motion.revealed &&
    hasReport &&
    intent.actorId !== undefined &&
    intent.recipientIds.includes(intent.actorId);
  const hasTarget =
    motion.revealed && intent.effectiveTargetKnown
      ? intent.effectiveTargetIds.length > 0
      : intent.requestedTargetIds.length > 0;
  const hasSource = intent.actorId !== undefined || (intent.participantIds?.length ?? 0) > 0;
  if (!hasSource || !hasTarget || (hasReport && motion.revealed && !report)) return null;
  const actorRadius = ((intent.participantIds?.length ?? 1) > 2 ? 44 : 86) / 2;
  const targetRadius =
    Math.max(intent.requestedTargetIds.length, intent.effectiveTargetIds.length) > 2 ? 22 : 43;
  // 与宿主medallion的left/right 24、top150及列中心共享同一1920基准，不用HUD外的假定箭头字符。
  const x1 = (24 + actorRadius) * scale + width * 0.125;
  const x2 = width - (24 + targetRadius) * scale - width * 0.125;
  const y = (150 + Math.min(actorRadius, targetRadius)) * scale;
  const end = revoked ? x1 + (x2 - x1) * 0.35 : x2;
  const left = report ? end : x1,
    right = report ? x1 : end;
  const mid = (left + right) / 2;
  const dash =
    effect && !blocked && !revoked ? undefined : token.choiceDash.map((n) => n * scale).join(" ");
  const stroke = (effect ? token.effectWidth : token.choiceWidth) * scale;
  const path = `M ${left} ${y} C ${mid} ${y + height * 0.16}, ${mid} ${y + height * 0.16}, ${right} ${y}`;
  const head = token.endpointSize * scale;
  const direction = right > left ? -1 : 1;
  return (
    <svg
      data-scene-connector
      data-connection-state={
        revoked ? "revoked" : blocked ? "blocked" : effect ? "effect" : report ? "report" : "choice"
      }
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={dash}
        opacity={revoked ? 0.48 : 0.76}
        style={{
          clipPath: report
            ? `inset(0 0 0 ${(1 - motion.pathProgress) * 100}%)`
            : `inset(0 ${(1 - motion.pathProgress) * 100}% 0 0)`,
        }}
      />
      {motion.pathProgress === 1 && !blocked && !revoked && (
        <path
          d={`M ${right + direction * head} ${y - head * 0.3} L ${right} ${y} L ${right + direction * head * 0.5} ${y + head * 0.7}`}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
        />
      )}
      {motion.revealed && blocked && (
        <path
          d={`M ${mid - head / 3} ${y + height * 0.12 - head} L ${mid + head / 3} ${y + height * 0.12 + head}`}
          stroke={color}
          strokeWidth={stroke * 2}
        />
      )}
    </svg>
  );
}
