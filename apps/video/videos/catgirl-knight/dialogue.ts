/** 本局配音入口负责读取完整JSONL语音稿。输入为可编辑台词与独立选角，输出统一配音项目；不合成或删改玩家原话。 */
import { readSpeechScript } from "../../scripts/video/speech-script";
import { speechProjectFromScript } from "@ai-werewolf-arena/game-media/speech-script";
import { casting } from "./casting";
export const speechScript = readSpeechScript(new URL("./speech.jsonl", import.meta.url));
export default speechProjectFromScript(speechScript, casting);
