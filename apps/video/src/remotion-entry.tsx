/**
 * 负责默认 Remotion 打包入口。输入为通用视频计划 props，输出与单局脚本相同的 composition 注册。
 * 宽高、帧率和时长归计划所有者；本入口不读取文件、不定义另一套事件时序。
 */
import { registerRoot } from "remotion";
import { createVideoRoot } from "@ai-werewolf-arena/game-media/video-root";
registerRoot(createVideoRoot());
