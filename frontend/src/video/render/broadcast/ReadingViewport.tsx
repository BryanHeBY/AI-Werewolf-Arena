/**
 * 负责字体就绪后的真实正文量高与固定阅读窗。输入为全文、显式强调、CSS尺寸和纯帧进度，输出同一正文及线性位移。
 * 正文由VideoFonts门挂载；量高只决定像素溢出，不回写时长／事实，不用CSS动画、定时器或scrollTop累加。
 * 每次首次量高与尺寸变更均阻塞Remotion到稳定commit，倒放或直接seek只改变进度对应的transform。
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { continueRender, delayRender } from "remotion";
import { SceneText } from "./SceneText";
import type { SceneCaption } from "./contracts";
import type { VideoScene } from "../../types";

export function readingOffset(overflow: number, progress: number) {
  return Math.max(0, overflow) * Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
}
interface Measurement {
  width: number;
  height: number;
  contentHeight: number;
  overflow: number;
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
  // 调用方可逐帧创建等值数组；量高只依赖内容，不因新数组身份重复阻塞渲染。
  const protectedKey = JSON.stringify(caption.protectedTerms ?? []);
  const emphasisKey = JSON.stringify(emphasis);
  useLayoutEffect(() => {
    const release = () => {
      for (const handle of pending.current) continueRender(handle);
      pending.current.clear();
    };
    pending.current.add(delayRender("video_reading_layout"));
    const measure = () => {
      if (!viewport.current || !content.current) return;
      const next = {
        width: viewport.current.clientWidth,
        height: viewport.current.clientHeight,
        // Player会整体CSS缩放；scrollHeight/clientHeight同属原生composition坐标，不能混用缩放后的DOMRect。
        contentHeight: content.current.scrollHeight,
        overflow: Math.max(0, content.current.scrollHeight - viewport.current.clientHeight),
      };
      const previous = measured.current;
      if (
        previous &&
        Object.keys(next).every(
          (key) => next[key as keyof Measurement] === previous[key as keyof Measurement],
        )
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
  ]);
  useLayoutEffect(() => {
    if (!measurement) return;
    for (const handle of pending.current) continueRender(handle);
    pending.current.clear();
  }, [measurement]);
  const progress = caption.reading?.scrollProgress ?? 0;
  const offset = readingOffset(measurement?.overflow ?? 0, progress);
  return (
    <div
      ref={viewport}
      data-reading-viewport
      data-reading-mode={flow ? "flow" : "legacy-pages"}
      data-reading-ready={measurement !== null ? "true" : "false"}
      data-reading-overflow={measurement?.overflow ?? 0}
      data-reading-offset={offset}
      data-reading-progress={progress}
      style={{
        minHeight: 0,
        minWidth: 0,
        flex: "0 1 auto",
        maxHeight,
        overflow: "hidden",
        fontSize,
        lineHeight,
        textAlign,
      }}
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
        }}
      >
        {children ?? <SceneText caption={caption} emphasis={emphasis} accent={accent} />}
      </div>
    </div>
  );
}
