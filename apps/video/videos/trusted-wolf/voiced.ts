/** 负责装配本局正式有声项目。输入为导演稿与已经准备的配音清单，输出按真实语音时长编排的项目；调用方消费结果，缺失或过期素材直接失败，不重新生成配音。 */
import { createSpeechVideoProject } from "../../scripts/video/authoring";
import project from "./visual.project.ts";
import dialogue, { speechScript } from "./dialogue";
import { readSpeechManifest } from "../../scripts/video/speech-script";
import production from "./production";
const manifest = await readSpeechManifest(production.manifest);
export default createSpeechVideoProject(project, speechScript, {
  audio: { project: dialogue, manifest },
});
