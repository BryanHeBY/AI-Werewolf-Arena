/** 本局制作预览负责按JSONL台词累加临时时钟。输入为视觉底稿与完整语音稿，输出无声估时项目；不伪造字幕或调用TTS。 */
import { createSpeechVideoProject } from "../../scripts/video/authoring";
import visual from "./visual.project";
import { speechScript } from "./dialogue";
export default createSpeechVideoProject(visual, speechScript);
