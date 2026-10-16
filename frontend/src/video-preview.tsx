/**
 * 负责已准备视频计划的浏览器预览。输入为本机编译结果和构建时图层注册，输出同一 composition 的逐帧交互。
 * 播放与导出共用镜头、字幕和音轨；浏览器不解释项目源码、不写复盘、不生成 TTS，卸载撤回迟到加载。
 */
import { useEffect, useMemo, useState, type ComponentProps, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { text } from "@ai-werewolf-arena/game-text";
import { VideoComposition, type VideoPlan } from "./video";
import { useReplayPlayback } from "./replay/useReplayPlayback";
import layerRegistry, { themeSlots } from "./video-layer-registry";
import { DEFAULT_WEB_THEME, resolveTheme, themeToCssVariables } from "./themes";
import "./style.css";

function VideoPreview() {
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/video/plan")
      .then(async (response) => {
        if (!response.ok) throw new Error("video_not_prepared");
        const value = (await response.json()) as VideoPlan;
        if (
          value.version !== 1 ||
          !Array.isArray(value.shots) ||
          !Number.isSafeInteger(value.durationFrames) ||
          value.durationFrames < 1
        )
          throw new Error("video_plan_invalid");
        if (active) setPlan(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const timeline = useMemo(
    () =>
      plan
        ? { starts: plan.shots.map((shot) => shot.from), durationInFrames: plan.durationFrames }
        : undefined,
    [plan],
  );
  const playback = useReplayPlayback(plan?.shots.length ?? 0, timeline);
  const inputProps = useMemo(
    () =>
      plan
        ? {
            plan,
            layerRegistry: layerRegistry as ComponentProps<
              typeof VideoComposition
            >["layerRegistry"],
            themeSlots,
            mediaBaseUrl: new URL("/api/video/", window.location.href).href,
          }
        : undefined,
    [plan],
  );
  const locale = plan?.display.locale ?? "zh-CN";
  if (!plan || !inputProps)
    return (
      <main
        className="shell centered"
        style={themeToCssVariables(resolveTheme(DEFAULT_WEB_THEME), "day") as CSSProperties}
      >
        <section className="panel" style={{ padding: 24 }}>
          <h1>{text(locale, "replay.video_preview")}</h1>
          <p role={error ? "alert" : undefined}>
            {text(locale, error ? "replay.video_unavailable" : "replay.loading")}
          </p>
          <a href="/">{text(locale, "replay.video_back")}</a>
        </section>
      </main>
    );
  return (
    <main
      className="shell"
      style={themeToCssVariables(resolveTheme(DEFAULT_WEB_THEME), "day") as CSSProperties}
    >
      <header className="topbar">
        <div>
          <h1>{text(locale, "replay.video_preview")}</h1>
          <p>{plan.source.sessionId}</p>
        </div>
        <a href="/">{text(locale, "replay.video_back")}</a>
      </header>
      <section className="panel" style={{ maxWidth: 1440, margin: "auto" }}>
        <div
          className="player-wrap"
          style={{ "--video-aspect-ratio": `${plan.width}/${plan.height}` } as CSSProperties}
        >
          <Player
            ref={playback.playerRef}
            component={VideoComposition}
            inputProps={inputProps}
            durationInFrames={plan.durationFrames}
            compositionWidth={plan.width}
            compositionHeight={plan.height}
            fps={plan.fps}
            controls={false}
            acknowledgeRemotionLicense
          />
        </div>
        <nav className="transport" aria-label={text(locale, "replay.navigation")}>
          <button
            onClick={() => playback.jumpTo(playback.activeIndex - 1)}
            disabled={playback.activeIndex === 0}
          >
            {text(locale, "replay.previous")}
          </button>
          <button onClick={playback.togglePlayback}>
            {text(locale, playback.playing ? "replay.pause" : "replay.play")}
          </button>
          <button
            onClick={() => playback.jumpTo(playback.activeIndex + 1)}
            disabled={playback.activeIndex >= plan.shots.length - 1}
          >
            {text(locale, "replay.next")}
          </button>
          <button onClick={playback.toggleFullscreen}>{text(locale, "replay.fullscreen")}</button>
          <select
            aria-label={text(locale, "replay.video_preview")}
            value={playback.activeIndex}
            onChange={(event) => playback.jumpTo(Number(event.target.value))}
          >
            {plan.shots.map((shot, index) => (
              <option key={shot.id} value={index}>
                {shot.id}
              </option>
            ))}
          </select>
        </nav>
        <div className="frame-control">
          <label>
            {text(locale, "replay.frame_position", {
              frame: playback.currentFrame + 1,
              total: plan.durationFrames,
            })}
            <input
              type="range"
              aria-label={text(locale, "replay.seek")}
              min={0}
              max={plan.durationFrames - 1}
              value={playback.currentFrame}
              onChange={(event) => playback.seekToFrame(Number(event.target.value))}
            />
          </label>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("app")!).render(<VideoPreview />);
