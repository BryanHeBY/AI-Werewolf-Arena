/** 负责声明本局制作任务。输入为作者目录、原对局 session 和模型展示名，输出统一制作路径；调用方负责生成产物，本模块不读取认证或运行对局。 */
import { defineVideoProduction } from "../../scripts/video/production";
export default defineVideoProduction({
  directory: import.meta.dir,
  sessionId: "session_1792238100351_z77m4h",
  title: "真预言家首验查杀，为什么全场都信那只狼？",
  model: "gpt-6.1-sol",
  soundtrack: "./soundtrack.ts",
});
