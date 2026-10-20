/**
 * 负责已准备视频图片的宿主适配。输入为显式素材 src 及图片展示参数，输出浏览器解码门禁或无 DOM 的同等图片标记。
 * 浏览器使用 Remotion Img 等待实际解码并传播资源错误；无 DOM 的按帧静态检查不读取时间上下文。
 * 不自行下载、转换或推断素材；服务端纯帧检查不需要 Composition 时间上下文，真实预览和导出仍遵守 Remotion 资源门禁。
 */
import type { ComponentProps } from "react";
import { Img } from "remotion";

export function VideoImage(props: ComponentProps<typeof Img>) {
  return typeof window === "undefined" ? <img {...props} /> : <Img {...props} />;
}
