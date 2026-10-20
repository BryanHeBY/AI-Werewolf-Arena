/** 正式有声项目只消费已准备的完整配音。输入为导演稿与素材清单，输出按真实语音时长编排的项目；缺失或过期素材直接报错。 */
import { createSpeechVideoProject } from "../../scripts/video/authoring";
import project from "./visual.project";
import dialogue, { speechScript } from "./dialogue";
import { readSpeechManifest } from "../../scripts/video/speech-script";
import production from "./production";
const manifest = await readSpeechManifest(production.manifest);
export default createSpeechVideoProject(project, speechScript, {
  audio: { project: dialogue, manifest },
});
