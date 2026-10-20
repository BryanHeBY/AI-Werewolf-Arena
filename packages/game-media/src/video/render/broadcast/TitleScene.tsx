/**
 * 负责原生舞台片头与项目署名。输入为标题、强调及显式制作资料，输出保留环境和名册的中心排版。
 * 署名不加入配音、不推断模型或Agent来源；GitHub图形为本地SVG，不请求远程资源。
 */
import { SceneText } from "./SceneText";
import { text } from "@ai-werewolf-arena/game-text";
import type { SceneRenderProps } from "./contracts";

export function TitleScene({
  scene,
  caption,
  localFrame,
  metrics,
  appearance,
  locale,
}: SceneRenderProps) {
  const { scale } = metrics;
  const { theme, surface, palette } = appearance;
  const { credits } = scene;
  const opening = theme.definition.opening;
  return (
    <div
      data-announcement-title
      style={{
        position: "absolute",
        inset: opening.inset * scale,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        textShadow: opening.textShadow,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "12% -2%",
          background: opening.backdrop,
          pointerEvents: "none",
        }}
      />
      {localFrame >= scene.cues.impact && (
        <div style={{ position: "relative", width: "100%" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: theme.definition.fonts.heading,
              fontSize: opening.titleSize * scale,
              lineHeight: 1.4,
              textWrap: "balance",
              whiteSpace: "pre-line",
              fontWeight: 700,
              color: surface.readingText,
            }}
          >
            {scene.title}
          </h1>
          <p
            style={{
              margin: `${32 * scale}px 0 0`,
              fontSize: opening.subtitleSize * scale,
              lineHeight: 1.6,
              color: surface.readingMuted,
            }}
          >
            <SceneText caption={caption} emphasis={scene.emphasis} accent={palette.wolf} />
          </p>
          {credits && (
            <div
              data-opening-credits
              style={{
                marginTop: 64 * scale,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16 * scale,
                color: surface.readingText,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 400 * scale,
                  height: scale,
                  marginBottom: 16 * scale,
                  background: `linear-gradient(90deg, transparent, ${palette.accent}88, transparent)`,
                }}
              />
              <a
                href={`https://github.com/${credits.repository}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14 * scale,
                  color: "inherit",
                  textDecoration: "none",
                  fontSize: opening.repositorySize * scale,
                }}
              >
                <svg width={30 * scale} height={30 * scale} viewBox="0 0 24 24" aria-label="GitHub">
                  <path
                    fill="currentColor"
                    d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.543 0-.267-.01-.974-.015-1.912-3.13.68-3.79-1.508-3.79-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.023-.7.078-.686.078-.686 1.13.08 1.725 1.16 1.725 1.16 1.006 1.724 2.64 1.226 3.282.938.103-.728.394-1.226.716-1.508-2.499-.284-5.126-1.25-5.126-5.565 0-1.23.44-2.233 1.16-3.021-.117-.285-.503-1.43.11-2.98 0 0 .945-.303 3.094 1.154A10.78 10.78 0 0 1 12 6.18c.956.005 1.918.13 2.815.378 2.148-1.457 3.092-1.154 3.092-1.154.615 1.55.23 2.695.113 2.98.722.788 1.158 1.791 1.158 3.021 0 4.326-2.63 5.278-5.136 5.557.405.35.766 1.042.766 2.1 0 1.517-.014 2.74-.014 3.113 0 .302.202.653.774.543A11.252 11.252 0 0 0 12 .75Z"
                  />
                </svg>
                {credits.repository}
              </a>
              <div
                data-opening-project-subtitle
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8 * scale,
                  fontSize: opening.detailsSize * scale,
                  lineHeight: 1.5,
                  color: surface.readingMuted,
                }}
              >
                <div>
                  {credits.description && <span>{credits.description} · </span>}
                  {text(locale, "video.credit_agent")} {credits.agent}
                  {credits.model && (
                    <span>
                      {" "}
                      · {text(locale, "video.credit_model")} {credits.model}
                    </span>
                  )}
                </div>
                {Boolean(credits.features?.length) && <div>{credits.features!.join(" · ")}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
