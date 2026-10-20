/**
 * 负责字体就绪后的真实正文量高、行位置与固定阅读窗。输入为全文、展示尺寸和纯帧策略，输出同一正文及稳定的阅读位移。
 * 正文由VideoFonts门挂载；量高只决定像素溢出，不回写时长／事实，不用CSS动画、定时器或scrollTop累加。
 * 每次首次量高与尺寸变更均阻塞Remotion到稳定commit，倒放或直接seek只改变进度对应的transform。
 */
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { continueRender, delayRender, useCurrentScale, usePixelDensity } from "remotion";
import { SceneText } from "./SceneText";
import type { SceneCaption } from "./contracts";
import type { VideoScene } from "../../types";
import {
  readingLineStops,
  readingMotionOffset,
  speechReadingStops,
  speechReadingOffset,
  type ReadingRow,
} from "./reading-motion";
export { readingOffset } from "./reading-motion";
interface Measurement {
  key: string;
  width: number;
  height: number;
  windowHeight: number;
  contentHeight: number;
  overflow: number;
  lineStops: number[];
  rows: ReadingRow[];
}
export function ReadingViewport({
  caption,
  emphasis,
  accent,
  kind,
  fontSize,
  lineHeight,
  textAlign = "left",
  maxHeight,
  children,
}: {
  caption: SceneCaption;
  emphasis: VideoScene["emphasis"];
  accent: string;
  /** 由实际文本拥有者标记；旧外层已有场景标记时省略，避免父子重复语义选择器。 */
  kind?: "speech" | "announcement" | "result" | "ballot" | "resolution";
  fontSize: number;
  lineHeight: number;
  textAlign?: CSSProperties["textAlign"];
  maxHeight?: number;
  /** 结构化报告／终局仍复用同一真实量高窗；子树只展示显式内容，不决定滚动时钟。 */
  children?: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null);
  const pending = useRef(new Set<number>());
  const measured = useRef<Measurement | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const flow = Boolean(caption.reading);
  const motion = caption.reading?.motion;
  const displayScale = useCurrentScale({ dontThrowIfOutsideOfRemotion: true });
  const pixelDensity = usePixelDensity({ dontThrowIfOutsideOfRemotion: true });
  const compositionScale = displayScale > 0 && Number.isFinite(displayScale) ? displayScale : 1;
  const pixelsPerUnit = compositionScale * (pixelDensity > 0 ? pixelDensity : 1);
  // 调用方可逐帧创建等值数组；量高只依赖内容，不因新数组身份重复阻塞渲染。
  const protectedKey = JSON.stringify(caption.protectedTerms ?? []);
  const emphasisKey = JSON.stringify(emphasis);
  // 新发言窗独立裁剪完整行；无策略的旧计划仍按原连续公式位移，不强加逐行节奏。
  const wholeRows = kind === "speech" && motion !== undefined;
  const layoutKey = JSON.stringify([
    caption.text,
    caption.offset,
    protectedKey,
    emphasisKey,
    fontSize,
    lineHeight,
    maxHeight,
    textAlign,
    flow,
    motion,
    compositionScale,
    kind,
  ]);
  const current = measurement?.key === layoutKey ? measurement : null;
  useLayoutEffect(() => {
    const release = () => {
      for (const handle of pending.current) continueRender(handle);
      pending.current.clear();
    };
    pending.current.add(delayRender("video_reading_layout"));
    const measure = () => {
      if (!viewport.current || !content.current) return;
      const contentHeight = content.current.scrollHeight;
      const height = viewport.current.clientHeight;
      const style = getComputedStyle(content.current);
      const rowHeight = Number.parseFloat(style.lineHeight);
      const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
      const visibleRows =
        rowHeight > 0 ? Math.max(0, Math.floor((height - padding) / rowHeight)) : 0;
      // 外层始终以全文为首选高度参与flex；内窗只向下取整，避免反过来让外层越量越矮。
      const windowHeight =
        wholeRows && contentHeight > height && rowHeight > 0
          ? visibleRows > 0
            ? Math.min(height, visibleRows * rowHeight + padding)
            : 0
          : height;
      const overflow = Math.max(0, contentHeight - windowHeight);
      const lineTops: number[] = [];
      const rows: ReadingRow[] = [];
      if (motion === "line" && overflow > 0) {
        const origin = content.current.getBoundingClientRect().top;
        // 使用已排好版的inline片段，保留中英换行与空行；转换回composition坐标后去重同一视觉行。
        const fragments = Array.from(content.current.children)
          .flatMap((node) =>
            Array.from(node.getClientRects(), (rect) => ({
              top: (rect.top - origin) / compositionScale,
              start: Number(node.getAttribute("data-reading-start")),
              visible: rect.width > 0 && rect.height > 0,
            })),
          )
          .filter((fragment) => fragment.visible)
          .sort((a, b) => a.top - b.top || a.start - b.start);
        const tolerance = fontSize * lineHeight * 0.4;
        for (const fragment of fragments)
          if (!lineTops.length || fragment.top - lineTops.at(-1)! > tolerance) {
            lineTops.push(fragment.top);
            rows.push({ start: fragment.start, top: fragment.top - lineTops[0]! });
          }
      }
      const next = {
        key: layoutKey,
        width: viewport.current.clientWidth,
        height,
        windowHeight,
        // Player会整体CSS缩放；scrollHeight/clientHeight同属原生composition坐标，不能混用缩放后的DOMRect。
        contentHeight,
        overflow,
        lineStops: readingLineStops(lineTops, overflow),
        rows,
      };
      const previous = measured.current;
      if (
        previous &&
        next.key === previous.key &&
        next.width === previous.width &&
        next.height === previous.height &&
        next.windowHeight === previous.windowHeight &&
        next.contentHeight === previous.contentHeight &&
        next.overflow === previous.overflow &&
        next.lineStops.length === previous.lineStops.length &&
        next.lineStops.every((stop, index) => Math.abs(stop - previous.lineStops[index]!) < 0.05)
      ) {
        release();
        return;
      }
      pending.current.add(delayRender("video_reading_resize"));
      measured.current = next;
      setMeasurement(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current!);
    observer.observe(content.current!);
    return () => {
      observer.disconnect();
      release();
    };
  }, [
    caption.text,
    caption.offset,
    protectedKey,
    emphasisKey,
    fontSize,
    lineHeight,
    maxHeight,
    textAlign,
    flow,
    motion,
    displayScale,
    compositionScale,
    wholeRows,
    layoutKey,
  ]);
  useLayoutEffect(() => {
    if (!measurement) return;
    for (const handle of pending.current) continueRender(handle);
    pending.current.clear();
  }, [measurement]);
  const progress = caption.reading?.scrollProgress ?? 0;
  const speechStops = useMemo(
    () =>
      motion === "line" && current && caption.speechReading
        ? speechReadingStops(
            current.rows,
            caption.speechReading.cues,
            current.windowHeight,
            current.overflow,
          )
        : undefined,
    [motion, current, caption.speechReading?.cues],
  );
  const offset =
    speechStops && caption.speechReading
      ? speechReadingOffset(
          speechStops,
          caption.speechReading.frame,
          caption.reading?.transitionFrames ?? 0,
          pixelsPerUnit,
        )
      : readingMotionOffset(
          wholeRows && current?.windowHeight === 0 ? 0 : (current?.overflow ?? 0),
          progress,
          {
            motion,
            transitionFrames: caption.reading?.transitionFrames,
            scrollFrames: caption.reading?.scrollFrames,
            stops: current?.lineStops,
            pixelsPerUnit,
          },
        );
  return (
    <div
      ref={viewport}
      data-reading-viewport
      data-reading-mode={flow ? "flow" : "legacy-pages"}
      data-reading-motion={motion ?? "legacy-continuous"}
      data-reading-line-stops={current?.lineStops.length ?? 0}
      data-reading-pixel-scale={pixelsPerUnit}
      data-reading-ready={current !== null ? "true" : "false"}
      data-reading-overflow={current?.overflow ?? 0}
      data-reading-offset={offset}
      data-reading-progress={progress}
      data-reading-clock={speechStops ? "speech" : "scene"}
      style={{
        minHeight: 0,
        minWidth: 0,
        flex: "0 1 auto",
        height: wholeRows ? current?.contentHeight : undefined,
        maxHeight,
        overflow: "hidden",
        fontSize,
        lineHeight,
        textAlign,
      }}
    >
      <div
        data-reading-window
        data-reading-whole-rows={wholeRows ? "true" : "false"}
        style={{ height: wholeRows ? current?.windowHeight : undefined, overflow: "hidden" }}
      >
        <div
          ref={content}
          data-reading-content
          {...(kind ? { [`data-scene-${kind}`]: true } : {})}
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            wordBreak: "normal",
            lineBreak: "strict",
            paddingBlock: "0.1em",
            transform: `translateY(${-offset}px)`,
            willChange: motion && motion !== "static" ? "transform" : undefined,
          }}
        >
          {children ?? <SceneText caption={caption} emphasis={emphasis} accent={accent} />}
        </div>
      </div>
    </div>
  );
}
