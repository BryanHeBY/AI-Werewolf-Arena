/**
 * 负责声明本地视频项目的浏览器安全配置。输入为相对复盘路径与纯数据脚本，输出同一类型化定义。
 * 文件读取、素材复制与自定义 TSX 打包由命令入口负责；本模块不访问磁盘或调用 TTS。
 */
import type { SpeechScript } from "./speech-script";
import type { SpeechProject, SpeechManifest } from "./speech";
import type { VideoScript } from "./video/plan";

/** 项目目录拥有相对路径基准；可选 layers 作为模块具名导出进入 bundle，不进入此数据对象。 */
export interface VideoProjectDefinition {
  input: string;
  /** 声音编排延迟到项目准备阶段；导入作者入口不读取录像或编译计划。 */
  speech?: { document: SpeechScript; audio?: { project: SpeechProject; manifest: SpeechManifest } };
  /** 独立浏览器模块只导出layers/themeSlots；Node作者脚本与音频准备代码不进入bundle。 */
  visuals?: string;
  script?: VideoScript;
  /** 本地字体随项目固定并与素材一起准备；不从浏览器系统偏好推断视频字体。 */
  fonts?: Array<{ family: string; src: string; weight?: string }>;
}

export function defineVideoProject(project: VideoProjectDefinition): VideoProjectDefinition {
  return project;
}
