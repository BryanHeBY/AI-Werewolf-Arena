/** 负责声明本局制作任务。输入为作者目录、原对局 session 和模型展示名，输出统一制作路径；调用方负责生成产物，本模块不读取认证或运行对局。 */
import { defineVideoProduction } from "../../scripts/video/production";
export default defineVideoProduction({
  directory: import.meta.dir,
  sessionId: "session_1792443889532_ltr2qg",
  title: "12 个 GLM 猫娘玩狼人杀",
  model: "GLM-5.3",
  soundtrack: "./soundtrack.ts",
});
