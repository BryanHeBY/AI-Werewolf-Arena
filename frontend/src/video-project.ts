/**
 * 负责声明本地视频项目的浏览器安全配置。输入为相对复盘路径与纯数据脚本，输出同一类型化定义。
 * 文件读取、素材复制与自定义 TSX 打包由命令入口负责；本模块不访问磁盘或调用 TTS。
 */
import type { VideoScript } from "./video";

/** 项目目录拥有相对路径基准；可选 layers 作为模块具名导出进入 bundle，不进入此数据对象。 */
export interface VideoProjectDefinition {
  input: string;
  script?: VideoScript;
}

export function defineVideoProject(project: VideoProjectDefinition): VideoProjectDefinition {
  return project;
}
