/** 本局制作入口：主题名用于作者目录，sessionId仅用于定位原始归档；全部生成产物进入output。 */
import { defineVideoProduction } from "../../scripts/video/production";
export default defineVideoProduction({
  directory: import.meta.dir,
  sessionId: "session_1792238100351_z77m4h",
  title: "真预言家首验查杀，为什么全场都信那只狼？",
  model: "gpt-6.1-sol",
  soundtrack: "./soundtrack.ts",
});
