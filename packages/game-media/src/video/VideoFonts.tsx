/**
 * 负责等待内置授权字体与项目显式本地字体加载完成，再交出需要量高的正文子树。
 * 输入为内容寻址字体、媒体基准及可选子树，输出字体／子树阻塞句柄生命周期；旧无children入口兼容。
 * 预览与导出共享字节，失败终止渲染，不以宿主回退字体测量，也不缓存跨项目的同family字形。
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { resolveVideoMediaSource } from "./frame";
import { resolveVideoFontFaces, type ThemeFontFace } from "../themes/fonts";

export function VideoFonts({
  fonts,
  mediaBaseUrl,
  children,
}: {
  fonts?: readonly ThemeFontFace[];
  mediaBaseUrl?: string;
  children?: ReactNode;
}) {
  const descriptor = useMemo(
    () =>
      JSON.stringify(
        resolveVideoFontFaces(fonts).map((font) => ({
          ...font,
          src: resolveVideoMediaSource(font.src, mediaBaseUrl),
        })),
      ),
    [fonts, mediaBaseUrl],
  );
  // 字节URL或同family覆盖变化就建立新门，不能复用已释放句柄或旧测量。
  return (
    <VideoFontGate key={descriptor} descriptor={descriptor}>
      {children}
    </VideoFontGate>
  );
}

function VideoFontGate({ descriptor, children }: { descriptor: string; children?: ReactNode }) {
  const [ready, setReady] = useState(false);
  const loading = useRef<number | null>(null);
  useLayoutEffect(() => {
    let disposed = false;
    // 只在commit建立句柄，避免StrictMode双initializer丢弃一个不可回收的render副作用。
    const loadHandle = delayRender("video_font_faces_loading");
    loading.current = loadHandle;
    const resolved = JSON.parse(descriptor) as ThemeFontFace[];
    const faces = resolved.map(
      (font) =>
        new FontFace(font.family, `url(${JSON.stringify(font.src)})`, {
          weight: font.weight ?? "normal",
        }),
    );
    void Promise.all(
      faces.map(async (face) => {
        await face.load();
        if (!disposed) document.fonts.add(face);
      }),
    )
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch((error) => {
        if (!disposed) cancelRender(error);
      });
    return () => {
      disposed = true;
      for (const face of faces) document.fonts.delete(face);
      if (loading.current === loadHandle) loading.current = null;
      continueRender(loadHandle);
    };
  }, [descriptor]);
  // 子树先在本次commit建立量高句柄，再释放字体门，避免捕获中间空画面。
  useLayoutEffect(() => {
    if (ready && loading.current !== null) continueRender(loading.current);
  }, [ready]);
  return ready ? children : null;
}
