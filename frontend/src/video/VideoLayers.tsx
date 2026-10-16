/**
 * 负责绘制视频预设与项目自定义图层。输入为当前帧视图、计划和构建时组件注册表，输出场景或屏幕空间的 React 图层。
 * 图层只根据显式帧号绘制，不使用时钟或网络；自定义名称必须存在于注册表，组件本身不进入计划数据。
 * 广播world坐标投影到画布，席位始终固定HUD；旧布局仍由原父级world矩阵负责，不能重复变换。
 */
import type { CSSProperties } from "react";
import { resolveLayerPoint } from "./layout";
import { videoWorldToScreen, type VideoFrameView } from "./frame";
import type { PlannedVideoLayer, VideoLayerRegistry, VideoPlan } from "./types";

const fill: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
export function VideoLayers({
  view,
  plan,
  space,
  layerRegistry,
  mediaBaseUrl,
}: {
  view: VideoFrameView;
  plan: VideoPlan;
  space: "world" | "screen";
  layerRegistry?: VideoLayerRegistry;
  mediaBaseUrl?: string;
}) {
  return view.activeLayers
    .filter((layer) => layer.space === space)
    .map((layer) => (
      <div
        key={layer.id}
        data-video-layer={layer.id}
        data-layer-space={space}
        style={{ ...fill, zIndex: layer.zIndex }}
      >
        <PresetLayer
          layer={layer}
          view={view}
          plan={plan}
          layerRegistry={layerRegistry}
          mediaBaseUrl={mediaBaseUrl}
        />
      </div>
    ));
}
function PresetLayer({
  layer,
  view,
  plan,
  layerRegistry,
  mediaBaseUrl,
}: {
  layer: PlannedVideoLayer;
  view: VideoFrameView;
  plan: VideoPlan;
  layerRegistry?: VideoLayerRegistry;
  mediaBaseUrl?: string;
}) {
  const frame = view.localFrame - layer.from;
  const scale = Math.min(plan.width / 1280, plan.height / 720);
  const broadcast = view.layout.id === "broadcast-v1";
  const projectedWorld = broadcast && layer.space === "world";
  const worldScale = projectedWorld ? view.camera.scale : 1;
  const worldContainer: CSSProperties = projectedWorld
    ? { ...fill, transform: view.transform, transformOrigin: "0 0" }
    : fill;
  switch (layer.kind) {
    case "text": {
      const raw = { x: layer.x ?? plan.width * 0.12, y: layer.y ?? plan.height * 0.17 };
      const position = projectedWorld ? videoWorldToScreen(raw, view) : raw;
      return (
        <div
          style={{
            position: "absolute",
            left: position.x,
            top: position.y,
            ...(projectedWorld
              ? { transform: `scale(${worldScale})`, transformOrigin: "0 0" }
              : {}),
            width: layer.width ?? plan.width * 0.76,
            padding: 16 * scale,
            boxSizing: "border-box",
            color: layer.color ?? "#fff4d4",
            background: layer.background ?? "rgba(8,15,26,.93)",
            border: "1px solid rgba(228,198,125,.55)",
            borderRadius: 12 * scale,
            fontSize: layer.fontSize ?? 28 * scale,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            maxHeight: plan.height * 0.43,
            overflow: "hidden",
          }}
        >
          {layer.text}
        </div>
      );
    }
    case "arrow": {
      const resolve = (point: typeof layer.fromTarget) => {
        const position = resolveLayerPoint(point, view.layout);
        return projectedWorld || (layer.space === "screen" && "playerId" in point)
          ? videoWorldToScreen(position, view)
          : position;
      };
      const from = resolve(layer.fromTarget),
        to = resolve(layer.toTarget);
      const dx = to.x - from.x,
        dy = to.y - from.y,
        length = Math.hypot(dx, dy);
      if (length < 1) return null;
      const angle = Math.atan2(dy, dx),
        head = 17 * scale * worldScale;
      // 使用显式箭头路径，避免多 composition 内 SVG marker ID 相撞。
      return (
        <svg width={plan.width} height={plan.height} style={fill}>
          <path
            d={`M ${from.x} ${from.y} L ${to.x} ${to.y} M ${to.x - Math.cos(angle - 0.45) * head} ${to.y - Math.sin(angle - 0.45) * head} L ${to.x} ${to.y} L ${to.x - Math.cos(angle + 0.45) * head} ${to.y - Math.sin(angle + 0.45) * head}`}
            fill="none"
            stroke={layer.color ?? "#ffd47a"}
            strokeWidth={(layer.strokeWidth ?? 4) * scale * worldScale}
            strokeLinecap="round"
          />
        </svg>
      );
    }
    case "spotlight":
    case "highlight": {
      const seats = view.layout.seats
        .filter((seat) => layer.playerIds.includes(seat.playerId))
        .map((seat) =>
          broadcast
            ? {
                ...seat,
                ...videoWorldToScreen(
                  resolveLayerPoint({ playerId: seat.playerId }, view.layout),
                  view,
                ),
              }
            : layer.space === "screen"
              ? {
                  ...seat,
                  ...videoWorldToScreen(seat, view),
                  width: seat.width * view.camera.scale,
                  height: seat.height * view.camera.scale,
                }
              : seat,
        );
      const id = `mask-${view.shotIndex}-${encodeURIComponent(layer.id).replace(/%/g, "_")}`;
      const color = layer.color ?? "#ffd47a";
      return (
        <svg width={plan.width} height={plan.height} style={fill}>
          {layer.kind === "spotlight" && (
            <>
              <defs>
                <mask id={id}>
                  <rect width="100%" height="100%" fill="white" />
                  {seats.map((seat) => (
                    <ellipse
                      key={seat.playerId}
                      cx={seat.x}
                      cy={seat.y}
                      rx={seat.width * 0.68}
                      ry={seat.height * 0.75}
                      fill="black"
                    />
                  ))}
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="#03060c"
                opacity={layer.opacity ?? 0.65}
                mask={`url(#${id})`}
              />
            </>
          )}
          {seats.map((seat) => (
            <ellipse
              key={seat.playerId}
              cx={seat.x}
              cy={seat.y}
              rx={seat.width * 0.62}
              ry={seat.height * 0.7}
              stroke={color}
              strokeWidth={3 * scale}
              fill={layer.kind === "highlight" ? color : "none"}
              fillOpacity={layer.opacity ?? 0.13}
            />
          ))}
        </svg>
      );
    }
    case "flash":
      return (
        <div
          style={{
            ...worldContainer,
            background: layer.color ?? "#fff",
            opacity: (layer.opacity ?? 0.65) * Math.max(0, 1 - frame / layer.durationFrames),
          }}
        />
      );
    case "shake":
      return null; // 镜头矩阵消费震动，文字等屏幕图层保持可读。
    case "custom": {
      if (!layerRegistry || !Object.hasOwn(layerRegistry, layer.component))
        throw new Error(`video_custom_component_missing:${layer.component}`);
      const Component = layerRegistry[layer.component];
      const component = (
        <Component
          frame={frame}
          durationFrames={layer.durationFrames}
          shot={view.shot}
          plan={plan}
          props={layer.props ?? {}}
          mediaBaseUrl={mediaBaseUrl}
          currentView={view.currentView}
          scene={view.scene}
          sourceSeq={view.sourceSeq}
          sourceFactSeq={view.sourceFactSeq}
          view={view}
        />
      );
      // 广播world自定义组件采用原始场景坐标，继承与旧布局相同的整层矩阵；HUD混合组件应声明screen。
      return projectedWorld ? (
        <div data-video-custom-world style={worldContainer}>
          {component}
        </div>
      ) : (
        component
      );
    }
  }
}
