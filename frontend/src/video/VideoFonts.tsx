/**
 * 负责等待内置授权字体与项目显式本地字体加载完成。输入为计划中的内容寻址字体与素材基准，输出渲染阻塞句柄生命周期。
 * 预览和导出使用相同字节；失败明确终止渲染，不悄悄使用宿主字体造成字幕分页与画面漂移。
 */
import { useEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { resolveVideoMediaSource } from "./frame";
import { resolveVideoFontFaces, type ThemeFontFace } from "../themes/fonts";

export function VideoFonts({
  fonts,
  mediaBaseUrl,
}: {
  fonts?: readonly ThemeFontFace[];
  mediaBaseUrl?: string;
}) {
  const [handle] = useState(() => delayRender("video_project_fonts"));
  const resolved = useMemo(() => resolveVideoFontFaces(fonts), [fonts]);
  useEffect(() => {
    let disposed = false;
    const faces = resolved.map(
      (font) =>
        new FontFace(
          font.family,
          `url(${JSON.stringify(resolveVideoMediaSource(font.src, mediaBaseUrl))})`,
          { weight: font.weight ?? "normal" },
        ),
    );
    void Promise.all(
      faces.map(async (face) => {
        await face.load();
        if (!disposed) document.fonts.add(face);
      }),
    )
      .then(() => {
        if (!disposed) continueRender(handle);
      })
      .catch((error) => {
        if (!disposed) cancelRender(error);
      });
    return () => {
      disposed = true;
      for (const face of faces) document.fonts.delete(face);
      continueRender(handle);
    };
  }, [resolved, mediaBaseUrl, handle]);
  return null;
}
