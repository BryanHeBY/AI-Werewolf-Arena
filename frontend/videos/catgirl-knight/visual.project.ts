/** 本局画面底稿负责保留原生镜头与人工视觉微调。输入为锁定录像和完整副本，输出不依赖配音的对照项目。 */
import { defineVideoProject } from "../../src/video-project";
import { script } from "./overrides";
import production from "./production";
export default defineVideoProject({
  input: production.input,
  script,
});
