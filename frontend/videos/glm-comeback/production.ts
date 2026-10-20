/** 本局制作入口：主题名用于作者目录，sessionId仅用于定位原始归档；全部生成产物进入output。 */
import { defineVideoProduction } from "../../scripts/video/production";
export default defineVideoProduction({
  directory: import.meta.dir,
  sessionId: "session_1792443889532_ltr2qg",
  title: "12 个 GLM 猫娘玩狼人杀",
  model: "GLM-5.3",
  soundtrack: "./soundtrack.ts",
});
