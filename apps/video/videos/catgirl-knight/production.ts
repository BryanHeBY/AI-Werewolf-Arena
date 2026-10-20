/** 负责声明本局制作任务。输入为作者目录、原对局 session 和模型展示名，输出统一制作路径；调用方负责生成产物，本模块不读取认证或运行对局。 */
import { defineVideoProduction } from "../../scripts/video/production";
export default defineVideoProduction({
  directory: import.meta.dir,
  sessionId: "session_1792391429963_4bygw6",
  title: "12 个 GPT 猫娘玩狼人杀",
  model: "gpt-6.1-sol",
  soundtrack: "./soundtrack.ts",
});
