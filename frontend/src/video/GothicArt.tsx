/**
 * 负责哥特视频主题的本地环境、静态技能道具和旧金属框体。输入为显式昼夜及素材标识，输出无游戏文字的纯视觉层。
 * 图片仅承担美术，不包含身份、库存或结果；所有事实仍由广播宿主排版。静态资源由 Vite／Remotion 打包，不依赖远程地址。
 */
import type { CSSProperties } from "react";
import { AbsoluteFill } from "remotion";
import { VideoImage } from "./VideoImage";

export const GOTHIC_METAL = "#a5936c";
export const GOTHIC_LIGHT = "#e7dcc2";
export const GOTHIC_DARK = "#0b171e";

// new URL 的静态字面路径由两种 bundler 收集；不把源码绝对路径写进 VideoPlan。
const dayFog = new URL("./assets/gothic/fog-day.png", import.meta.url).href;
const nightFog = new URL("./assets/gothic/fog-night.png", import.meta.url).href;
const mirror = new URL("./assets/gothic/seer-mirror.png", import.meta.url).href;
const healVial = new URL("./assets/gothic/heal-vial.png", import.meta.url).href;
const poisonVial = new URL("./assets/gothic/poison-vial.png", import.meta.url).href;
const art = {
  inspect: mirror,
  heal: healVial,
  poison: poisonVial,
  "blood-wolf-claw": new URL("./assets/gothic/blood-wolf-claw.png", import.meta.url).href,
  "dueling-blades": new URL("./assets/gothic/dueling-blades.png", import.meta.url).href,
  "demon-crossbow": new URL("./assets/gothic/demon-crossbow.png", import.meta.url).href,
  "iron-ward": new URL("./assets/gothic/iron-ward.png", import.meta.url).href,
  flintlock: new URL("./assets/gothic/flintlock.png", import.meta.url).href,
  "oath-contract": new URL("./assets/gothic/oath-contract.png", import.meta.url).href,
  "bond-rings": new URL("./assets/gothic/bond-rings.png", import.meta.url).href,
  "mapping-gates": new URL("./assets/gothic/mapping-gates.png", import.meta.url).href,
  "clock-lock": new URL("./assets/gothic/clock-lock.png", import.meta.url).href,
  "sealed-grimoire": new URL("./assets/gothic/sealed-grimoire.png", import.meta.url).href,
  "judgement-seal": new URL("./assets/gothic/judgement-seal.png", import.meta.url).href,
  "raven-quill": new URL("./assets/gothic/raven-quill.png", import.meta.url).href,
  "beast-totem": new URL("./assets/gothic/beast-totem.png", import.meta.url).href,
  "report-silver-seal": new URL("./assets/gothic/report-silver-seal.png", import.meta.url).href,
  "report-eclipse-seal": new URL("./assets/gothic/report-eclipse-seal.png", import.meta.url).href,
} as const;
export type GothicArtId = keyof typeof art;

export function GothicBackdrop({ night }: { night: boolean }) {
  return (
    <AbsoluteFill data-gothic-environment>
      <VideoImage
        src={night ? nightFog : dayFog}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at 50% 40%, transparent 15%, #02080d66 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

/** 局部阅读面只承托文字；整块stage不再调用此表面遮住环境。 */
export function gothicSurface(night: boolean): CSSProperties {
  return {
    backgroundColor: night ? "#081219cc" : "#081219db",
    borderRadius: 2,
    boxShadow: "0 10px 32px #00000055, inset 0 0 45px #00000014",
  };
}

/** 框、铆钉和角件是可缩放的代码原生结构，保持与截图分辨率无关。 */
export function GothicMetalFrame({
  scale = 1,
  active = false,
  color = GOTHIC_METAL,
  small = false,
  ornamental = false,
}: {
  scale?: number;
  active?: boolean;
  color?: string;
  small?: boolean;
  ornamental?: boolean;
}) {
  const size = (small ? 12 : ornamental ? 20 : 16) * scale;
  return (
    <AbsoluteFill
      aria-hidden="true"
      data-gothic-metal-frame
      data-theme-ornamental-frame={ornamental || undefined}
      style={{
        pointerEvents: "none",
        border: small ? "none" : `${(active ? 2 : 1.5) * scale}px solid ${color}`,
        boxSizing: "border-box",
        boxShadow: small ? undefined : `inset 0 0 0 ${2 * scale}px #02070c`,
      }}
    >
      {ornamental && (
        <AbsoluteFill
          style={{
            inset: (ornamental ? 8 : 5) * scale,
            width: "auto",
            height: "auto",
            border: `${0.6 * scale}px solid ${color}55`,
          }}
        />
      )}
      {ornamental && !small && (
        <div
          style={{
            position: "absolute",
            top: -4 * scale,
            left: "50%",
            width: 8 * scale,
            height: 8 * scale,
            transform: "translateX(-50%) rotate(45deg)",
            border: `${scale}px solid ${color}`,
            background: GOTHIC_DARK,
          }}
        />
      )}
      {(small ? [0, 3] : [0, 1, 2, 3]).map((corner) => (
        <svg
          key={corner}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          style={{
            position: "absolute",
            left: corner % 2 === 0 ? 0 : undefined,
            right: corner % 2 === 1 ? 0 : undefined,
            top: corner < 2 ? 0 : undefined,
            bottom: corner > 1 ? 0 : undefined,
            transform: `scale(${corner % 2 === 0 ? 1 : -1},${corner < 2 ? 1 : -1})`,
          }}
        >
          <path d="M1 21V1H21L16 5H6V16Z" fill="#101c21" stroke={color} strokeWidth="1" />
          <path d="M3 14L14 3M8 8L11 11" stroke={color} strokeWidth=".7" />
          <circle cx="4" cy="4" r="1.3" fill={GOTHIC_LIGHT} />
        </svg>
      ))}
    </AbsoluteFill>
  );
}

export function PhaseSigil({ night, size = 30 }: { night: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {night ? (
        <path d="M27 4A16 16 0 1 0 35 30A15 15 0 0 1 27 4Z" fill={GOTHIC_LIGHT} />
      ) : (
        <>
          <circle cx="20" cy="20" r="8" stroke={GOTHIC_LIGHT} strokeWidth="2" />
          {Array.from({ length: 8 }, (_, index) => (
            <path
              key={index}
              d="M20 2V8"
              transform={`rotate(${index * 45} 20 20)`}
              stroke={GOTHIC_METAL}
              strokeWidth="2"
            />
          ))}
        </>
      )}
    </svg>
  );
}

/** 道具没有阵营答案，也不持有动画。唯一宿主决定有限入场，暂停和阅读时不再永久漂浮。 */
export function GothicSkillArt({ kind, size }: { kind: GothicArtId; size: number }) {
  return (
    <div
      data-gothic-skill-art={kind}
      style={{
        position: "relative",
        width: size,
        height: size,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "14%",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${kind === "heal" ? "#91b99133" : kind === "poison" ? "#903a5c33" : "#b6c4d522"}, transparent 70%)`,
          filter: `blur(${size * 0.06}px)`,
        }}
      />
      <VideoImage
        src={art[kind]}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: `drop-shadow(0 ${size * 0.03}px ${size * 0.04}px #00000080)`,
        }}
      />
    </div>
  );
}
