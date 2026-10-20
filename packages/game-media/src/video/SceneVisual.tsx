/**
 * 负责消费已校验的视觉意图并选择静态道具、结果封印及有限连接轨迹。输入为typed意图和显式帧，输出无规则计算的场景图形。
 * 选择、实际作用、报告、反馈接收者分开；没有证据时不补命中或生命变化。图片只做美术，文字由宿主分页。
 */
import type { CSSProperties } from "react";
import type { ResolvedTheme } from "../themes";
import type { VideoScene, VideoVisualIntent } from "./types";
import { sceneMotion } from "./scene-motion";
import { sceneArt } from "../themes/gothic/scene-art";
import { GothicHeroArt } from "../themes/gothic/HeroArt";
import { GothicHeroOverlays } from "../themes/gothic/HeroOverlays";
import { MinimalSkillGlyph } from "../themes/minimal/SkillGlyph";
export { sceneArt } from "../themes/gothic/scene-art";

/** 兼容旧导出但不再画无信息文件图；未知／notice由宿主保留全文和诊断。 */
export function RecordMark(_props: { size: number; color: string }) {
  return null;
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
  const motion = sceneMotion(frame, scene.cues, {
    reduced: theme.options.reducedMotion === true,
    enterDistance:
      (theme.definition.motion.enterDistance * size) / theme.definition.effect.heroSize,
    impactOpacity: theme.definition.motion.impactOpacity,
  });
  // 胜利与报告道具须服从同一揭晓许可，不能在镜头建立时借未来typed结果提前选图。
  const art = sceneArt(scene, { revealed: motion.revealed });
  if (art === "record") return null;
  const intent = scene.visual;
  const report = intent?.report;
  const reportCamp =
    report?.kind === "camp" || report?.kind === "combined" ? report.camp : undefined;
  const reportColor = reportCamp === "wolf" ? "#dba0a4" : reportCamp === "good" ? "#b4d1df" : color;
  const dim =
    intent?.process === "revoked" ||
    intent?.process === "expired" ||
    intent?.process === "suppressed";
  // 局部材质运动也只读同一有限时钟；主题素材组件不持有帧号或独立揭晓条件。
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
        {gothic ? (
          <GothicHeroArt art={art} intent={intent} size={size} revealed={motion.revealed} />
        ) : (
          <MinimalSkillGlyph intent={intent} size={size} color={color} revealed={motion.revealed} />
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
      {gothic && (
        <GothicHeroOverlays
          intent={intent}
          size={size}
          revealed={motion.revealed}
          color={color}
          reportColor={reportColor}
        />
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
